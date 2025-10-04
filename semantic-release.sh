#!/usr/bin/env sh

set -eu

git log -1 --oneline

has_local_config() {
  [ -f ".releaserc" ] || [ -f ".releaserc.json" ] || [ -f ".releaserc.yaml" ] || \
  [ -f ".releaserc.yml" ] || [ -f ".releaserc.js" ] || [ -f ".releaserc.cjs" ] || \
  [ -f "release.config.js" ] || [ -f "release.config.cjs" ] || \
  ( [ -f "package.json" ] && command -v jq >/dev/null 2>&1 && jq -e '.release' package.json >/dev/null 2>&1 ) || \
  ( [ -f "package.json" ] && grep -q '"release"' package.json )
}

if ! has_local_config; then
  echo "No local semantic-release configuration found, using default"
  cp /opt/semantic-release/default.releaserc.cjs .releaserc.cjs
fi

exec semantic-release "$@"
