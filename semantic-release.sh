#!/usr/bin/env sh

set -eu

git log -1 --oneline

has_local_config() {
  # Match the search places used by semantic-release's cosmiconfig loader.
  for config in \
    .releaserc .releaserc.json .releaserc.yaml .releaserc.yml \
    .releaserc.js .releaserc.ts .releaserc.cjs .releaserc.mjs \
    .config/releaserc .config/releaserc.json .config/releaserc.yaml .config/releaserc.yml \
    .config/releaserc.js .config/releaserc.ts .config/releaserc.cjs .config/releaserc.mjs \
    release.config.js release.config.ts release.config.cjs release.config.mjs
  do
    if [ -f "$config" ]; then
      return 0
    fi
  done

  # A scripts.release entry is not a release configuration. Like cosmiconfig,
  # treat a missing or null top-level release property as absent.
  [ -f package.json ] && node -e '
    const fs = require("node:fs");
    try {
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      process.exit(pkg?.release == null ? 1 : 0);
    } catch {
      // Let semantic-release report malformed package.json files itself.
      process.exit(1);
    }
  '
}

if ! has_local_config; then
  echo "No local semantic-release configuration found, using default"
  set -- --extends /opt/semantic-release/default.releaserc.cjs "$@"
fi

# Set NODE_PATH to allow Node.js scripts to find modules from the image
# This is needed for scripts executed via @semantic-release/exec plugin
export NODE_PATH="/opt/semantic-release/node_modules:${NODE_PATH:-}"

exec semantic-release "$@"
