const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } = require('node:fs');
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
  const fakeBin = path.join(dir, 'bin');
  mkdirSync(fakeBin);
  // Unit-test shim for the uv executable: the Docker image uses real uv.
  const uvShim = [
    '#!/usr/bin/env node',
    "const fs = require('node:fs');",
    'const [command, noSync, version] = process.argv.slice(2);',
    "if (command !== 'version' || noSync !== '--no-sync' || !version) process.exit(2);",
    "const p = fs.readFileSync('pyproject.toml', 'utf8');",
    "fs.writeFileSync('pyproject.toml', p.replace(/version = \"[^\"]+\"/, 'version = \"' + version + '\"'));",
    "fs.appendFileSync('uv.lock', '\\n# version ' + version + '\\n');",
  ].join('\n') + '\n';
  writeFileSync(path.join(fakeBin, 'uv'), uvShim, { mode: 0o755 });
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
    mkdirSync(path.dirname(path.join(cwd, name)), { recursive: true });
    writeFileSync(path.join(cwd, name), content);
  }
  writeFileSync(path.join(cwd, 'README.md'), 'updated\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-m', message);
  // Emulate actions/checkout on a PR: the checkout is a synthetic merge
  // containing the target branch and the proposed changes.
  git(cwd, 'switch', '-c', 'pr-merge', 'origin/' + baseBranch);
  git(cwd, 'merge', '--no-ff', 'topic', '-m', 'Merge pull request #123');
  const originalMain = git(cwd, 'ls-remote', 'origin', 'refs/heads/main');
  const originalRc = baseBranch === 'rc' ? git(cwd, 'ls-remote', 'origin', 'refs/heads/rc') : '';
  const originalTags = git(cwd, 'ls-remote', '--tags', 'origin');
  const baseline = git(cwd, 'rev-parse', 'HEAD');
  return {
    cwd,
    run(base = 'main') {
      const result = spawnSync(process.execPath, [
        path.join(root, 'fallback-runner.mjs'), '--validate', '--base-branch', base,
        '--diff-output', 'validation-artifacts/release.diff'
      ], {
        cwd, env: { ...env, PATH: fakeBin + ':' + path.join(root, 'node_modules', '.bin') + ':' + process.env.PATH },
        encoding: 'utf8', timeout: 30000,
      });
      // Local commits and tags are expected. The real remote must be unchanged.
      assert.equal(git(cwd, 'ls-remote', 'origin', 'refs/heads/main'), originalMain);
      if (originalRc) assert.equal(git(cwd, 'ls-remote', 'origin', 'refs/heads/rc'), originalRc);
      assert.equal(git(cwd, 'ls-remote', '--tags', 'origin'), originalTags);
      const artifact = readFileSync(path.join(cwd, 'validation-artifacts', 'release.diff'), 'utf8');
      return {
        ...result, output: result.stdout + result.stderr,
        diff: artifact,
        tags: ((result.stdout + result.stderr).match(/Created tags: ([^\n]*)/)?.[1] ?? ''),
        baseline, head: git(cwd, 'rev-parse', 'HEAD'),
      };
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
  assert.match(result.output, /Active plugins:.*@semantic-release\/exec/);
  assert.match(result.output, /Active plugins:.*@semantic-release\/github/);
  assert.doesNotMatch(result.output, /Start step "publish"|Start step "addChannel"|Start step "success"/);
  assert.doesNotMatch(result.output, /Active plugins:.*@semantic-release\/npm/);
  assert.match(result.output, /Created tags: v1\.2\.4/);
  assert.match(result.output, /Completed step "prepare" of plugin "@semantic-release\/exec"/);
  assert.match(result.output, /Validation passed/);
  assert.match(result.diff, /pyproject\.toml/);
  assert.match(result.diff, /1\.2\.4/);
  assert.match(result.diff, /CHANGELOG\.md/);
  assert.equal(result.head, result.baseline); // Validation runs in an isolated checkout.
  assert.match(result.tags, /v1\.2\.4/);
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
  assert.match(result.output, /Active plugins:.*@semantic-release\/npm/);
  assert.doesNotMatch(result.output, /Active plugins:.*@semantic-release\/exec/);
  assert.doesNotMatch(result.output, /Start step "verifyConditions"/);
  assert.match(result.output, /Created tags: v1\.2\.4/);
  assert.match(result.output, /Completed step "prepare" of plugin "@semantic-release\/npm"/);
  assert.match(result.diff, /package\.json/);
  assert.match(result.diff, /1\.2\.4/);
  assert.match(result.tags, /v1\.2\.4/);
});

test('PR validation uses upstream prerelease computation on rc with actual tag history', (t) => {
  const f = fixture(t, {}, 'feat: new prerelease feature', 'rc');
  const result = f.run('rc');
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Run automated release from branch rc/);
  assert.match(result.output, /Found git tag v1\.2\.3 associated with version 1\.2\.3/);
  assert.match(result.output, /Created tags: v1\.3\.0-rc\.1/);
  assert.match(result.output, /Validation passed/);
  assert.match(result.tags, /v1\.3\.0-rc\.1/);
  assert.match(result.diff, /CHANGELOG\.md/);
});

test('PR validation fails rather than inventing a release for malformed tags', (t) => {
  const f = fixture(t, { '.releaserc.cjs': "module.exports = { branches: ['main'], tagFormat: 'invalid', plugins: ['@semantic-release/commit-analyzer'] };\n" });
  const result = f.run();
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /ETAGNOVERSION|EINVALIDTAGFORMAT/);
});

