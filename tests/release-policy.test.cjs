const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { Writable } = require('node:stream');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
// semantic-release 26 delegates release orchestration to @semantic-release/core.
// Resolve it from the installed semantic-release package to match its dependency tree.
const releaseRequire = createRequire(require.resolve('semantic-release'));
const upstream = path.dirname(releaseRequire.resolve('@semantic-release/core'));
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
  const bundled = load('fallback-config.cjs');
  assert.deepEqual(bundled.branches, ['main', { name: 'rc', prerelease: 'rc' }]);
  assert.equal(bundled.extends, undefined);
});

test('bundled configuration derives sign-off from the actual Git committer', () => {
  for (const name of ['fallback-config.cjs']) {
    for (const [who, email] of [['First Committer', 'first@example.invalid'], ['Other Committer', 'other@example.invalid']]) {
      const config = load(name, { GIT_COMMITTER_NAME: who, GIT_COMMITTER_EMAIL: email });
      const message = config.plugins.find(([plugin]) => plugin === '@semantic-release/git')[1].message;
      assert.equal(message, `chore(release): \${nextRelease.version}\n\n\${nextRelease.notes}\n\nSigned-off-by: ${who} <${email}>`);
    }
  }
});

test('actual semantic-release loader resolves the bundled default and every plugin', async (t) => {
  const { context } = fixture(t);
  const resolveConfig = await library('resolve-config.js');
  const { options, plugins } = await resolveConfig(
    context,
    { extends: [path.join(root, 'fallback-config.cjs')] },
    { buildPlugins: true }
  );
  assert.deepEqual(options.branches, ['main', { name: 'rc', prerelease: 'rc' }]);
  assert.equal(options.plugins.length, 6);
  assert.equal(typeof plugins.prepare, 'function');
});

test('a consumer with only main remains a stable release branch', async (t) => {
  const { remote, context } = fixture(t);
  const getBranches = await library('branches/index.js');
  const getLastRelease = await library('get-last-release.js');
  const getNextVersion = await library('get-next-version.js');
  const options = { branches: load('fallback-config.cjs').branches, tagFormat: 'v${version}' };
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
  const options = { branches: load('fallback-config.cjs').branches, tagFormat: 'v${version}' };
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
  const config = load('fallback-config.cjs');
  const analyzer = config.plugins.find(([name]) => name === '@semantic-release/commit-analyzer')[1];
  const notes = config.plugins.find(([name]) => name === '@semantic-release/release-notes-generator')[1];
  assert.deepEqual(analyzer.releaseRules.find(({ type }) => type === 'refactor'), { type: 'refactor', release: 'patch' });
  assert.deepEqual(notes.presetConfig.types.find(({ type }) => type === 'refactor'), { type: 'refactor', section: 'Code Refactoring' });
});

