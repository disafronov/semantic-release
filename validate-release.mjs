#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import util from 'node:util';
import hideSensitive from 'semantic-release/lib/hide-sensitive.js';
import { resolveReleaseOptions, runRelease } from './fallback-runner.mjs';

const pluginName = (entry) => Array.isArray(entry)
  ? entry[0]
  : typeof entry === 'object' ? entry.path ?? 'inline plugin' : entry;

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

async function validate() {
  const args = process.argv.slice(2);
  const bundled = args.at(-1) === '--bundled';
  const flags = bundled ? args.slice(0, -1) : args;
  if (flags[0] !== '--base-branch' || !['main', 'rc'].includes(flags[1]) ||
      (flags.length !== 2 && (flags.length !== 4 || flags[2] !== '--diff-output'))) {
    throw new Error('Usage: --validate --base-branch <main|rc> [--diff-output <path>]');
  }
  const baseBranch = flags[1];
  const source = process.cwd();
  const originalHead = git(source, 'rev-parse', 'HEAD');
  const diffTarget = flags[2] ? flags[3] : process.env.SEMANTIC_RELEASE_DIFF_OUTPUT;
  const diffFile = diffTarget ? resolve(source, diffTarget) : null;
  if (diffFile) {
    const rel = relative(source, diffFile);
    if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel) ||
        rel.split(sep).includes('.git')) {
      throw new Error('--diff-output must be inside the workspace, outside .git');
    }
  }

  const root = mkdtempSync(join(tmpdir(), 'release-validation-'));
  let failed;
  try {
    const remote = createLocalRemote(source, baseBranch, root);
    const env = {
      ...process.env,
      GIT_ALLOW_PROTOCOL: 'file',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo',
      CI: 'true',
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/' + baseBranch,
    };
    for (const key of ['GITHUB_TOKEN', 'GH_TOKEN', 'GIT_CREDENTIALS', 'GL_TOKEN',
      'GITLAB_TOKEN', 'BITBUCKET_TOKEN', 'BB_TOKEN_BASIC_AUTH', 'GITHUB_EVENT_PATH',
      'GITHUB_HEAD_REF', 'GITHUB_BASE_REF']) delete env[key];

    // Resolve the same policy the normal release uses. Validation alone owns
    // disabling network publishers and replacing the Git remote.
    const options = await resolveReleaseOptions(
      { cwd: source, env }, { fallback: bundled });
    const plugins = options.plugins.filter(
      (entry) => pluginName(entry) !== '@semantic-release/github');
    const runOptions = { ...options, plugins, repositoryUrl: remote, dryRun: false, noCi: false };
    const result = await runRelease(
      runOptions, { cwd: source, env }, { fallback: bundled });

    console.log('Validated release policy for ' + baseBranch + ' against actual release history');
    console.log('Active plugins: ' + plugins.map(pluginName).join(', '));
    console.log('Commits since last release: ' + (result?.commits?.length ?? 0));
    console.log('Next release: ' + (result?.nextRelease?.version ?? 'none'));
    console.log('Validation passed (real local prepare, local Git pushes, no external access).');
  } catch (error) {
    failed = error;
  } finally {
    try {
      const diff = releaseDiff(source, originalHead);
      console.log('=== Release validation Git diff (before -> after) ===');
      console.log(diff || '(no changes)');
      console.log('=== End release validation Git diff ===');
      if (diffFile) {
        mkdirSync(dirname(diffFile), { recursive: true });
        writeFileSync(diffFile, diff || '# No local changes were produced\n');
        console.log('Saved validation diff: ' + diffFile);
      }
    } catch (error) {
      if (!failed) failed = error;
      else console.error('Could not collect Git diff:', error);
    }
    rmSync(root, { recursive: true, force: true });
  }
  if (failed) throw failed;
}

validate().catch((error) => {
  process.stderr.write(hideSensitive(process.env)(util.inspect(error, { colors: true })) + '\n');
  process.exitCode = 1;
});
