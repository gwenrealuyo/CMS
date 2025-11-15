## Architecture Overview

### Stack

- Backend: Django + Django REST Framework (DRF)
- Frontend: Next.js 13 (App Router) + Tailwind CSS + Radix UI
- Database: SQLite (dev)
- Auth: Custom user model `apps.people.models.Person`

### Directory Layout

- `backend/`: Django project with local apps under `apps/`
  - `core/`: project settings, ASGI/WSGI, root URLs
  - `apps/people`: active app providing `Person`, `Family`, `Cluster`, `Milestone` and CRUD APIs
  - other domain apps exist (`events`, `finance`, `lessons`, `ministries`, `attendance`) but are not wired in settings/urls yet
- `frontend/`: Next.js app using App Router with pages like `people/`, `dashboard/`, `finance/`, `ministries/`

### Data Flow

1. Frontend pages and hooks (e.g. `usePeople`) call the backend via HTTP (CORS allows `http://localhost:3000`).
2. DRF viewsets in `apps.people.views` expose CRUD endpoints on `Person`, `Family`, and `Cluster`.
3. Serializers in `apps.people.serializers` validate/shape data. `PersonSerializer.create` generates unique usernames from first/last names.
4. ORM models in `apps.people.models` persist to SQLite.

### URLs and Settings

- Root URLs: `backend/core/urls.py` → `admin/` and `api/people/`
- DRF, CORS enabled in `backend/core/settings.py`; `AUTH_USER_MODEL = "people.Person"`
- Static/media configured (`MEDIA_URL`/`MEDIA_ROOT`)

### Notes

- Permissions are currently permissive (`AllowAny`); toggle to `IsAuthenticated` when auth is in place.
