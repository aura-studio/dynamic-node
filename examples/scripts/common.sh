#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLES_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd -- "${EXAMPLES_DIR}/.." && pwd)"

export DYNAMIC_NODE_EXAMPLE_WAREHOUSE="${DYNAMIC_NODE_EXAMPLE_WAREHOUSE:-${EXAMPLES_DIR}/.tmp/warehouse}"

ensure_dependencies() {
	if [[ ! -d "${REPO_ROOT}/node_modules" ]]; then
		(
			cd "${REPO_ROOT}"
			npm install
		)
	fi
}

node_case() {
	node "${EXAMPLES_DIR}/cases/$1"
}

print_context() {
	echo "REPO_ROOT=${REPO_ROOT}"
	echo "EXAMPLES_DIR=${EXAMPLES_DIR}"
	echo "DYNAMIC_NODE_EXAMPLE_WAREHOUSE=${DYNAMIC_NODE_EXAMPLE_WAREHOUSE}"
}
