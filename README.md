# Semantic Release

A minimal Docker image for running semantic-release in CI environments with GitHub support. Designed specifically for projects using conventional commits standard.

## What's inside

- Node.js (slim)
- semantic-release and plugins
- git-core and CA certificates
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

Optional:

- GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL
- GIT_COMMITTER_NAME / GIT_COMMITTER_EMAIL

## Configuration

Create a `.releaserc` (JSON or YAML) or `release` field in `package.json`.

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

## Troubleshooting

- Missing credentials: Verify `GITHUB_TOKEN` is set and valid.
- Detached HEAD or shallow clone: Ensure Git fetch depth > 0 to allow semantic-release to read tags (set `fetch-depth: 0`).
- No releases on non-default branches: Verify `branches` configuration matches your flow.

## Security notes

- Image is based on `node:22-slim`.
- Package cache is cleaned during build.
- Dependencies are installed locally in `/opt/semantic-release` with exact versions from package-lock.json.
- Keep tokens scoped minimally and rotate regularly.
