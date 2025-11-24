# Multi-stage Dockerfile for SiteOpt Web Interface
# Stage 1: Build Vue.js frontend
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY siteoptapp/frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source code
COPY siteoptapp/frontend/ ./

# Copy Docker environment file
COPY siteoptapp/frontend/.env.docker .env.production

# Build the frontend
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim AS backend

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN adduser --disabled-password --gecos '' appuser

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire project
COPY --chown=appuser:appuser . .

# Copy built frontend from the previous stage (this will overwrite any existing dist directory)
COPY --chown=appuser:appuser --from=frontend-builder /app/frontend/dist ./siteoptapp/frontend/dist

# Copy sample data files
COPY --chown=appuser:appuser data/ /app/data/

# Create directories for static files and media
RUN mkdir -p staticfiles media && chown appuser:appuser staticfiles media

# Make entrypoint scripts executable
RUN chmod +x /app/docker-entrypoint.sh /app/entrypoint-with-env.sh

# Ensure database file exists and has correct permissions
# SQLite needs write access to the directory to create journal files
RUN touch /app/db.sqlite3 && chown appuser:appuser /app /app/db.sqlite3

# Switch to non-root user
USER appuser

# Collect static files
RUN python manage.py collectstatic --noinput

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/health/', timeout=5)"

# Run the application
CMD ["/app/entrypoint-with-env.sh"]
