# Local Development Runbook

Getting the CMS running from scratch on a new machine. For **Windows production** (Cloudflare, Waitress), see [WINDOWS_SELF_HOSTED.md](./WINDOWS_SELF_HOSTED.md). For **Render**, see [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md). For **git pull / server-only config**, see [GIT_AND_SERVER_SYNC.md](./GIT_AND_SERVER_SYNC.md).

## Prereqs

- **Python 3.11 or 3.12** (64-bit recommended; 3.9+ may work — avoid very new versions such as 3.13+ until dependencies publish wheels)
- **Node.js 18+**
- **Docker Desktop** (recommended for Postgres) — see [Do you need Docker?](#do-you-need-docker)

**macOS:**

- `brew install python@3.11 node@18`
- Docker Desktop: https://www.docker.com/products/docker-desktop/

**Windows:**

- `winget install Python.Python.3.12 OpenJS.NodeJS.LTS Docker.DockerDesktop`
- Use `py -3.12` if multiple Python versions are installed

## Do you need Docker?

- **Docker is not mandatory** — you need a **running PostgreSQL** instance. Docker is the documented way to get one locally (`docker compose up -d db`).
- **Alternative:** native Postgres; set `backend/.env` to match. See [backend/POSTGRES_SETUP.md](../backend/POSTGRES_SETUP.md).
- **Django tests** on a developer machine should use SQLite:  
  `python manage.py test --settings=core.settings_test` (see `.cursor/rules/django-tests-sqlite.mdc`).

The default `backend/core/settings.py` uses **PostgreSQL**, not SQLite.

## Database (Docker)

From the repo root:

```bash
docker compose up -d db
```

Defaults match `docker-compose.yml` and `backend/env.example` (`church_management` / `postgres` / `postgres` on port `5432`).

## Backend (Django)

1. **Create `.env`:**
   - `cd backend`
   - `cp env.example .env` (Windows: `copy env.example .env`)

2. **Create and activate a venv:**
   - macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`
   - Windows (PowerShell): `py -3.12 -m venv .venv` then `.\.venv\Scripts\Activate.ps1`
   - If activation is blocked: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`, or use `activate.bat` in cmd

3. **Install deps:**
   - `python -m pip install --upgrade pip setuptools wheel`
   - `pip install -r requirements.txt`

4. **Apply migrations:**
   - `python manage.py migrate`

5. **Run dev server:**
   - `python manage.py runserver` → http://127.0.0.1:8000/

**Notes**

- Run commands from **`backend`** so `.env` is loaded.
- Media uploads: `MEDIA_URL=/media/` in development.
- CORS allows frontend at `http://localhost:3000` via `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS`.
- JWT auth: see [AUTHENTICATION_MODULE.md](./AUTHENTICATION_MODULE.md).
- **Production on Windows:** use **Waitress**, not Gunicorn (Gunicorn does not run on Windows). See [WINDOWS_SELF_HOSTED.md](./WINDOWS_SELF_HOSTED.md).

## Frontend (Next.js)

1. **Install deps:** `cd frontend && npm install`

2. **Local API URL** — create `frontend/.env.local` (gitignored):

   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
   ```

   Copy from [frontend/.env.production.example](../frontend/.env.production.example) for production shape.

3. **Dev server:** `npm run dev` → http://localhost:3000

4. **Production build** (static export):

   ```bash
   npm run build
   ```

   Output: `frontend/out/`. The API base URL is baked in at build time from `NEXT_PUBLIC_API_URL` in `.env.production` (see [WINDOWS_SELF_HOSTED.md](./WINDOWS_SELF_HOSTED.md)).

## One-command bootstrap

**macOS/Linux:** `./scripts/bootstrap.sh`

**Windows (PowerShell):** `.\scripts\bootstrap.ps1` (requires Docker for Postgres)

## Environment

- Backend: `backend/.env` for DB and Django settings.
- Frontend: `NEXT_PUBLIC_API_URL` in `.env.local` (dev) or `.env.production` (build); implemented in `frontend/src/lib/api.ts`.
- Never commit `.env` or production secrets.

## Useful commands

| Task | Command |
|------|---------|
| Dev sample data (people + clusters + evangelism) | `python manage.py populate_dev_sample_data` |
| Fresh dev sample data | `python manage.py populate_dev_sample_data --reset` |
| Fix schema drift only (events, evangelism, people) | `python manage.py sync_dev_schema` |
| Admin user | `python manage.py create_admin` |
| Default passwords | `python manage.py set_default_passwords` |
| Django superuser | `python manage.py createsuperuser` |
| Collect static (production) | `python manage.py collectstatic --noinput` |
| Frontend build | `cd frontend && npm run build` |

See [backend/POPULATE_SAMPLE_DATA.md](../backend/POPULATE_SAMPLE_DATA.md) for individual populate commands and schema-drift notes.

## Initial setup (first time)

1. **Migrate** (seeds default branches, Sunday School categories, lessons):

   ```bash
   python manage.py migrate
   ```

2. **Create admin:** `python manage.py create_admin`

3. **Optional:** `python manage.py set_default_passwords`

4. **Login:** http://localhost:3000 with admin credentials

## Troubleshooting (local)

| Issue | Fix |
|-------|-----|
| `migrate` — connection refused | Start Postgres: `docker compose up -d db` |
| Pillow / wheel build fails | Use Python 3.11 or 3.12; upgrade pip |
| `venv` path separator error | Use `py -3.12 -m venv .venv` from `backend` |
| `waitress-serve` not found (Windows) | `python -m waitress ...` |
| Tests try to create PostgreSQL DB | Use `--settings=core.settings_test` |

## Related documentation

- [WINDOWS_SELF_HOSTED.md](./WINDOWS_SELF_HOSTED.md) — Cloudflare, Waitress, production frontend
- [GIT_AND_SERVER_SYNC.md](./GIT_AND_SERVER_SYNC.md) — pull, migrate, gitignore, compose override
- [backend/POSTGRES_SETUP.md](../backend/POSTGRES_SETUP.md) — Postgres and passwords
- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) — Render.com (Linux + Gunicorn)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — stack overview
