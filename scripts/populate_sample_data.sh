#!/usr/bin/env bash
# Seed dev sample data (people, clusters, evangelism) with schema sync.
# Usage: ./scripts/populate_sample_data.sh [--reset] [extra args for populate_dev_sample_data]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}/backend"

if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

exec python manage.py populate_dev_sample_data "$@"
