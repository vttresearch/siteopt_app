# Docker Deployment Guide

This guide explains the two Docker options we actually use today:

1. **Single container image (default)** – bundles Django, Gunicorn, and the built Vue frontend and uses SQLite inside the container. No PostgreSQL or Nginx is required for this workflow.
2. **docker-compose stack (optional)** – spins up PostgreSQL and (optionally) Nginx alongside the same web image when you need an external database or reverse proxy.

Use the single container path unless you explicitly need Postgres or Nginx.

## Prerequisites

- Docker installed. Docker Compose is only needed if you run the optional stack.
- At least 2 GB RAM and 1 GB disk space.

## 1. Single Container Workflow (SQLite, default)

This is the image built from the `Dockerfile`. It contains everything (backend, frontend build, static files) and stores data in the bundled SQLite database.

```bash
# Build the image (run from repo root)
docker build -t siteopt-web .

# Start the container
docker run --rm -p 5000:5000 siteopt-web

# Open the app
xdg-open http://localhost:5000
```

### Notes

- All data lives inside the container’s `db.sqlite3`. Add `-v $PWD/db.sqlite3:/app/db.sqlite3` if you want persistence between runs.
- Static and media directories are already populated during the image build. Mount `-v $PWD/media:/app/media` if you expect uploads to survive container removal.
- Health endpoint: `http://localhost:5000/api/health/`.
- Environment overrides (`DEBUG`, `DJANGO_ALLOWED_HOSTS`, etc.) can be passed with `-e KEY=value` as needed.

## 2. Optional docker-compose Stack (PostgreSQL + Nginx)

Use this only when you need PostgreSQL persistence or a reverse proxy sitting in front of the app. The same `web` image is used, but the settings module switches to `config.docker_settings`, which enables the Postgres connection and makes the entrypoint wait for the DB.

```bash
# Base production-style stack: web + postgres + nginx
docker-compose up --build

# Development stack with hot reload helpers
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Services

| Service | Required? | Description |
| --- | --- | --- |
| `web` | Always | Runs Django + Gunicorn on port 5000 and serves the built frontend. Uses Postgres only when `DJANGO_SETTINGS_MODULE=config.docker_settings`. |
| `db` | Only in compose | PostgreSQL 15 instance exposed on 5432 with credentials defined in `docker-compose.yml`. |
| `nginx` | Only in compose | Reverse proxy for the `web` service, mapped to host port 80. Remove this service if you prefer hitting `web` directly. |

### Environment and persistence

Create a `.env` file (or export variables) if you need to override the defaults:

```
DEBUG=0
DJANGO_ALLOWED_HOSTS=yourdomain.com,localhost
POSTGRES_DB=siteoptdb
POSTGRES_USER=siteoptuser
POSTGRES_PASSWORD=change_me
DB_HOST=db
DB_PORT=5432
```

Volumes already defined in `docker-compose.yml` persist media, static files, and the Postgres data directory. Mount additional volumes if you need anything else.

### Common compose commands

```bash
docker-compose build                # Rebuild images
docker-compose up -d                # Start in background
docker-compose logs -f web          # Tail backend logs
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
docker-compose down                 # Stop and keep volumes
docker-compose down -v              # Stop and delete volumes (DB reset)
```

### Health checks

- Web: `http://localhost:5000/api/health/` (exposed through Nginx as `http://localhost/api/health/` when that service is enabled)
- Database: `pg_isready -U <user> -d <db>` inside the `db` container

## Troubleshooting

- **Web container can’t reach the database** – ensure you are running via `docker-compose` so that `DB_HOST=db` resolves. The single container mode does not start Postgres.
- **Want to disable Nginx** – comment out the `nginx` service in `docker-compose.yml` and hit `http://localhost:5000` directly.
- **Persistent SQLite instead of Postgres** – stick with the single container workflow and mount the database file to the host as shown above.

## Security tips

- Set `DEBUG=0` before exposing the app publicly.
- Change the default Postgres password or use secrets when running the compose stack.
- Terminate TLS either in your own load balancer or by extending the provided `nginx.conf` with certificates.