test('default enables versioning only for complete manifest and lockfile pairs', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-detection-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (files) => {
    for (const file of ['pyproject.toml', 'uv.lock', 'package.json', 'package-lock.json']) {
      try { require('node:fs').unlinkSync(path.join(dir, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const file of files) writeFileSync(path.join(dir, file), file === 'package.json' ? '{}\n' : '');
    return JSON.parse(execFileSync(process.execPath, ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(path.join(root, 'fallback-config.cjs'))})))`], {
      cwd: dir, env, encoding: 'utf8'
    }));
  };
  for (const [files, python, npm] of [
    [[], false, false],
    [['pyproject.toml'], false, false],
    [['package.json'], false, false],
    [['pyproject.toml', 'uv.lock'], true, false],
    [['package.json', 'package-lock.json'], false, true],
    [['pyproject.toml', 'uv.lock', 'package.json', 'package-lock.json'], true, true]
  ]) {
    const config = run(files);
    const names = config.plugins.map(([name]) => name);
    assert.equal(names.includes('@semantic-release/exec'), python);
    assert.equal(names.includes('@semantic-release/npm'), npm);
    const assets = config.plugins.find(([name]) => name === '@semantic-release/git')[1].assets;
    assert.deepEqual(assets, ['CHANGELOG.md',
      ...(python ? ['pyproject.toml', 'uv.lock'] : []),
      ...(npm ? ['package.json', 'package-lock.json'] : [])
    ]);
    if (python) assert.equal(config.plugins.find(([name]) => name === '@semantic-release/exec')[1].prepareCmd, 'uv version --no-sync "${nextRelease.version}"');
    if (npm) assert.equal(config.plugins.find(([name]) => name === '@semantic-release/npm')[1].npmPublish, false);
  }
});

/*
 * Exercise the real CLI, Git remote, commit analyzer and notes generator.
 * Only network-dependent publishing plugins are omitted: dry runs must not
 * attempt to contact GitHub or create releases.
 */
for (const { branch, message, footer, expected, heading } of [
  { branch: 'main', message: 'refactor: simplify API', expected: '1.2.4', heading: 'Code Refactoring' },
  { branch: 'main', message: 'feat: add capability', expected: '1.3.0', heading: 'Features' },
  { branch: 'main', message: 'build(deps): bump package', expected: null },
  { branch: 'rc', message: 'feat!: change API', footer: 'BREAKING CHANGE: remove old API', expected: '2.0.0-rc.1', heading: 'BREAKING CHANGES' },
]) {
  test(`real semantic-release dry-run on ${branch} for ${message}`, (t) => {
    const { cwd, remote } = fixture(t);
    if (branch !== 'main') git(cwd, 'switch', '-c', branch);

    // Inherit the actual bundled policy, rather than duplicating its rules.
    // Exclude only plugins that modify files, publish to GitHub, or require credentials.
    const localConfig = [
      `const policy = require(${JSON.stringify(path.join(root, 'fallback-config.cjs'))});`,
      `module.exports = { ...policy, repositoryUrl: ${JSON.stringify(pathToFileURL(remote).href)},`,
      "  plugins: policy.plugins.filter(([name]) => ['@semantic-release/commit-analyzer', '@semantic-release/release-notes-generator'].includes(name)) };",
    ].join('\n');
    writeFileSync(path.join(cwd, '.releaserc.cjs'), localConfig);
    writeFileSync(path.join(cwd, 'README.md'), 'updated fixture\n');
    git(cwd, 'add', '.');
    git(cwd, 'commit', '-m', message, ...(footer ? ['-m', footer] : []));
    git(cwd, 'push', 'origin', branch);

    const result = spawnSync('/bin/sh', [path.join(root, 'semantic-release.sh'), '--dry-run', '--no-ci'], {
      cwd,
      encoding: 'utf8',
      env: {
        ...env,
        PATH: `${path.join(root, 'node_modules', '.bin')}:${process.env.PATH}`,
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: `refs/heads/${branch}`,
        GITHUB_SHA: git(cwd, 'rev-parse', 'HEAD'),
      },
    });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    if (expected) {
      assert.ok(output.includes(`Release ${expected} would be published`), output);
      assert.ok(output.includes(heading), output);
      assert.equal(git(cwd, 'ls-remote', '--tags', 'origin', `refs/tags/v${expected}`), '');
    } else {
      assert.ok(output.includes('There are no relevant changes, so no new version is released.'), output);
    }
  });
}

/*
 * Integration tests for the actual fallback path with an installed CLI.
 * A previous regression made --extends load semantic-release's built-in
 * npm plugin even for Python-only repositories. These verify the plugins
 * selected by the real executable, not a mocked CLI or the config object.
 */
for (const { kind, files, expected, excluded } of [
  {
    kind: 'Python/uv',
    files: {
      'pyproject.toml': '[project]\nname = "fixture-python"\nversion = "1.2.3"\n',
      'uv.lock': 'version = 1\nrequires-python = ">=3.14"\n',
    },
    expected: ['@semantic-release/exec'],
    excluded: ['@semantic-release/npm'],
  },
  {
    kind: 'npm',
    files: {
      'package.json': JSON.stringify({ name: 'fixture-npm', version: '1.2.3', private: true }),
      'package-lock.json': JSON.stringify({
        name: 'fixture-npm', version: '1.2.3', lockfileVersion: 3,
        requires: true, packages: { '': { name: 'fixture-npm', version: '1.2.3' } },
      }),
    },
    expected: ['@semantic-release/npm'],
    excluded: ['@semantic-release/exec'],
  },
]) {
  test('real fallback CLI loads the correct plugins for ' + kind, (t) => {
    const { cwd } = fixture(t);
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(cwd, name), content);
    }
    git(cwd, 'add', '.');
    git(cwd, 'commit', '-m', 'chore: add project manifests');

    // An unconfigured branch makes semantic-release exit after loading and
    // resolving the actual plugins, without any GitHub API calls or publishing.
    const result = spawnSync('/bin/sh', [path.join(root, 'semantic-release.sh'), '--dry-run'], {
      cwd,
      encoding: 'utf8',
      env: {
        ...env,
        PATH: [path.join(root, 'node_modules', '.bin'), process.env.PATH].join(':'),
        CI: 'true',
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/validation',
        GITHUB_SHA: git(cwd, 'rev-parse', 'HEAD'),
      },
    });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 0, output);
    assert.match(output, /No local semantic-release configuration found, using default/);
    for (const plugin of [
      '@semantic-release/commit-analyzer',
      '@semantic-release/release-notes-generator',
      '@semantic-release/changelog',
      '@semantic-release/git',
      '@semantic-release/github',
      ...expected,
    ]) {
      assert.ok(output.includes('from "' + plugin + '"'), output);
    }
    for (const plugin of excluded) {
      assert.ok(!output.includes('from "' + plugin + '"'), output);
    }
    assert.ok(output.includes('configured to only publish from'), output);
  });
}
