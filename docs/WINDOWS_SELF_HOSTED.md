# Windows Self-Hosted Deployment (Cloudflare + Waitress)

Guide for running the CMS on a Windows server or PC with Docker Postgres, **Waitress** (not Gunicorn), a static Next.js build, and **Cloudflare Tunnel** (or similar reverse proxy).

For local development on any OS, see [RUNBOOK.md](./RUNBOOK.md). For managed hosting on Render, see [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md).

## Overview

```text
User browser
    │
    ├─ https://www.example.com        → Cloudflare Tunnel → http://127.0.0.1:3000 → static frontend (frontend/out)
    │
    └─ https://api.example.com/api/…  → Cloudflare Tunnel → http://127.0.0.1:8000 → Waitress → Django
```

- **Do not** expose `npm run dev` to the internet — use `npm run build` and serve `frontend/out`.
- **Do not** use `python manage.py runserver` in production — use Waitress.
- **Gunicorn does not run on Windows** (`fcntl` / Unix-only). Use Waitress or deploy the backend on Linux/WSL.

## Prerequisites

| Tool | Notes |
|------|--------|
| Python **3.11 or 3.12** (64-bit) | Avoid bleeding-edge versions (e.g. 3.13+) until dependencies publish wheels |
| Node.js **18+** | For `npm run build` |
| Docker Desktop | Easiest way to run Postgres (`docker compose up -d db`) |
| Cloudflare account | Tunnel or DNS to your machine |

Install Python (Windows):

```powershell
winget install Python.Python.3.12 OpenJS.NodeJS.LTS Docker.DockerDesktop
```

## Initial setup (Windows)

### 1. Database

From repo root:

```powershell
docker compose up -d db
```

See [backend/POSTGRES_SETUP.md](../backend/POSTGRES_SETUP.md) for credentials and password changes.

### 2. Backend

```powershell
cd backend
copy env.example .env
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
python manage.py migrate
python manage.py create_admin
```

**PowerShell script execution:** If activation fails with “running scripts is disabled”, run once:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use Command Prompt: `.venv\Scripts\activate.bat`

**Waitress:** If `waitress-serve` is not found, use:

```powershell
python -m waitress --listen=127.0.0.1:8000 core.wsgi:application
```

Always start Waitress from the **`backend`** directory so `load_dotenv()` finds `backend/.env`.

### 3. Frontend (development)

```powershell
cd frontend
copy .env.production.example .env.local
# Edit .env.local for local dev:
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
npm install
npm run dev
```

### 4. Production frontend build

Create `frontend/.env.production` (gitignored; copy from `.env.production.example`):

```env
NEXT_PUBLIC_API_URL=https://api.example.com/api
```

Rules:

- **Full URL** with `https://`, `api.` subdomain, and trailing `/api`.
- **Not** a relative path like `/api` (that resolves to `www` + `/api` in the browser).
- Re-run **`npm run build`** after every change to this value (static export bakes it into JS).

```powershell
cd frontend
npm run build
npx serve out -l 3000
```

Serve `out` with `serve`, Nginx, or Caddy — not `npm run dev`.

### 5. Production backend `.env`

Example `backend/.env` on the server:

```env
DEBUG=False
SECRET_KEY=<strong-random-key>
DB_NAME=church_management
DB_USER=postgres
DB_PASSWORD=<your-password>
DB_HOST=localhost
DB_PORT=5432
ALLOWED_HOSTS=api.example.com,www.example.com,example.com,127.0.0.1,localhost
FRONTEND_URL=https://www.example.com
CORS_ALLOWED_ORIGINS=https://www.example.com
```

**ALLOWED_HOSTS:**

- Hostnames only — no `https://`, no trailing slash.
- **No spaces after commas** (settings split on `,` without stripping).
- Must include **`api.example.com`** if users hit that host; missing host → **HTTP 400** (`DisallowedHost`), even when `DEBUG=True`.

