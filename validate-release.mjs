#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import util from 'node:util';
import hideSensitive from 'semantic-release/lib/hide-sensitive.js';
import { SEMANTIC_RELEASE_DEFAULT_CONFIG } from 'semantic-release/lib/definitions/constants.js';

const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const core = await import(pathToFileURL(releaseRequire.resolve('@semantic-release/core')).href);
const pluginName = (entry) => Array.isArray(entry)
  ? entry[0]
  : typeof entry === 'object' ? entry.path ?? 'inline plugin' : entry;

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_ALLOW_PROTOCOL: 'file', GIT_TERMINAL_PROMPT: '0' },
  }).trim();
}

function createSandbox(source, baseBranch, root) {
  const work = join(root, 'work');
  const remote = join(root, 'remote.git');
  const sourceHead = git(source, 'rev-parse', 'HEAD');
  const baseHead = git(source, 'rev-parse', '--verify', 'refs/remotes/origin/' + baseBranch);

  // The PR checkout must contain its target branch (normally GitHub's merge ref).
  git(source, 'merge-base', '--is-ancestor', baseHead, sourceHead);
  git(source, 'rev-parse', '--verify', 'HEAD^{commit}');

  git(source, 'init', '-b', baseBranch, work);
  git(source, 'init', '--bare', remote);
  git(work, 'fetch', '--no-tags', source, 'HEAD');
  git(work, 'fetch', '--tags', source);
  git(work, 'checkout', '-B', baseBranch, sourceHead);
  git(work, 'remote', 'add', 'origin', pathToFileURL(remote).href);

  // Copy real release branches into a local-only remote. The target branch is
  // replaced by the hypothetical PR merge, never by a GitHub branch push.
  const refs = git(source, 'for-each-ref', '--format=%(refname:strip=3) %(objectname)',
    'refs/remotes/origin');
  const branches = new Map();
  for (const line of refs.split('\n').filter(Boolean)) {
    const [name, sha] = line.split(' ');
    if (name !== 'HEAD') branches.set(name, sha);
  }
  if (!branches.has(baseBranch)) throw new Error('Missing remote-tracking branch origin/' + baseBranch);
  for (const [name, sha] of branches) {
    if (name !== baseBranch) git(work, 'push', 'origin', sha + ':refs/heads/' + name);
  }
  git(work, 'push', 'origin', 'HEAD:refs/heads/' + baseBranch);
  // Git fetch <url> with no refspec uses the bare remote's HEAD.
  // Without this, the real core fails before it can inspect release tags.
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/' + baseBranch);
  git(work, 'push', 'origin', '--tags');

  // Channel metadata is stored in Git notes, not just tag names. Carry any
  // notes already fetched by the caller into the isolated remote.
  const notes = git(source, 'for-each-ref', '--format=%(refname)', 'refs/notes');
  for (const ref of notes.split('\n').filter(Boolean)) {
    git(work, 'fetch', source, ref + ':' + ref);
    git(work, 'push', 'origin', ref + ':' + ref);
  }

  return { work, remote: pathToFileURL(remote).href };
}

async function validate() {
  const args = process.argv.slice(2);
  const bundled = args.includes('--bundled');
  if (args[0] !== '--base-branch' || !['main', 'rc'].includes(args[1]) ||
      args.length !== (bundled ? 3 : 2) || (bundled && args[2] !== '--bundled')) {
    throw new Error('Usage: --validate --base-branch <main|rc>');
  }
  const baseBranch = args[1];
  const source = process.cwd();
  const root = mkdtempSync(join(tmpdir(), 'release-validation-'));

  try {
    const { work, remote } = createSandbox(source, baseBranch, root);
    process.chdir(work);

    const env = {
      ...process.env,
      GIT_ALLOW_PROTOCOL: 'file',
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo',
      // Do not expose release credentials or PR-specific GitHub API context.
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REF: 'refs/heads/' + baseBranch,
    };
    for (const key of ['GITHUB_TOKEN', 'GH_TOKEN', 'GIT_CREDENTIALS', 'GL_TOKEN',
      'GITLAB_TOKEN', 'BITBUCKET_TOKEN', 'BB_TOKEN_BASIC_AUTH', 'GITHUB_EVENT_PATH',
      'GITHUB_HEAD_REF', 'GITHUB_BASE_REF']) delete env[key];

    const context = {
      cwd: work, env, stdout: process.stdout, stderr: process.stderr,
      envCi: { isCi: true, isPr: false, branch: baseBranch },
    };
    context.logger = core.getLogger(context);

    // First resolve ALL plugins with exactly the same configuration precedence
    // as the release entrypoint, including optional project-specific plugins.
    const runtimeOptions = bundled ? require('./default.releaserc.cjs') : {};
    const resolved = await core.resolveConfig(context, runtimeOptions, {
      baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG, buildPlugins: true,
    });

    // GitHub publishing authentication cannot be performed without credentials
    // and network. Exclude only the remote GitHub plugin from execution.
    // All other steps use the actual upstream core, branch/tag/channel logic,
    // commit selection, version calculation, and dry-run release-note pipeline.
    const plugins = resolved.options.plugins.filter((entry) =>
      pluginName(entry) !== '@semantic-release/github');
    const { options, plugins: localPlugins } = await core.resolveConfig(context, {
      ...resolved.options, repositoryUrl: remote, plugins, dryRun: true, noCi: false,
    }, { baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG, buildPlugins: true });
    context.options = options;
    const result = await core.default({ context, plugins: localPlugins });

    console.log('Validated release policy for ' + baseBranch + ' against actual release history');
    console.log('Configured plugins: ' + resolved.options.plugins.map(pluginName).join(', '));
    console.log('Commits since last release: ' + (result?.commits?.length ?? 0));
    console.log('Next release: ' + (result?.nextRelease?.version ?? 'none'));
    console.log('Validation passed (isolated local Git remote, no GitHub writes or publishing).');
  } finally {
    process.chdir(source);
    rmSync(root, { recursive: true, force: true });
  }
}

validate().catch((error) => {
  process.stderr.write(hideSensitive(process.env)(util.inspect(error, { colors: true })) + '\n');
  process.exitCode = 1;
});
