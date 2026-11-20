#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const { cosmiconfig } = releaseRequire('cosmiconfig');
const { getDefaultSearchPlaces } = releaseRequire('cosmiconfig/dist/defaults.js');
const pluginName = (entry) => Array.isArray(entry)
  ? entry[0] : typeof entry === 'object' ? entry.path ?? 'inline plugin' : entry;

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

function createLocalRemote(source, baseBranch, root) {
  const remote = join(root, 'remote.git');
  const sourceHead = git(source, 'rev-parse', 'HEAD');
  const baseHead = git(source, 'rev-parse', '--verify', 'refs/remotes/origin/' + baseBranch);

  // actions/checkout normally checks out a detached PR merge commit.
  git(source, 'merge-base', '--is-ancestor', baseHead, sourceHead);
  git(source, 'init', '--bare', remote);

  // Copy only refs, not the working tree. The actual checkout stays writable.
  const refs = git(source, 'for-each-ref', '--format=%(refname:strip=3) %(objectname)',
    'refs/remotes/origin');
  const branches = new Map();
  for (const line of refs.split('\n').filter(Boolean)) {
    const [name, sha] = line.split(' ');
    if (name !== 'HEAD') branches.set(name, sha);
  }
  if (!branches.has(baseBranch)) {
    throw new Error('Missing remote-tracking branch origin/' + baseBranch);
  }
  for (const [name, sha] of branches) {
    if (name !== baseBranch) git(source, 'push', remote, sha + ':refs/heads/' + name);
  }
  git(source, 'push', remote, 'HEAD:refs/heads/' + baseBranch);
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/' + baseBranch);
  git(source, 'push', remote, '--tags');

  // Git notes carry release channel metadata; preserve them as well.
  const notes = git(source, 'for-each-ref', '--format=%(refname)', 'refs/notes');
  for (const ref of notes.split('\n').filter(Boolean)) {
    git(source, 'push', remote, ref + ':' + ref);
  }
  return pathToFileURL(remote).href;
}

function gitOutput(cwd, args, accepted = [0]) {
  const result = spawnSync('git', args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0' },
  });
  if (result.error || !accepted.includes(result.status)) {
    throw result.error ?? new Error('git ' + args.join(' ') + ': ' + result.stderr);
  }
  return result.stdout;
}

function releaseDiff(cwd, originalHead) {
  // Prepared files may already be committed by @semantic-release/git.
  // Compare Git objects, not merely the final working tree.
  const committed = gitOutput(cwd, ['diff', '--binary', '--no-ext-diff', originalHead, 'HEAD']);
  const unstaged = gitOutput(cwd, ['diff', '--binary', '--no-ext-diff', 'HEAD']);
  const staged = gitOutput(cwd, ['diff', '--binary', '--cached', '--no-ext-diff', 'HEAD']);
  const untracked = gitOutput(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean);
  const created = untracked.map((name) => gitOutput(cwd,
    ['diff', '--no-index', '--binary', '--', '/dev/null', name], [0, 1])).join('\n');
  return [committed, unstaged, staged, created].filter(Boolean).join('\n');
}


function ownArguments(argv) {
  let validate = false;
  let baseBranch;
  let diffOutput;
  const forwarded = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--validate') {
      validate = true;
    } else if (argv[i] === '--base-branch') {
      baseBranch = argv[++i];
    } else if (argv[i] === '--diff-output') {
      diffOutput = argv[++i];
    } else {
      forwarded.push(argv[i]);
    }
  }
  if (validate && !['main', 'rc'].includes(baseBranch)) {
    throw new Error('Usage: --validate --base-branch <main|rc> [--diff-output <path>]');
  }
  return { validate, baseBranch, diffOutput, forwarded };
}

function runUpstreamCli(args, cwd, env) {
  const result = spawnSync('semantic-release', args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error('semantic-release exited with status ' + result.status);
    error.exitCode = result.status ?? 1;
    throw error;
  }
}

// The upstream CLI knows how to parse its own options. When the project has
// no config, expose our policy through cosmiconfig rather than --extends:
// semantic-release 26's built-in plugins otherwise override the fallback.
async function release(args, cwd) {
  // Match cosmiconfig search locations but ignore directories named like
  // configuration files. A malformed package.json is an upstream CLI error.
  const configFiles = getDefaultSearchPlaces('release').filter(p => p !== 'package.json');
  const fileConfig = configFiles.some(name => {
    const path = join(cwd, name);
    return existsSync(path) && statSync(path).isFile();
  });
  const manifest = join(cwd, 'package.json');
  const packageConfig = !fileConfig && existsSync(manifest)
    ? JSON.parse(readFileSync(manifest, 'utf8'))?.release != null : false;
  const fallback = !fileConfig && !packageConfig;
  const temporary = join(cwd, '.releaserc');
  if (fallback) {
    console.log('No local semantic-release configuration found, using default');
    writeFileSync(temporary, JSON.stringify(require('./fallback-config.cjs')));
  }
  try {
    runUpstreamCli(args, cwd, process.env);
  } finally {
    if (fallback) rmSync(temporary, { force: true });
  }
}

