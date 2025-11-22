## Local Development Runbook

### Prereqs

- Python 3.9+
- Node.js 18+

### Backend (Django)

1. Create and activate a venv (optional if using provided `backend/venv`):
   - macOS/Linux: `python3 -m venv .venv && source .venv/bin/activate`
2. Install deps:
   - `cd backend`
   - `pip install -r requirements.txt`
3. Apply migrations:
   - `python manage.py migrate`
4. Run server:
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

### Environment

- No `.env` required for dev by default. If you change the backend host/port, update API base URLs in frontend hooks (e.g., `usePeople`).

### Useful Commands

- **Create admin user**: `python manage.py create_admin`
- **Set default passwords**: `python manage.py set_default_passwords`
- Backend admin: `python manage.py createsuperuser` (or use `create_admin` command)
- Frontend build: `npm run build && npm start`

### Initial Setup (First Time)

1. **Create admin user**:
   ```bash
   python manage.py create_admin
   ```

2. **Set default passwords for existing users**:
   ```bash
   python manage.py set_default_passwords
   ```

3. **Login**:
   - Navigate to `http://localhost:3000`
   - Use admin credentials to log in



