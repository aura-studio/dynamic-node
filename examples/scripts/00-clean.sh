#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/common.sh"

rm -rf "${EXAMPLES_DIR}/.tmp"

echo "cleaned dynamic-node example artifacts"
