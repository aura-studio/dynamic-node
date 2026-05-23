#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "${SCRIPT_DIR}/00-clean.sh"
bash "${SCRIPT_DIR}/01-smoke.sh"
bash "${SCRIPT_DIR}/02-static-register.sh"
bash "${SCRIPT_DIR}/03-local-bundle.sh"
bash "${SCRIPT_DIR}/04-local-full.sh"
bash "${SCRIPT_DIR}/05-namespace-default-version.sh"
bash "${SCRIPT_DIR}/06-validation-errors.sh"
bash "${SCRIPT_DIR}/07-tunnel-symbols.sh"

echo "all local dynamic-node example checks passed"
