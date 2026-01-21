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

## Notes

- The old SQLite database (`db.sqlite3`) will be ignored by git
- If you need to migrate data from SQLite to PostgreSQL, use Django's `dumpdata` and `loaddata` commands
