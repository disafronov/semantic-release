# Semantic Release

A Docker image for running semantic-release in CI environments with GitHub support. Designed specifically for projects using conventional commits standard.

## What's inside

- Node.js (slim)
- git-core and CA certificates
- semantic-release and plugins
- uv for Python project versioning
- Built-in configuration for conventional commits
- Dependencies managed via package.json with package-lock.json for reproducibility

## Responsibilities

This repository provides a Docker image containing semantic-release, its plugins,
the `uv` executable, and a default release policy. It also has GitHub Actions
workflows for validating pull requests, creating releases, and publishing the
Docker image. The image itself does **not** publish packages to npm or PyPI.

- **Release policy:** analyzes conventional commits, updates supported project
  version files, writes `CHANGELOG.md` and a signed-off release commit, creates
  a version tag, and publishes a GitHub Release.
- **Semantic workflow:** runs a dry-run on pull requests to `main` or `rc`,
  and runs a release on pushes to those branches. After a release commit is
  pushed to `main`, it also attempts to rebase eligible open pull requests.
- **Docker workflow (this repository):** builds and publishes a multi-platform
  image to GHCR on pull requests and version tags, then signs its digest with
  Cosign. This is separate from package publication in consumer repositories.

## Usage

### GitHub Actions

The [repository's semantic workflow](.github/workflows/semantic.yml) is the
maintained integration example. The abbreviated example below shows the key
requirements; it does not include the optional post-release rebase job.

```yaml
name: Semantic

on:
  pull_request:
    branches: [main, rc]
  push:
    branches: [main, rc]

jobs:
  validate:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - name: Semantic release dry run
        run: |
          docker run --rm \
            --user 1001 \
            -v "${{ github.workspace }}:/workspace" \
            -w /workspace \
            ghcr.io/disafronov/semantic-release:${{ vars.SEMANTIC_RELEASE_TAG || 'latest' }} \
            --dry-run

  release:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    env:
      GITHUB_TOKEN: ${{ secrets.SEMANTIC_RELEASE_TOKEN }}
    steps:
      - name: Validate release token
        run: |
          if [[ -z "$GITHUB_TOKEN" ]]; then
            echo "::error::SEMANTIC_RELEASE_TOKEN is required"
            exit 1
          fi
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
          token: ${{ env.GITHUB_TOKEN }}
      - name: Semantic release
        run: |
          docker run --rm \
            --user 1001 \
            -v "${{ github.workspace }}:/workspace" \
            -w /workspace \
            -e GITHUB_TOKEN \
            -e CI=true \
            ghcr.io/disafronov/semantic-release:${{ vars.SEMANTIC_RELEASE_TAG || 'latest' }}
```

The release job needs a repository secret named `SEMANTIC_RELEASE_TOKEN` with
permissions to push release commits and tags and create GitHub releases.
The workflow explicitly passes it as `GITHUB_TOKEN` to semantic-release;
the container does not obtain credentials from GitHub Actions automatically.
The token must also satisfy any applicable branch protection or ruleset
requirements. The example uses `latest` by default; set the
`SEMANTIC_RELEASE_TAG` repository variable to pin a specific image version.

A full Git history (`fetch-depth: 0`) is required to discover prior tags.
The `rc` branch is optional: the default policy uses it for prereleases only
when it exists.

## Environment variables

The image requires a `GITHUB_TOKEN` environment variable for authenticated GitHub releases. The calling workflow is responsible for providing it; see the example above.

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

The bundled policy is defined in [`default.releaserc.cjs`](default.releaserc.cjs).
A local configuration replaces the automatic fallback unless it explicitly
extends the bundled configuration. For example, a project can override the
release branches:

```json
{
  "branches": ["main"]
}
```

This minimal local configuration does **not** inherit the bundled plugin
pipeline. To keep the bundled policy, omit local configuration or explicitly
extend `/opt/semantic-release/default.releaserc.cjs` from a compatible
configuration file.

### Default commit types

| Commit type | Release |
| --- | --- |
| Breaking change | Major |
| `feat` | Minor |
| `fix`, `perf`, `revert`, `refactor` | Patch |
| `docs`, `style`, `test`, `build`, `ci`, `chore` | None |

The changelog includes sections for features, bug fixes, performance,
reverts, and refactors. Non-releasing types are hidden in generated notes.
The release commit has the form `chore(release): <version>` and includes a
DCO `Signed-off-by` trailer based on the configured Git committer.

### Automatic package versioning

When no local semantic-release configuration is present, the bundled policy
updates package versions automatically based on files at the project root:

- `pyproject.toml` and `uv.lock`: `uv version --no-sync` updates both files.
- `package.json` and `package-lock.json`: `@semantic-release/npm` updates
  both files with `npmPublish: false` (no registry publication).
- Both pairs: both version updates run.
- Neither pair: only the changelog and GitHub release are generated.

The changed manifests and lockfiles are included in the release commit.
Versions on the `rc` branch are prereleases (for example, `1.2.4-rc.1`); `main` produces stable releases. The policy generates a changelog, a release commit, a Git tag (default format `v<version>`), and a GitHub Release. It does not publish to a language package registry.
A local semantic-release configuration overrides this default behavior.

### Docker image publication\n\nThe [Docker workflow](.github/workflows/docker.yml) builds for `linux/amd64` and `linux/arm64`, publishes to GHCR, and signs the resulting image digest with Cosign. Pull requests receive PR-related tags; version tags must match `vMAJOR.MINOR.PATCH` or `vMAJOR.MINOR.PATCH-rc.N`. Only stable version tags receive `latest` and major/minor aliases; prereleases do not. Publishing the Docker image is independent of publishing packages from consuming projects.\n\n## Troubleshooting

- Missing credentials: Verify that the caller supplies `GITHUB_TOKEN` (the maintained workflow sources it from `SEMANTIC_RELEASE_TOKEN`) with adequate repository permissions.
- Detached HEAD or shallow clone: Use `fetch-depth: 0` to make the history and release tags available.
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
configuration to a local file for tests. The semantic workflow runs automatically on pushes to `main` and `rc`:
`main` publishes stable releases and `rc` publishes prereleases.

Other projects can override the default through their own local
configuration. The bundled policy retains the shared release rules,
plugins and dynamic Git committer sign-off.

