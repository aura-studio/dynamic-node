#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/99-run-all-local.sh"
bash "${SCRIPT_DIR}/08-remote-s3.sh"

echo "all dynamic-node example checks passed"
