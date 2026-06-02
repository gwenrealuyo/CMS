# Populate Sample Data

Development-only commands for seeding realistic test data. **Do not run in production.**

## Recommended: one command

Syncs migrations, repairs known schema drift (squashed evangelism / `people_journey.updated_at`), then seeds people → clusters → evangelism:

```bash
cd backend
python manage.py populate_dev_sample_data
```

Fresh replace (clears people/families, clusters, and evangelism sample data first):

```bash
python manage.py populate_dev_sample_data --reset
```

Defaults: 30 people, 8 families, 5 clusters, 8 evangelism groups, 30 prospects.

```bash
python manage.py populate_dev_sample_data --reset --people 50 --families 10 --clusters 8
```

| Flag | Purpose |
|------|---------|
| `--reset` | Clear sample people/families, clusters, and evangelism before seeding |
| `--people N` | People to create (default: 30) |
| `--families N` | Families to create (default: 8) |
| `--clusters N` | Clusters to create (default: 5) |
| `--skip-clusters` | Only seed people + evangelism |
| `--skip-evangelism` | Only seed people (+ clusters unless skipped) |
| `--skip-schema-sync` | Skip migrate + schema repair (not recommended) |

**Sample user password:** `password123` (all users created by `populate_sample_data`).

## Individual commands (run in order)

If you prefer step-by-step control:

```bash
python manage.py migrate
python manage.py populate_sample_data --people 30 --families 8
python manage.py populate_clusters_data
python manage.py populate_evangelism_data --clear
```

Optional modules (require people first):

```bash
python manage.py populate_finance_data
python manage.py populate_auth_sample_data
```

### `populate_sample_data`

Creates people, families, journeys, and module coordinator assignments. **Does not** create clusters (use `populate_clusters_data`).

```bash
python manage.py populate_sample_data              # defaults: 50 people, 10 families
python manage.py populate_sample_data --clear      # remove non-ADMIN people/families first
python manage.py populate_sample_data --people 20 --families 5
```

| Option | Default | Description |
|--------|---------|-------------|
| `--people N` | 50 | People to create |
| `--families N` | 10 | Families to create |
| `--clear` | off | Clear people/families/journeys before seeding |

### `populate_clusters_data`

Requires people (and ideally families) from `populate_sample_data`.

```bash
python manage.py populate_clusters_data
python manage.py populate_clusters_data --clear --clusters 8 --reports 12
```

| Option | Default | Description |
|--------|---------|-------------|
| `--clusters N` | 5 | Clusters to create |
| `--reports N` | 12 | Weekly reports per cluster |
| `--clear` | off | Delete all clusters and reports first |

### `populate_evangelism_data`

Requires people and clusters. Always use `--clear` when re-seeding to avoid duplicates.

```bash
python manage.py populate_evangelism_data --clear
python manage.py populate_evangelism_data --clear --groups 8 --prospects 30
```

| Option | Default | Description |
|--------|---------|-------------|
| `--groups N` | 8 | Evangelism groups |
| `--prospects N` | 30 | Prospects |
| `--sessions N` | 20 | Sessions per group |
| `--clear` | off | Clear evangelism data first |

## Schema drift (after squashed migrations)

If migrations show as applied but the database still has an old shape, `populate_dev_sample_data` repairs automatically:

| Symptom | Repair |
|---------|--------|
| `people_journey.updated_at does not exist` | Re-applies `people` migration `0007` |
| `evangelism_prospect.first_name does not exist` or `name` still present | Drops evangelism tables and re-runs `evangelism.0001_initial` |
| `events_eventtype does not exist` | Drops events + dependent tables (attendance, sunday_school, evangelism) and re-migrates |
| `lessons_lessonstudentenrollment does not exist` or `lessons_lessonsessionreport.session_type does not exist` | Drops lessons tables and re-runs `lessons.0001_initial` + `0002_default_lessons` (clears progress, enrollments, session reports) |

Auto-repair (recommended):

```bash
python manage.py sync_dev_schema
```

Or run as part of `populate_dev_sample_data` (which also re-seeds evangelism after an events reset).

## Current migration baseline (dev)

| App | Latest | Notes |
|-----|--------|-------|
| `people` | `0010_modulesetting` | `0007` adds `Journey.updated_at` |
| `clusters` | `0001_initial` | No seed data in migrations |
| `evangelism` | `0001_initial` | Single squashed migration; Prospect uses `first_name` / `date_first_invited` (not `name` / `first_contact_date`) |
| `lessons` | `0002_default_lessons` | Squashed chain (`0001_initial` + `0002`); includes `LessonStudentEnrollment`, `session_type` on session reports |
| `events` | `0001_initial` | Includes `EventType` table (`events_eventtype`); old DBs may only have `events_event` |

Run `python manage.py migrate` before any populate command.

## Notes

- The `admin` user is never deleted by `--clear` on people data
- People with `role='ADMIN'` are protected from deletion
- Usernames are unique per run (e.g. `john.smith1`, `john.smith2`)
- Emails follow `username@example.com`

## Troubleshooting

**Import errors** — activate the virtual environment:

```bash
source .venv/bin/activate   # macOS/Linux
.venv\Scripts\activate      # Windows
```

**Duplicate cluster code (`CLU-001`)** — clusters already exist; use `--reset` or `populate_clusters_data --clear`.

**Postgres not running** — start with `docker compose up -d db` from the repo root.
