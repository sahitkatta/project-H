#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
docker build -f deploy/standalone/Dockerfile.frontend -t projecth-frontend:local .
docker build -f deploy/standalone/Dockerfile -t projecth-app:local .
echo "Built projecth-frontend:local and projecth-app:local"
