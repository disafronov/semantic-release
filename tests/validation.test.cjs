const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  GIT_ALLOW_PROTOCOL: 'file',
  GIT_AUTHOR_NAME: 'Validation Author',
  GIT_AUTHOR_EMAIL: 'author@example.invalid',
  GIT_COMMITTER_NAME: 'Validation Committer',
  GIT_COMMITTER_EMAIL: 'committer@example.invalid',
  CI: 'true',
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'pull_request',
  GITHUB_HEAD_REF: 'topic',
  GITHUB_BASE_REF: 'main',
  GITHUB_REF: 'refs/pull/123/merge',
};
delete env.GITHUB_TOKEN;
delete env.GH_TOKEN;
const git = (cwd, ...args) => execFileSync('git', args, {
  cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

function fixture(t, files = {}, message = 'fix: validate release policy', baseBranch = 'main') {
  const dir = mkdtempSync(path.join(tmpdir(), 'pr-validation-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const cwd = path.join(dir, 'project');
  const remote = path.join(dir, 'remote.git');
  mkdirSync(cwd);
  git(dir, 'init', '--bare', remote);
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(cwd, 'init', '-b', 'main');
  writeFileSync(path.join(cwd, 'README.md'), 'original\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', 'chore: initial');
  git(cwd, 'tag', 'v1.2.3');
  git(cwd, 'remote', 'add', 'origin', pathToFileURL(remote).href);
  git(cwd, 'push', 'origin', 'main');
  git(cwd, 'push', 'origin', '--tags');
  if (baseBranch === 'rc') {
    git(cwd, 'switch', '-c', 'rc');
    git(cwd, 'push', 'origin', 'rc');
  }
  git(cwd, 'fetch', 'origin', '+refs/heads/*:refs/remotes/origin/*');
  git(cwd, 'switch', '-c', 'topic', 'origin/' + baseBranch);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(cwd, name), content);
  }
  writeFileSync(path.join(cwd, 'README.md'), 'updated\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', message);
  // Emulate actions/checkout on a PR: the checkout is a synthetic merge
  // containing the target branch and the proposed changes.
  git(cwd, 'switch', '-c', 'pr-merge', 'origin/' + baseBranch);
  git(cwd, 'merge', '--no-ff', 'topic', '-m', 'Merge pull request #123');
  const initialStatus = git(cwd, 'status', '--porcelain');
  const initialTags = git(cwd, 'tag', '--list');
  return {
    run(base = 'main') {
      const result = spawnSync('/bin/sh', [path.join(root, 'semantic-release.sh'), '--validate', '--base-branch', base], {
        cwd, env: { ...env, PATH: path.join(root, 'node_modules', '.bin') + ':' + process.env.PATH },
        encoding: 'utf8', timeout: 30000,
      });
      assert.equal(git(cwd, 'status', '--porcelain'), initialStatus, 'validation modified working files');
      assert.equal(git(cwd, 'tag', '--list'), initialTags, 'validation created a release tag');
      assert.deepEqual(readdirSync(cwd).sort(), ['.git', ...Object.keys(files), 'README.md'].sort());
      return { ...result, output: result.stdout + result.stderr };
    },
  };
}

test('PR validation actually checks Python/uv plugins and analyzes a patch commit', (t) => {
  const f = fixture(t, {
    'pyproject.toml': '[project]\nname = "fixture-python"\nversion = "1.2.3"\n',
    'uv.lock': 'version = 1\nrequires-python = ">=3.14"\n',
  });
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /No local semantic-release configuration found, using default/);
  assert.match(result.output, /Configured plugins:.*@semantic-release\/exec/);
  assert.doesNotMatch(result.output, /Configured plugins:.*@semantic-release\/npm/);
  assert.match(result.output, /Next release: 1\.2\.4/);
  assert.match(result.output, /Validation passed/);
  assert.doesNotMatch(result.output, /configured to only publish from|triggered by a pull request/);
});

test('PR validation checks npm plugin without requiring npm or GitHub release tokens', (t) => {
  const f = fixture(t, {
    'package.json': JSON.stringify({ name: 'fixture-npm', version: '1.2.3', private: true }),
    'package-lock.json': JSON.stringify({
      name: 'fixture-npm', version: '1.2.3', lockfileVersion: 3,
      requires: true, packages: { '': { name: 'fixture-npm', version: '1.2.3' } },
    }),
  });
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Configured plugins:.*@semantic-release\/npm/);
  assert.doesNotMatch(result.output, /Configured plugins:.*@semantic-release\/exec/);
  assert.match(result.output, /Completed step "verifyConditions" of plugin "@semantic-release\/npm"/);
  assert.match(result.output, /Next release: 1\.2\.4/);
});

test('PR validation uses upstream prerelease computation on rc with actual tag history', (t) => {
  const f = fixture(t, {}, 'feat: new prerelease feature', 'rc');
  const result = f.run('rc');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Run automated release from branch rc/);
  assert.match(result.output, /Found git tag v1\.2\.3 associated with version 1\.2\.3/);
  assert.match(result.output, /Next release: 1\.3\.0-rc\.1/);
  assert.match(result.output, /Validation passed/);
});

test('PR validation fails rather than inventing a release for malformed tags', (t) => {
  const f = fixture(t, { '.releaserc.cjs': "module.exports = { branches: ['main'], tagFormat: 'invalid', plugins: ['@semantic-release/commit-analyzer'] };\\n" });
  const result = f.run();
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /ETAGNOVERSION|EINVALIDTAGFORMAT/);
});

test('PR validation fails for invalid npm configuration instead of returning green', (t) => {
  const f = fixture(t, {
    '.releaserc.cjs': 'module.exports = { branches: ["main"], plugins: [["@semantic-release/npm", { npmPublish: false }], "@semantic-release/commit-analyzer"] };\n',
  });
  const result = f.run();
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /package\.json|ENOPKG/);
  assert.doesNotMatch(result.output, /Validation passed/);
});

test('PR validation checks non-releasing changes and rejects absent target branches', (t) => {
  const f = fixture(t, {}, 'chore: update pipeline');
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Next release: none/);
  const wrongBranch = f.run('rc');
  assert.notEqual(wrongBranch.status, 0, wrongBranch.output);
  assert.doesNotMatch(wrongBranch.output, /Validation passed/);
});
