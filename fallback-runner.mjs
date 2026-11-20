#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectReleaseConfig } from './detect-release-config.mjs';

const require = createRequire(import.meta.url);

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
  // Parse only validation-specific options; the upstream CLI owns the rest.
  // In particular, "--" and everything after it must be passed through.
  const separator = argv.indexOf('--');
  const beforeSeparator = separator < 0 ? argv : argv.slice(0, separator);
  const validate = beforeSeparator.includes('--validate');
  if (!validate) return { validate: false, forwarded: argv };

  let baseBranch;
  let diffOutput;
  const forwarded = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      forwarded.push(...argv.slice(i));
      break;
    }
    if (arg === '--validate') continue;

    const flag = ['--base-branch', '--diff-output'].find(name =>
      arg === name || arg.startsWith(name + '='));
    if (!flag) {
      forwarded.push(arg);
      continue;
    }
    const value = arg === flag ? argv[++i] : arg.slice(flag.length + 1);
    if (!value || value.startsWith('--')) {
      throw new Error('Missing value for ' + flag);
    }
    if (flag === '--base-branch') baseBranch = value;
    else diffOutput = value;
  }
  if (!['main', 'rc'].includes(baseBranch)) {
    throw new Error('Usage: --validate --base-branch <main|rc> [--diff-output <path>]');
  }
  if (forwarded.length) {
    throw new Error('Validation accepts only --base-branch and --diff-output, not upstream CLI options');
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
  const detected = detectReleaseConfig(cwd);
  const fallback = detected.kind === 'fallback';
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

async function validation(source, baseBranch, diffOutput) {
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
    git(source, 'clone', '--no-local', '--no-checkout', remote, checkout);
    git(checkout, 'checkout', '--detach', originalHead);

    // Clone notes as well as refs/tags: release channels are stored in notes.
    const notes = git(source, 'for-each-ref', '--format=%(refname)', 'refs/notes')
      .split('\n').filter(Boolean);
    for (const ref of notes) git(checkout, 'fetch', remote, '+' + ref + ':' + ref);

    const env = {
      ...process.env, CI: 'true', GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/' + baseBranch,
      GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo',
    };
    // A validation run never needs credentials, even if the parent process has them.
    for (const key of Object.keys(env)) {
      if (/TOKEN|PASSWORD|SECRET|CREDENTIAL|API_KEY|(^|_)AUTH($|_)/i.test(key)) delete env[key];
    }
    for (const key of ['GITHUB_EVENT_PATH', 'GITHUB_HEAD_REF', 'GITHUB_BASE_REF']) delete env[key];

    const beforeTags = new Set(git(checkout, 'tag', '--list').split('\n').filter(Boolean));
    const result = spawnSync(process.execPath,
      [fileURLToPath(new URL('./validation-worker.mjs', import.meta.url)), remote],
      { cwd: checkout, env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const error = new Error('Validation worker exited with status ' + result.status);
      error.exitCode = result.status ?? 1;
      throw error;
    }
    const createdTags = git(checkout, 'tag', '--list').split('\n').filter(
      (tag) => tag && !beforeTags.has(tag));
    console.log('Created tags: ' + (createdTags.join(', ') || 'none'));
    console.log('Validation passed (upstream core, local Git remote, external publishing disabled).');
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
  if (validate) await validation(process.cwd(), baseBranch, diffOutput);
  else await release(forwarded, process.cwd());
} catch (error) {
  console.error(error);
  process.exitCode = error.exitCode ?? 1;
}
