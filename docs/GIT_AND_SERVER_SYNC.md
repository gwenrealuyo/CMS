# Git and Server Sync

How to pull updates from `main` on a self-hosted machine (e.g. Windows server) without committing machine-specific files to GitHub.

## Files that should stay local (not in Git)

These are listed in the root [`.gitignore`](../.gitignore):

| Path | Why |
|------|-----|
| `__pycache__/`, `*.pyc` | Python bytecode; recreated on each machine |
| `backend/.venv/`, `backend/venv/` | Virtual environment |
| `backend/staticfiles/` | Output of `collectstatic` — run on each deploy |
| `frontend/out/` | Output of `npm run build` |
| `frontend/node_modules/` | npm install |
| `.env`, `backend/.env` | Secrets and local config |
| `frontend/.env.production` | Production API URL (per server) |
| `docker-compose.override.yml` | Server-only Docker overrides |
| `backend/media/` | User uploads (unless you intentionally version seeds) |

`__pycache__` on Windows after running Django is normal — it is **not** synced from your Mac via Git unless it was accidentally committed. Delete anytime; Python recreates it.

## Server-only Docker changes (without committing)

### Recommended: `docker-compose.override.yml`

Docker Compose merges `docker-compose.yml` + `docker-compose.override.yml` automatically.

1. On the server, create `docker-compose.override.yml` next to `docker-compose.yml` (see [`docker-compose.override.yml.example`](../docker-compose.override.yml.example)).
2. Revert tracked compose if you edited it locally:

   ```powershell
   git checkout -- docker-compose.yml
   ```

3. Run `docker compose up -d db` as usual — override applies only on that machine.

The override file is **gitignored**; `git pull` updates `docker-compose.yml` and leaves your override in place.

### Alternative: environment variables in `.env`

For passwords, prefer `${POSTGRES_PASSWORD}` in compose and set values in a **gitignored** `.env` at the repo root (see example override file). Keep `DB_PASSWORD` in `backend/.env` in sync with Postgres.

### Alternative: `git update-index --skip-worktree`

If you already modified `docker-compose.yml` on the server and want Git to ignore local edits:

```powershell
git update-index --skip-worktree docker-compose.yml
```

Undo:

```powershell
git update-index --no-skip-worktree docker-compose.yml
```

Note: you will not receive upstream changes to that file until you clear skip-worktree and merge manually.

## Pulling updates and running migrations

When `main` includes new Django migration files:

```powershell
cd D:\path\to\CMS
git pull origin main

cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate --plan
python manage.py migrate
```

If `DEBUG=False` on the server:

```powershell
python manage.py collectstatic --noinput
```

Restart Waitress (see [WINDOWS_SELF_HOSTED.md](./WINDOWS_SELF_HOSTED.md)).

### Frontend

If the pull changed React code or API URL:

```powershell
cd frontend
# Ensure .env.production has correct NEXT_PUBLIC_API_URL
npm run build
```

Redeploy / restart whatever serves `frontend/out`.

### Database backup (recommended before large releases)

```powershell
docker exec cms-postgres pg_dump -U postgres church_management > backup_%date%.sql
```

### Do not reset the DB for normal updates

`migrate` applies new migrations to the existing database. Only remove Docker volumes if you intentionally want to **wipe all data**.

## Workflow summary

```text
Mac (dev)     → commit code + migrations → push to GitHub
Windows (prod) → git pull → migrate → collectstatic → rebuild frontend → restart Waitress
```

Use **one** clone path on the server; avoid running Django from two directories on the same port.

## Related docs

- [RUNBOOK.md](./RUNBOOK.md)
- [WINDOWS_SELF_HOSTED.md](./WINDOWS_SELF_HOSTED.md)
- [backend/POSTGRES_SETUP.md](../backend/POSTGRES_SETUP.md)
