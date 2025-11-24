#!/bin/bash
set -e

# Check if we're using PostgreSQL or SQLite
if [ "$DJANGO_SETTINGS_MODULE" = "config.docker_settings" ]; then
    # Wait for PostgreSQL database to be ready
    echo "Waiting for PostgreSQL database..."
    while ! python -c "
import psycopg2
import os
import sys
try:
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'db'),
        port=os.getenv('DB_PORT', '5432'),
        user=os.getenv('POSTGRES_USER', 'siteoptuser'),
        password=os.getenv('POSTGRES_PASSWORD', 'siteoptpass'),
        database=os.getenv('POSTGRES_DB', 'siteoptdb')
    )
    conn.close()
    print('Database is ready!')
except psycopg2.OperationalError:
    print('Database is not ready yet...')
    sys.exit(1)
" 2>/dev/null; do
      echo "PostgreSQL is unavailable - sleeping"
      sleep 1
    done
    echo "PostgreSQL is up - executing command"
else
    echo "Using SQLite database for development"
fi

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start server
if [ "$DEBUG" = "1" ] || [ "$DEBUG" = "True" ] || [ "$DEBUG" = "true" ]; then
    echo "Starting development server..."
    exec python manage.py runserver 0.0.0.0:5000
else
    echo "Starting production server with Gunicorn..."
    exec gunicorn config.wsgi:application \
        --bind 0.0.0.0:5000 \
        --workers 3 \
        --timeout 60 \
        --keep-alive 2 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --preload \
        --log-level info \
        --access-logfile - \
        --error-logfile -
fi
