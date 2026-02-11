#!/usr/bin/env bash
set -e

DJANGO_PORT="${DJANGO_PORT:-5000}"
SPINE_ENGINE_PORT="${SPINE_ENGINE_PORT:-49152}"

# Use container-local paths for settings/work folders
export CONFIG_ROOT="${CONFIG_ROOT:-/home/appuser/.local/share/siteopt-app}"
export WORK_ROOT="${WORK_ROOT:-/home/appuser/.local/share/siteopt-app/work}"

mkdir -p "$CONFIG_ROOT" "$WORK_ROOT"

# Start Spine Engine server in background
python /app/dockerconfig/start_server_docker.py "$SPINE_ENGINE_PORT" &

# Apply database migrations
python manage.py migrate --noinput

# Start Django server
echo "Access the web interface at: http://localhost:${DJANGO_PORT}/"
exec python manage.py runserver 0.0.0.0:"$DJANGO_PORT" --noreload
