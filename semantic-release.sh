#!/usr/bin/env sh
set -eu

git log -1 --oneline

# Make bundled plugins available to custom prepare commands.
export NODE_PATH="/opt/semantic-release/node_modules:${NODE_PATH:-}"

exec node "$(dirname "$0")/fallback-runner.mjs" "$@"
