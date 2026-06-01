# PostgreSQL Setup Guide

This guide will help you set up PostgreSQL for the Church Management System.

## Recommended: Docker (Cross-Platform)

1. Install Docker Desktop:
   - macOS/Windows: https://www.docker.com/products/docker-desktop/

2. Start Postgres from repo root:
   ```bash
   docker compose up -d db
   ```

3. Ensure `backend/.env` matches the defaults:
   ```env
   DB_NAME=church_management
   DB_USER=postgres
   DB_PASSWORD=postgres
   DB_HOST=localhost
   DB_PORT=5432
   ```

## Alternative: Native Postgres

1. Install PostgreSQL on your system:
   - macOS: `brew install postgresql`
   - Ubuntu/Debian: `sudo apt-get install postgresql`
   - Windows: https://www.postgresql.org/download/

2. Create a PostgreSQL database:
   ```bash
   # Connect to PostgreSQL
   psql postgres

   # Create database
   CREATE DATABASE church_management;

   # Create user (optional, you can use postgres user)
   CREATE USER your_user WITH PASSWORD 'your_password';

   # Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE church_management TO your_user;

   # Exit psql
   \q
   ```

## Installation

1. Install the required dependencies:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. Create a `.env` file in the `backend` directory:

   ```bash
   cp env.example .env
   ```

3. Edit the `.env` file with your PostgreSQL credentials:
   ```env
   DB_NAME=church_management
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   ```

## Database Migration

1. Create and apply migrations:

   ```bash
   cd backend
   python manage.py makemigrations
   python manage.py migrate
   ```

2. Create a superuser (optional):
   ```bash
   python manage.py createsuperuser
   ```

## Running the Application

```bash
python manage.py runserver
```

## Troubleshooting

### Connection Issues

If you encounter connection errors:

1. Ensure PostgreSQL is running:

   ```bash
   # macOS
   brew services start postgresql

   # Ubuntu/Debian
   sudo systemctl start postgresql
   ```

2. Check your database credentials in the `.env` file

3. Verify the database exists:

   ```bash
   psql -l
   ```

4. Test the connection:
   ```bash
   psql -U your_user -d church_management
   ```

### Port Conflicts

If port 5432 is already in use, update the `DB_PORT` in your `.env` file.

## Changing the Postgres password (Docker)

Changing only `docker-compose.yml` or `POSTGRES_PASSWORD` in compose **does not** change the password inside an **existing** data volume. Update Postgres and Django together.

### Windows / cross-platform (Docker)

1. Ensure the container is running: `docker ps` (look for `cms-postgres`).

2. Open `psql` in the container:

   ```bash
   docker exec -it cms-postgres psql -U postgres -d church_management
   ```

3. Set the password:

   ```sql
   ALTER USER postgres WITH PASSWORD 'your_new_password';
   \q
   ```

4. Set the **same** value in `backend/.env`:

   ```env
   DB_PASSWORD=your_new_password
   ```

5. Restart your WSGI server (e.g. Waitress on Windows).

6. Verify:

   ```bash
   cd backend
   python manage.py migrate --plan
   ```

**Optional:** Keep secrets out of tracked compose by using `docker-compose.override.yml` (gitignored). See `docker-compose.override.yml.example` at the repo root and [docs/GIT_AND_SERVER_SYNC.md](../docs/GIT_AND_SERVER_SYNC.md).

**Reset to default (`postgres`):** use `ALTER USER postgres WITH PASSWORD 'postgres';` and `DB_PASSWORD=postgres` in `.env`.

### Native Postgres (Windows pgAdmin / psql)

- **SQL Shell (psql)** from the Start menu, or **pgAdmin** → Query Tool on `church_management`.
- Run the same `ALTER USER` statement.
- Update `backend/.env` and restart Django.

## Server updates (new migrations from Git)

After `git pull` on a machine that already has data:

```bash
cd backend
python manage.py migrate
```

See [docs/GIT_AND_SERVER_SYNC.md](../docs/GIT_AND_SERVER_SYNC.md).

## Notes

- The old SQLite database (`db.sqlite3`) will be ignored by git
- If you need to migrate data from SQLite to PostgreSQL, use Django's `dumpdata` and `loaddata` commands
- Default Django settings use **PostgreSQL** (`backend/core/settings.py`), not SQLite for normal `runserver` / production
