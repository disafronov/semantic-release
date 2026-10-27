const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const upstream = path.dirname(require.resolve('semantic-release'));
const logger = { log() {}, error() {}, warn() {}, success() {}, scope() { return this; } };
const env = {
  ...process.env, GIT_ALLOW_PROTOCOL: 'file',
  GIT_AUTHOR_NAME: 'Policy Test Author', GIT_AUTHOR_EMAIL: 'author@example.invalid',
  GIT_COMMITTER_NAME: 'Policy Test Committer', GIT_COMMITTER_EMAIL: 'committer@example.invalid',
};
// Config modules call git var in this process, rather than using context.env.
// Keep loader tests independent of the runner's global Git identity.
Object.assign(process.env, {
  GIT_AUTHOR_NAME: env.GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL: env.GIT_AUTHOR_EMAIL,
  GIT_COMMITTER_NAME: env.GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL: env.GIT_COMMITTER_EMAIL,
});
const sink = new Writable({ write(chunk, encoding, callback) { callback(); } });
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function load(name, overrides = {}) {
  return JSON.parse(execFileSync(process.execPath, ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(path.join(root, name))})))`], {
    env: { ...env, ...overrides }, encoding: 'utf8',
  }));
}

function fixture(t, stableBranch = false) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-policy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cwd = path.join(dir, 'project');
  const remote = path.join(dir, 'remote.git');
  mkdirSync(cwd);
  git(dir, 'init', '--bare', remote);
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(cwd, 'init', '-b', 'main');
  writeFileSync(path.join(cwd, 'README.md'), 'fixture\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', 'chore: fixture');
  git(cwd, 'tag', 'v1.2.3');
  if (stableBranch) git(cwd, 'branch', 'release');
  git(cwd, 'remote', 'add', 'origin', pathToFileURL(remote).href);
  git(cwd, 'push', 'origin', '--all');
  git(cwd, 'push', 'origin', '--tags');
  return { cwd, remote, context: { cwd, env, logger, stdout: sink, stderr: sink } };
}

async function library(name) {
  return (await import(pathToFileURL(path.join(upstream, 'lib', name)))).default;
}

test('bundled default supports stable main and optional rc', () => {
  const bundled = load('default.releaserc.cjs');
  assert.deepEqual(bundled.branches, ['main', { name: 'rc', prerelease: 'rc' }]);
  assert.equal(bundled.extends, undefined);
});

test('bundled configuration derives sign-off from the actual Git committer', () => {
  for (const name of ['default.releaserc.cjs']) {
    for (const [who, email] of [['First Committer', 'first@example.invalid'], ['Other Committer', 'other@example.invalid']]) {
      const config = load(name, { GIT_COMMITTER_NAME: who, GIT_COMMITTER_EMAIL: email });
      const message = config.plugins.find(([plugin]) => plugin === '@semantic-release/git')[1].message;
      assert.equal(message, `chore(release): \${nextRelease.version}\n\n\${nextRelease.notes}\n\nSigned-off-by: ${who} <${email}>`);
    }
  }
});

test('actual semantic-release loader resolves the bundled default and every plugin', async (t) => {
  const { context } = fixture(t);
  const getConfig = await library('get-config.js');
  const { options, plugins } = await getConfig(context, { extends: [path.join(root, 'default.releaserc.cjs')] });
  assert.deepEqual(options.branches, ['main', { name: 'rc', prerelease: 'rc' }]);
  assert.equal(options.plugins.length, 5);
  assert.equal(typeof plugins.prepare, 'function');
});

test('a consumer with only main remains a stable release branch', async (t) => {
  const { remote, context } = fixture(t);
  const getBranches = await library('branches/index.js');
  const getLastRelease = await library('get-last-release.js');
  const getNextVersion = await library('get-next-version.js');
  const options = { branches: load('default.releaserc.cjs').branches, tagFormat: 'v${version}' };
  const branches = await getBranches(pathToFileURL(remote).href, 'main', { ...context, options });
  assert.deepEqual(branches.map(({ name, type }) => ({ name, type })), [{ name: 'main', type: 'release' }]);
  const branch = branches[0];
  const lastRelease = getLastRelease({ branch, options });
  assert.equal(lastRelease.version, '1.2.3');
  assert.equal(getNextVersion({ branch, lastRelease, nextRelease: { type: 'patch', channel: branch.channel }, logger }), '1.2.4');
});

test('optional rc branch produces prereleases while main stays stable', async (t) => {
  const { cwd, remote, context } = fixture(t);
  git(cwd, 'branch', 'rc');
  git(cwd, 'push', 'origin', 'rc');
  const getBranches = await library('branches/index.js');
  const getLastRelease = await library('get-last-release.js');
  const getNextVersion = await library('get-next-version.js');
  const options = { branches: load('default.releaserc.cjs').branches, tagFormat: 'v${version}' };
  const branches = await getBranches(pathToFileURL(remote).href, 'main', { ...context, options });
  assert.deepEqual(branches.map(({ name, type }) => ({ name, type })), [
    { name: 'main', type: 'release' },
    { name: 'rc', type: 'prerelease' },
  ]);
  for (const branch of branches) {
    const lastRelease = getLastRelease({ branch, options });
    const version = getNextVersion({ branch, lastRelease, nextRelease: { type: 'patch', channel: branch.channel }, logger });
    assert.equal(version, branch.name === 'main' ? '1.2.4' : '1.2.4-rc.1');
  }
});

test('refactor remains a patch release and appears in generated notes', () => {
  const config = load('default.releaserc.cjs');
  const analyzer = config.plugins.find(([name]) => name === '@semantic-release/commit-analyzer')[1];
  const notes = config.plugins.find(([name]) => name === '@semantic-release/release-notes-generator')[1];
  assert.deepEqual(analyzer.releaseRules.find(({ type }) => type === 'refactor'), { type: 'refactor', release: 'patch' });
  assert.deepEqual(notes.presetConfig.types.find(({ type }) => type === 'refactor'), { type: 'refactor', section: 'Code Refactoring' });
});
