# Semantic Release

A minimal Docker image for running semantic-release in CI environments with GitHub support. Designed specifically for projects using conventional commits standard.

## What's inside

- Node.js (slim)
- git-core and CA certificates
- semantic-release and plugins
- uv for Python project versioning
- Built-in configuration for conventional commits
- Dependencies managed via package.json with package-lock.json for reproducibility

## Usage

### GitHub Actions example

```yaml
name: Release
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Semantic release dry run
        uses: docker://<your-registry>/semantic-release:latest
        with:
          args: --dry-run

  release:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Semantic release
        uses: docker://<your-registry>/semantic-release:latest
```

## Environment variables

The image automatically uses `GITHUB_TOKEN` from GitHub Actions context. No additional setup required.

Authors, committers, and annotated taggers for generated release changes default
to `github-actions[bot]` (`41898282+github-actions[bot]@users.noreply.github.com`).
These defaults apply inside the release container; they do not change the authors
of existing commits or host-side rebases.

Optional overrides:

- GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL
- GIT_COMMITTER_NAME / GIT_COMMITTER_EMAIL

## Configuration

Create a `.releaserc` (JSON or YAML) or `release` field in `package.json`.

The wrapper also recognizes `.releaserc.{json,yaml,yml,js,ts,cjs,mjs}`,
`.config/releaserc` (with the same optional extensions), and
`release.config.{js,ts,cjs,mjs}`, matching semantic-release's configuration loader.
TypeScript configurations require the loader's optional `typescript` dependency.
Only the top-level `release` property in `package.json` counts as configuration;
an npm `scripts.release` entry does not.

When no local configuration is found, the wrapper prints
`No local semantic-release configuration found, using default` and runs
`semantic-release --extends /opt/semantic-release/default.releaserc.cjs`, followed
by the original arguments. It does not write a configuration file into the
project. When local configuration exists, the original arguments are passed
without adding `--extends`.

Example `.releaserc`:

```json
{
  "branches": ["main"],
  "plugins": [
    ["@semantic-release/commit-analyzer", {
      "preset": "conventionalcommits",
      "releaseRules": [
        { "type": "feat", "release": "minor" },
        { "type": "fix", "release": "patch" },
        { "type": "perf", "release": "patch" },
        { "type": "revert", "release": "patch" },
        { "type": "refactor", "release": "patch" },
        { "type": "docs", "release": false },
        { "type": "style", "release": false },
        { "type": "test", "release": false },
        { "type": "build", "release": false },
        { "type": "ci", "release": false },
        { "type": "chore", "release": false }
      ]
    }],
    ["@semantic-release/release-notes-generator", { "preset": "conventionalcommits" }],
    ["@semantic-release/github", {}]
  ]
}
```

### Automatic package versioning

When no local semantic-release configuration is present, the bundled policy
updates package versions automatically based on files at the project root:

- `pyproject.toml` and `uv.lock`: `uv version --no-sync` updates both files.
- `package.json` and `package-lock.json`: `@semantic-release/npm` updates
  both files with `npmPublish: false` (no registry publication).
- Both pairs: both version updates run.
- Neither pair: only the changelog and GitHub release are generated.

The changed manifests and lockfiles are included in the release commit.
Versions on the `rc` branch are prereleases; `main` produces stable releases.
A local semantic-release configuration overrides this default behavior.

## Troubleshooting

- Missing credentials: Verify `GITHUB_TOKEN` is set and valid.
- Detached HEAD or shallow clone: Ensure Git fetch depth > 0 to allow semantic-release to read tags (set `fetch-depth: 0`).
- No releases on non-default branches: Verify `branches` configuration matches your flow.

## Security notes

- Image is based on `node:slim`.
- Package cache is cleaned during build.
- Dependencies are installed locally in `/opt/semantic-release` with exact versions from package-lock.json.
- Keep tokens scoped minimally and rotate regularly.

## Release policies

The bundled `default.releaserc.cjs` produces stable releases from `main` and
supports an optional `rc` branch for `rc` prereleases. A `release` branch
is not required. Projects without a local release configuration use this
default through the entrypoint's conditional `--extends`.

This image repository uses the same default policy instead of maintaining
a separate root `.releaserc.cjs`. Its test workflow copies the default
configuration to a local file for tests. The existing semantic workflow
is intentionally unchanged during the migration: stable releases now
originate from `main`, while automatic `rc` releases are not yet enabled.

Other projects can override the default through their own local
configuration. The bundled policy retains the shared release rules,
plugins and dynamic Git committer sign-off.

<!-- refactor: deps -->
