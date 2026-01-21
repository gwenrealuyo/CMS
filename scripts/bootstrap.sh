#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  else
    COMPOSE_CMD=(docker-compose)
  fi

  "${COMPOSE_CMD[@]}" up -d db
else
  echo "Docker not found. Install Docker Desktop to run Postgres via docker-compose."
  exit 1
fi

cd "${ROOT_DIR}/backend"

if [ ! -f .env ]; then
  cp env.example .env
fi

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate

cd "${ROOT_DIR}/frontend"
npm install

echo "Bootstrap complete."
echo "Backend: cd backend && source .venv/bin/activate && python manage.py runserver"
echo "Frontend: cd frontend && npm run dev"
