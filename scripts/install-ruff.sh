#!/usr/bin/env bash
set -euo pipefail

version=0.17.2
installer_sha256=6f95de2ce275883c0f5a314596ba5d79efbc79fc9ae52913f0d0e48e0a778887
installer=$(mktemp)
trap 'rm -f "$installer"' EXIT

curl --fail --silent --show-error --location \
  "https://astral.sh/ruff/$version/install.sh" --output "$installer"
printf '%s  %s\n' "$installer_sha256" "$installer" | sha256sum --check --status
RUFF_UNMANAGED_INSTALL="$PWD/node_modules/.bin" sh "$installer"
"$PWD/node_modules/.bin/ruff" --version