async function validation(args, source, baseBranch, diffOutput) {
  const target = diffOutput ?? process.env.SEMANTIC_RELEASE_DIFF_OUTPUT;
  const diffFile = target ? resolve(source, target) : null;
  if (diffFile) {
    const rel = relative(source, diffFile);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) ||
        isAbsolute(rel) || rel.split(sep).includes('.git')) {
      throw new Error('--diff-output must be inside the workspace, outside .git');
    }
  }

  const temp = mkdtempSync(join(tmpdir(), 'release-validation-'));
  const checkout = join(temp, 'checkout');
  let failed;
  let originalHead;
  try {
    originalHead = git(source, 'rev-parse', 'HEAD');
    const remote = createLocalRemote(source, baseBranch, temp);
    git(source, 'clone', '--no-local', '--no-checkout', source, checkout);
    git(checkout, 'checkout', '--detach', originalHead);

    // Clone notes as well as refs/tags: release channels are stored in notes.
    const notes = git(source, 'for-each-ref', '--format=%(refname)', 'refs/notes')
      .split('\n').filter(Boolean);
    for (const ref of notes) git(checkout, 'fetch', source, '+' + ref + ':' + ref);

    const hasConfig = !!(await cosmiconfig('release').search(source));
    if (!hasConfig) console.log('No local semantic-release configuration found, using default');
    const configNames = getDefaultSearchPlaces('release')
      .filter((name) => name !== 'package.json');
    const removed = [];
    for (const name of configNames) {
      const path = join(checkout, name);
      if (existsSync(path) && name !== '.releaserc.mjs') {
        unlinkSync(path);
        removed.push(name);
      } else if (name === '.releaserc.mjs' && existsSync(path)) {
        unlinkSync(path);
        removed.push(name);
      }
    }
    const pkgFile = join(checkout, 'package.json');
    let modifiedPackage = false;
    if (existsSync(pkgFile)) {
      const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
      if (pkg.release != null) {
        delete pkg.release;
        writeFileSync(pkgFile, JSON.stringify(pkg));
        modifiedPackage = true;
      }
    }

    // Resolve the actual effective config once, before invoking the original
    // CLI. A synchronous CJS snapshot is sufficient for cosmiconfig's loader.
    const core = await import(pathToFileURL(releaseRequire.resolve('@semantic-release/core')).href);
    const { SEMANTIC_RELEASE_DEFAULT_CONFIG } = await import(
      'semantic-release/lib/definitions/constants.js');
    const context = { cwd: source, env: process.env, stdout: process.stdout, stderr: process.stderr };
    context.logger = core.getLogger(context);
    const { options } = await core.resolveConfig(context,
      hasConfig ? {} : require('./fallback-config.cjs'),
      { baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG, buildPlugins: false });
    const plugins = options.plugins.filter(e => pluginName(e) !== '@semantic-release/github');
    console.log('Active plugins: ' + plugins.map(pluginName).join(', '));
    const effective = { ...options, plugins, repositoryUrl: remote, dryRun: false, noCi: false };

    // The temporary policy erases itself and restores the original config
    // before any semantic-release lifecycle plugin runs.
    const clean = [
      "const { copyFileSync, unlinkSync } = require('node:fs');",
      "const { join } = require('node:path');",
      "unlinkSync(__filename);",
      "for (const name of " + JSON.stringify(removed) + ")",
      "  copyFileSync(join(" + JSON.stringify(source) + ", name), join(process.cwd(), name));",
      ...(modifiedPackage
        ? ["copyFileSync(join(" + JSON.stringify(source) + ", 'package.json'), join(process.cwd(), 'package.json'));"]
        : []),
    ].join('\n');
    // The CLI's config loader is synchronous; it cannot load async ESM.
    const serialized = JSON.stringify(effective);
    if (serialized === undefined) throw new Error('Release configuration cannot be serialized for CLI validation');
    writeFileSync(join(checkout, '.releaserc.cjs'), clean + '\nmodule.exports = ' + serialized + ';\n');

    const env = {
      ...process.env, CI: 'true', GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/' + baseBranch,
      GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo',
    };
    for (const key of ['GITHUB_TOKEN', 'GH_TOKEN', 'GIT_CREDENTIALS',
      'GL_TOKEN', 'GITLAB_TOKEN', 'BITBUCKET_TOKEN', 'BB_TOKEN_BASIC_AUTH',
      'GITHUB_EVENT_PATH', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF']) delete env[key];

    const beforeTags = new Set(git(checkout, 'tag', '--list').split('\n').filter(Boolean));
    runUpstreamCli(args, checkout, env);
    const createdTags = git(checkout, 'tag', '--list').split('\n').filter(
      (tag) => tag && !beforeTags.has(tag));
    console.log('Created tags: ' + (createdTags.join(', ') || 'none'));
    console.log('Validation passed (upstream CLI, local Git remote, no GitHub plugin).');
  } catch (error) {
    failed = error;
  } finally {
    try {
      if (existsSync(checkout) && originalHead) {
        const diff = releaseDiff(checkout, originalHead);
        console.log('=== Release validation Git diff (before -> after) ===');
        console.log(diff || '(no changes)');
        console.log('=== End release validation Git diff ===');
        if (diffFile) {
          mkdirSync(dirname(diffFile), { recursive: true });
          writeFileSync(diffFile, diff || '# No local changes were produced\n');
          console.log('Saved validation diff: ' + diffFile);
        }
      }
    } catch (error) {
      if (!failed) failed = error;
      else console.error('Could not collect Git diff:', error);
    }
    rmSync(temp, { recursive: true, force: true });
  }
  if (failed) throw failed;
}

try {
  const { validate, baseBranch, diffOutput, forwarded } = ownArguments(process.argv.slice(2));
  if (validate) await validation(forwarded, process.cwd(), baseBranch, diffOutput);
  else await release(forwarded, process.cwd());
} catch (error) {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
}