test('PR validation honors a project-specific prepare override and captures its diff', (t) => {
  const localPolicy = [
    'module.exports = {',
    "  branches: ['main'],",
    '  plugins: [',
    "    '@semantic-release/commit-analyzer',",
    "    ['@semantic-release/exec', { prepareCmd: 'printf configured > custom-prepared.txt' }],",
    "    ['@semantic-release/git', { assets: ['custom-prepared.txt'] }],",
    '  ],',
    '};',
    '',
  ].join('\n');
  const f = fixture(t, { '.releaserc.cjs': localPolicy });
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Completed step "prepare" of plugin "@semantic-release\/exec"/);
  assert.match(result.diff, /custom-prepared\.txt/);
  assert.match(result.diff, /configured/);
  assert.match(result.tags, /v1\.2\.4/);
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
  assert.match(result.output, /Created tags: none/);
  assert.match(result.diff, /No local changes were produced/);
  const wrongBranch = f.run('rc');
  assert.notEqual(wrongBranch.status, 0, wrongBranch.output);
  assert.doesNotMatch(wrongBranch.output, /Validation passed/);
});

test('validation preserves inline plugin functions and skips publishing and credential checks', (t) => {
  const policy = [
    "const fs = require('node:fs');",
    'module.exports = {',
    "  branches: ['main'],",
    '  plugins: [{',
    "    verifyConditions: () => { throw new Error('verifyConditions must be skipped'); },",
    "    analyzeCommits: () => 'patch',",
    "    prepare: () => fs.writeFileSync('inline-prepared.txt', 'inline plugin worked\\n'),",
    "    publish: () => { throw new Error('publish must be skipped'); },",
    "    addChannel: () => { throw new Error('addChannel must be skipped'); },",
    "    success: () => { throw new Error('success must be skipped'); },",
    "    fail: () => { throw new Error('fail must be skipped'); },",
    '  }],',
    '};',
    '',
  ].join('\n');
  const f = fixture(t, { '.releaserc.cjs': policy });
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /Created tags: v1\.2\.4/);
  assert.match(result.diff, /inline-prepared\.txt/);
  assert.match(result.diff, /inline plugin worked/);
  assert.doesNotMatch(result.output, /must be skipped/);
});

test('validation resolves a plugin relative to its shareable configuration', (t) => {
  const f = fixture(t, {
    '.releaserc.cjs': [
      "module.exports = { extends: './shared/config.cjs', plugins: ['shared-only-plugin'] };",
      '',
    ].join('\n'),
    'shared/config.cjs': [
      'module.exports = {',
      "  branches: ['main'],",
      "  plugins: ['shared-only-plugin'],",
      '};',
      '',
    ].join('\n'),
    'shared/node_modules/shared-only-plugin/index.js': [
      'module.exports = {',
      "  analyzeCommits: () => 'patch',",
      "  prepare: () => require('node:fs').writeFileSync('extended.txt', 'from extends\\n'),",
      '};',
      '',
    ].join('\n'),
  });
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.match(result.diff, /extended\.txt/);
  assert.match(result.diff, /from extends/);
  assert.match(result.tags, /v1\.2\.4/);
});

test('validation rejects CLI overrides that could bypass the local-only policy', (t) => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [
    path.join(root, 'fallback-runner.mjs'),
    '--validate', '--base-branch', 'main', '--repository-url', 'https://example.invalid/repo',
  ], { cwd: f.cwd, env, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Validation accepts only/);
});

test('project JavaScript configuration executes only inside the isolated checkout', (t) => {
  const f = fixture(t, {
    '.releaserc.cjs': [
      "require('node:fs').writeFileSync('config-side-effect.txt', 'executed in clone\\n');",
      "module.exports = { branches: ['main'], plugins: ['@semantic-release/commit-analyzer'] };",
    ].join('\n') + '\n',
  });
  const result = f.run();
  assert.equal(result.status, 0, result.output);
  assert.equal(existsSync(path.join(f.cwd, 'config-side-effect.txt')), false);
  assert.match(result.diff, /config-side-effect\.txt/);
});

test('validation invokes verifyRelease and propagates its error', (t) => {
  const f = fixture(t, {
    '.releaserc.cjs': [
      'module.exports = {',
      "  branches: ['main'],",
      '  plugins: [{',
      "    analyzeCommits: () => 'patch',",
      "    verifyRelease: () => { throw new Error('verifyRelease probe'); },",
      "    prepare: () => require('node:fs').writeFileSync('should-not-exist.txt', 'bad'),",
      '  }],',
      '};',
      '',
    ].join('\n'),
  });
  const result = f.run();
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /verifyRelease probe/);
  assert.doesNotMatch(result.diff, /should-not-exist\.txt/);
});

test('validation captures partial prepare changes even when prepare fails', (t) => {
  const f = fixture(t, {
    '.releaserc.cjs': [
      'module.exports = {',
      "  branches: ['main'],",
      '  plugins: [{',
      "    analyzeCommits: () => 'patch',",
      '    prepare: () => {',
      "      require('node:fs').writeFileSync('partial-prepared.txt', 'partial changes\\n');",
      "      throw new Error('intentional prepare failure');",
      '    },',
      '  }],',
      '};',
      '',
    ].join('\n'),
  });
  const result = f.run();
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /intentional prepare failure/);
  assert.match(result.diff, /partial-prepared\.txt/);
  assert.match(result.diff, /partial changes/);
  assert.equal(result.head, result.baseline);
});