**Wrong DB password** usually causes **500** and “password authentication failed” in the Waitress console — not 400.

With `DEBUG=False`, run once (and after static-related upgrades):

```powershell
python manage.py collectstatic --noinput
```

## Cloudflare Tunnel

### Add API hostname (port 8000)

Someone may have already exposed `www` → `localhost:3000`. Add a **second public hostname** on the **same tunnel**:

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com) → **Networks** → **Tunnels** → your tunnel → **Configure**.
2. **Public Hostname** → **Add**:
   - Subdomain: `api`
   - Domain: `example.com`
   - Service: **HTTP** → `localhost:8000` (or `127.0.0.1:8000`)
3. Save. Confirm DNS has a CNAME for `api` (often auto-created).

| Public hostname | Local service | Process |
|-----------------|---------------|---------|
| `www.example.com` | `http://localhost:3000` | `npx serve out -l 3000` (or static server) |
| `api.example.com` | `http://localhost:8000` | Waitress |

### Verify

1. `https://api.example.com/admin/` — Django admin (after `collectstatic` if `DEBUG=False`).
2. Login from the app — Network tab must show `https://api.example.com/api/auth/login/`, not `localhost` or `www.../api/...`.

### `config.yml` (optional)

If the tunnel uses a file (e.g. `C:\Users\<you>\.cloudflared\config.yml`), add an ingress rule for `api.example.com` → `http://localhost:8000`, then restart the `cloudflared` service.

## Run only one backend process

- Use **one** project directory on the server.
- Do **not** leave `python manage.py runserver` running in another folder on port **8000** — Cloudflare will hit the wrong app and `.env` will not match.
- Check port 8000: `netstat -ano | findstr :8000`

Production stack:

```powershell
# Terminal 1 — from backend/
python -m waitress --listen=127.0.0.1:8000 core.wsgi:application

# Terminal 2 — from frontend/ (after npm run build)
npx serve out -l 3000
```

Restart Waitress after every `backend/.env` change.

## After pulling new code from GitHub

See [GIT_AND_SERVER_SYNC.md](./GIT_AND_SERVER_SYNC.md). Short version:

```powershell
git pull origin main
cd backend
.\.venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py collectstatic --noinput
# Rebuild frontend if app code or NEXT_PUBLIC_API_URL changed
cd ..\frontend
npm run build
```

Restart Waitress and the static file server.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Login URL is `localhost:8000` or `www.../api` | Stale build or wrong `NEXT_PUBLIC_API_URL` | Set full `https://api.../api`, `npm run build`, redeploy `out` |
| **400** on `https://api...` | `ALLOWED_HOSTS` missing `api...` or spaces in list | Fix `.env`, restart Waitress from `backend/` |
| **500** + password errors | `DB_PASSWORD` ≠ Postgres | `ALTER USER` in Docker; match `.env` |
| `manage.py check` OK but site broken | Wrong process on 8000 or wrong folder | Stop other `runserver`; one Waitress from correct `backend` |
| Admin: missing `admin/css/base.css` | No `collectstatic` with `DEBUG=False` | `python manage.py collectstatic --noinput` |
| `gunicorn` / `fcntl` error | Gunicorn on Windows | Use Waitress or Linux |
| Pillow install fails | Python too new | Use Python 3.11 or 3.12 |
| `waitress-serve` not found | PATH / venv | `python -m waitress ...` |
| Tunnel: `npipe` error | Docker Desktop not running | Start Docker Desktop |
| `migrate` connection refused | Postgres down | `docker compose up -d db` |

## Related docs

- [RUNBOOK.md](./RUNBOOK.md) — local dev (all platforms)
- [GIT_AND_SERVER_SYNC.md](./GIT_AND_SERVER_SYNC.md) — gitignore, server-only compose, migrations
- [backend/POSTGRES_SETUP.md](../backend/POSTGRES_SETUP.md) — Postgres and passwords
- [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) — Render (Linux + Gunicorn)
