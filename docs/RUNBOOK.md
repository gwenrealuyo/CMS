## Local Development Runbook

### Prereqs

- Python 3.9+
- Node.js 18+
- Docker Desktop (for Postgres)

macOS:
- `brew install python@3.11 node@18`
- Install Docker Desktop: https://www.docker.com/products/docker-desktop/

Windows:
- `winget install Python.Python.3.11 OpenJS.NodeJS.LTS Docker.DockerDesktop`

### Database (Docker)

From the repo root:
- `docker compose up -d db` (or `docker-compose up -d db`)

### Backend (Django)

1. Create `.env`:
   - `cd backend`
   - `cp env.example .env`
2. Create and activate a venv:
   - macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`
   - Windows (PowerShell): `python -m venv .venv; .\.venv\Scripts\Activate.ps1`
3. Install deps:
   - `pip install -r requirements.txt`
4. Apply migrations:
   - `python manage.py migrate`
5. Run server:
   - `python manage.py runserver` → http://127.0.0.1:8000/

Notes

- Media uploads served at `MEDIA_URL=/media/` in development.
- CORS allows frontend at `http://localhost:3000`.
- **Authentication is enabled**: JWT token-based authentication required for all API endpoints (except login).
- See `docs/AUTHENTICATION_MODULE.md` for authentication setup and usage.

### Frontend (Next.js)

1. Install deps:
   - `cd frontend`
   - `npm install`
2. Run dev server:
   - `npm run dev` → http://localhost:3000

### One-command bootstrap

macOS/Linux:
- `./scripts/bootstrap.sh`

Windows (PowerShell):
- `.\scripts\bootstrap.ps1`

### Environment

- Backend requires `backend/.env` for DB credentials. Defaults match `docker-compose.yml`.
- If you change the backend host/port, update API base URLs in frontend hooks (e.g., `usePeople`).

### Useful Commands

- **Create admin user**: `python manage.py create_admin`
- **Set default passwords**: `python manage.py set_default_passwords`
- Backend admin: `python manage.py createsuperuser` (or use `create_admin` command)
- Frontend build: `npm run build && npm start`

### Initial Setup (First Time)

1. **Apply migrations** (this automatically seeds default data):
   ```bash
   python manage.py migrate
   ```
   This will automatically create:
   - Default branches (Muntinlupa HQ, Biñan, Pateros, etc.)
   - Default Sunday School categories
   - Default lessons

2. **Create admin user**:
   ```bash
   python manage.py create_admin
   ```

3. **Set default passwords for existing users**:
   ```bash
   python manage.py set_default_passwords
   ```

4. **Login**:
   - Navigate to `http://localhost:3000`
   - Use admin credentials to log in



