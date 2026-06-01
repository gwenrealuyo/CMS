# Church Management System (CMS)

Django REST API + Next.js frontend.

## Documentation

| Doc | Audience |
|-----|----------|
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Local development (macOS, Windows, Linux) |
| [docs/WINDOWS_SELF_HOSTED.md](docs/WINDOWS_SELF_HOSTED.md) | Windows server: Waitress, Cloudflare Tunnel, production build |
| [docs/GIT_AND_SERVER_SYNC.md](docs/GIT_AND_SERVER_SYNC.md) | Pull from `main`, migrations, gitignore, server-only Docker |
| [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md) | Deploy on Render.com |
| [backend/POSTGRES_SETUP.md](backend/POSTGRES_SETUP.md) | PostgreSQL setup and password changes |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack and layout overview |

## Quick start (local)

```bash
docker compose up -d db
cd backend && cp env.example .env && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python manage.py migrate && python manage.py runserver
```

```bash
cd frontend && npm install && npm run dev
```

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for Windows commands and troubleshooting.
