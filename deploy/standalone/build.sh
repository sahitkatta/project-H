#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
docker build -f deploy/standalone/Dockerfile -t projecth-app:local .
echo "Built projecth-app:local"
