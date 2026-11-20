#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import util from 'node:util';
import hideSensitive from 'semantic-release/lib/hide-sensitive.js';
import { SEMANTIC_RELEASE_DEFAULT_CONFIG } from 'semantic-release/lib/definitions/constants.js';

const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const corePath = releaseRequire.resolve('@semantic-release/core');
const { resolveConfig, getLogger, resolveEnvCi } = await import(pathToFileURL(corePath).href);
const verify = (await import(pathToFileURL(join(dirname(corePath), 'lib/verify.js')).href)).default;

const git = (...args) => execFileSync('git', args, {
  cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

const pluginName = (entry) => Array.isArray(entry)
  ? entry[0]
  : typeof entry === 'object' ? entry.path ?? 'inline plugin' : entry;

async function validate() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf('--base-branch');
  const bundled = args.includes('--bundled');
  if (baseIndex !== 0 || !['main', 'rc'].includes(args[1]) ||
      args.length !== (bundled ? 3 : 2) || (bundled && args[2] !== '--bundled')) {
    throw new Error('Usage: --validate --base-branch <main|rc>');
  }
  const targetBranch = args[1];

  const cwd = process.cwd();
  const env = process.env;
  const context = {
    cwd, env, stdout: process.stdout, stderr: process.stderr,
    envCi: resolveEnvCi({ cwd, env }),
  };
  context.logger = getLogger(context);

  // Match semantic-release 26's actual loading order. In fallback mode, the
  // bundled policy must be runtime options, not --extends (which loses plugins).
  const runtimeOptions = bundled ? require('./default.releaserc.cjs') : {};
  const { options, plugins } = await resolveConfig(context, runtimeOptions, {
    baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG, buildPlugins: true,
  });
  context.options = { ...options, dryRun: true };
  await verify(context);

  const branchNames = options.branches.map((item) => typeof item === 'string' ? item : item.name);
  if (!branchNames.includes(targetBranch)) {
    throw new Error('Target branch ' + targetBranch + ' is not configured for releases');
  }

  const baseRef = 'refs/remotes/origin/' + targetBranch;
  git('rev-parse', '--verify', baseRef);
  const history = git('log', '--no-merges', '--format=%H%x00%B%x00', baseRef + '..HEAD');
  const fields = history.split('\0');
  const commits = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    const hash = fields[index].trim();
    const message = fields[index + 1].trim();
    if (hash) commits.push({ hash, message });
  }
  if (commits.length === 0) {
    throw new Error('No pull-request commits found relative to ' + baseRef);
  }

  // No tokens are made available to PRs. Load ALL configured plugins above,
  // but skip GitHub's remote authentication when checking local conditions.
  const localPlugins = options.plugins.filter((entry) => pluginName(entry) !== '@semantic-release/github');
  const localOptions = { ...context.options, plugins: localPlugins };
  for (const step of ['verifyConditions', 'publish', 'addChannel', 'success', 'fail']) {
    delete localOptions[step];
  }
  const { options: checkOptions, plugins: localPipeline } = await resolveConfig(context, localOptions, {
    baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG, buildPlugins: true,
  });
  await localPipeline.verifyConditions({ ...context, options: { ...checkOptions, dryRun: true } });

  const lastRelease = { version: '1.0.0', gitTag: 'v1.0.0' };
  const branch = { name: targetBranch };
  const analysisContext = { ...context, commits, branch, lastRelease };
  const releaseType = await plugins.analyzeCommits(analysisContext);
  if (releaseType) {
    const nextVersion = releaseType === 'major' ? '2.0.0' : releaseType === 'minor' ? '1.1.0' : '1.0.1';
    const nextRelease = {
      type: releaseType, version: nextVersion, gitTag: 'v' + nextVersion, name: 'v' + nextVersion,
    };
    // Smoke-test release notes without preparing files, publishing or creating tags.
    await plugins.generateNotes({ ...analysisContext, nextRelease });
  }

  console.log('Validated release policy for ' + targetBranch);
  console.log('Configured plugins: ' + options.plugins.map(pluginName).join(', '));
  console.log('Analyzed ' + commits.length + ' PR commits; release type: ' + (releaseType || 'none'));
  console.log('Validation passed (no GitHub authentication, prepare, publish or Git writes).');
}

validate().catch((error) => {
  process.stderr.write(hideSensitive(process.env)(util.inspect(error, { colors: true })) + '\n');
  process.exitCode = 1;
});
