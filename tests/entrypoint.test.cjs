const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, chmodSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const wrapper = path.join(root, 'semantic-release.sh');
const defaultConfig = '/opt/semantic-release/default.releaserc.cjs';
const message = 'No local semantic-release configuration found, using default';
// Resolve the loader from semantic-release, including if npm stops hoisting it.
const releaseRequire = createRequire(require.resolve('semantic-release'));
const { getDefaultSearchPlaces } = releaseRequire('cosmiconfig/dist/defaults.js');
const { cosmiconfig } = releaseRequire('cosmiconfig');
const searchPlaces = getDefaultSearchPlaces('release');

function fixture(t, files = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'release-entrypoint-'));
  const cwd = path.join(dir, 'project');
  const bin = path.join(dir, 'bin');
  const capture = path.join(dir, 'capture.json');
  mkdirSync(cwd);
  mkdirSync(bin);
  t.after(() => {
    chmodSync(cwd, 0o755);
    rmSync(dir, { recursive: true, force: true });
  });
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(cwd, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  writeFileSync(path.join(bin, 'git'), '#!/bin/sh\nexit "${GIT_STATUS:-0}"\n', { mode: 0o755 });
  writeFileSync(path.join(bin, 'semantic-release'), `#!${process.execPath}
require('node:fs').writeFileSync(process.env.CAPTURE, JSON.stringify({
  args: process.argv.slice(2), nodePath: process.env.NODE_PATH
}));
process.exit(Number(process.env.RELEASE_STATUS || 0));
`, { mode: 0o755 });
  return {
    cwd,
    run(args = [], overrides = {}) {
      const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, CAPTURE: capture };
      delete env.NODE_PATH;
      Object.assign(env, overrides);
      const result = spawnSync('/bin/sh', [wrapper, ...args], { cwd, env, encoding: 'utf8' });
      return { ...result, invocation: result.status === Number(env.RELEASE_STATUS || 0)
        ? JSON.parse(readFileSync(capture, 'utf8')) : undefined };
    },
  };
}

function assertInvocation(result, args, fallback) {
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.invocation.args, fallback ? ['--extends', defaultConfig, ...args] : args);
  assert.equal(result.stdout, fallback ? `${message}\n` : '');
  assert.equal(result.stderr, '');
  assert.equal(result.invocation.nodePath, '/opt/semantic-release/node_modules:');
}

// The expected list comes from the installed upstream loader: dependency updates
// that introduce another search place must also be handled by the wrapper.
for (const name of searchPlaces.filter((name) => name !== 'package.json')) {
  test(`local configuration: ${name}`, async (t) => {
    const extension = path.extname(name);
    const content = ['.js', '.cjs'].includes(extension) ? 'module.exports = {plugins: []};'
      : ['.mjs', '.ts'].includes(extension) ? 'export default {plugins: []};'
      : '{"plugins": []}';
    const f = fixture(t, { [name]: content });
    assertInvocation(f.run(['--dry-run']), ['--dry-run'], false);
    // TypeScript needs an optional dependency not installed in the image.
    if (extension !== '.ts') {
      const found = await cosmiconfig('release', { searchStrategy: 'none' }).search(f.cwd);
      assert.equal(found.filepath, path.join(f.cwd, name));
      assert.deepEqual(found.config, { plugins: [] });
    }
  });
}

for (const [label, pkg, fallback] of [
  ['release object', { release: { plugins: [] } }, false],
  ['empty release object', { release: {} }, false],
  ['false release value', { release: false }, false],
  ['empty release string', { release: '' }, false],
  ['zero release value', { release: 0 }, false],
  ['null release value', { release: null }, true],
  ['no release field', { name: 'fixture' }, true],
  ['npm release script', { scripts: { release: 'semantic-release' } }, true],
  ['nested release property', { metadata: { release: {} } }, true],
  ['release word in string', { description: 'release' }, true],
]) {
  test(`package.json: ${label}`, async (t) => {
    const f = fixture(t, { 'package.json': JSON.stringify(pkg) });
    assertInvocation(f.run(), [], fallback);
    const found = await cosmiconfig('release', { searchStrategy: 'none' }).search(f.cwd);
    assert.equal(found === null, fallback);
  });
}

test('fallback preserves every argument and leaves a read-only project untouched', (t) => {
  const f = fixture(t, { 'README.md': 'fixture\n' });
  const args = ['--dry-run', '--tag-format', 'release ${version} *', '--extends', './custom config.cjs', '', '--', 'literal'];
  chmodSync(f.cwd, 0o555);
  assertInvocation(f.run(args), args, true);
  assert.deepEqual(readdirSync(f.cwd), ['README.md']);
  assert.equal(readFileSync(path.join(f.cwd, 'README.md'), 'utf8'), 'fixture\n');
});

test('local configuration preserves explicit extends and original contents', (t) => {
  const content = 'module.exports = {extends: "./shared.cjs"};\n';
  const f = fixture(t, { '.releaserc.cjs': content });
  const args = ['--extends', './cli config.cjs', '--dry-run', ''];
  assertInvocation(f.run(args), args, false);
  assert.equal(readFileSync(path.join(f.cwd, '.releaserc.cjs'), 'utf8'), content);
});

test('an unrelated package.json does not hide a local config', (t) => {
  const f = fixture(t, { 'package.json': '{"scripts":{"release":"echo release"}}', 'release.config.mjs': 'export default {};' });
  assertInvocation(f.run(), [], false);
});

test('a directory named like a config is not a config file', (t) => {
  const f = fixture(t);
  mkdirSync(path.join(f.cwd, '.releaserc.cjs'));
  assertInvocation(f.run(), [], true);
});

test('malformed package.json cannot cause a false positive from text matching', (t) => {
  const f = fixture(t, { 'package.json': '{"release":' });
  assertInvocation(f.run(), [], true);
});

test('preserves NODE_PATH and propagates semantic-release exit status', (t) => {
  const f = fixture(t);
  const result = f.run([], { NODE_PATH: '/custom modules:/another', RELEASE_STATUS: '23' });
  assert.equal(result.status, 23);
  assert.equal(result.invocation.nodePath, '/opt/semantic-release/node_modules:/custom modules:/another');
});

test('git log failure still stops the wrapper', (t) => {
  const f = fixture(t);
  const result = f.run([], { GIT_STATUS: '17' });
  assert.equal(result.status, 17);
  assert.equal(result.invocation, undefined);
  assert.equal(result.stdout, '');
});
