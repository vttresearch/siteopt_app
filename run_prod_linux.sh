#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
REGISTRY="registry.elexia.amct.pl"
APP_URL="http://localhost:5173"
WAIT_SECONDS=90

if [[ $# -ge 1 && -n "$1" ]]; then
  APP_VERSION="$1"
fi

if [[ -z "${APP_VERSION:-}" ]]; then
  printf 'Enter the production version tag to run, for example v1.0\n'
  read -r -p 'APP_VERSION: ' APP_VERSION
fi

if [[ -z "${APP_VERSION:-}" ]]; then
  printf 'APP_VERSION is required.\n' >&2
  exit 1
fi

export APP_VERSION

printf '================================================================\n'
printf 'SiteOpt Web Interface - Linux Launcher\n'
printf '================================================================\n\n'
printf 'APP_VERSION=%s\n' "$APP_VERSION"
if [[ -n "${SITEOPT_DATA_ROOT:-}" ]]; then
  printf 'SITEOPT_DATA_ROOT=%s\n' "$SITEOPT_DATA_ROOT"
fi
printf '\n'

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is not installed or not available in PATH.\n' >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  printf 'Docker engine is unavailable.\n' >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  printf 'Compose file not found: %s\n' "$COMPOSE_FILE" >&2
  exit 1
fi

printf 'Logging in to %s ...\n' "$REGISTRY"
if ! docker login "$REGISTRY"; then
  printf 'Registry login failed.\n' >&2
  exit 1
fi

printf '\nStopping existing containers ...\n'
if ! docker compose -f "$COMPOSE_FILE" down; then
  printf 'Failed to stop existing containers.\n' >&2
  exit 1
fi

printf '\nPulling images ...\n'
if ! docker compose -f "$COMPOSE_FILE" pull; then
  printf 'Pull failed.\n' >&2
  exit 1
fi

printf '\nStarting containers ...\n'
if ! docker compose -f "$COMPOSE_FILE" up -d; then
  printf 'Failed to start containers.\n' >&2
  exit 1
fi

printf '\nWaiting for backend health ...\n'
BACKEND_ID="$(docker compose -f "$COMPOSE_FILE" ps -q backend)"

if [[ -z "$BACKEND_ID" ]]; then
  printf 'Could not determine backend container id.\n' >&2
  exit 1
fi

ELAPSED=0
while true; do
  BACKEND_STATE="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$BACKEND_ID")"

  if [[ "$BACKEND_STATE" == "healthy" || "$BACKEND_STATE" == "running" ]]; then
    break
  fi

  if (( ELAPSED >= WAIT_SECONDS )); then
    printf 'Backend did not become ready within %ss.\n' "$WAIT_SECONDS" >&2
    printf 'Showing recent backend logs:\n' >&2
    docker compose -f "$COMPOSE_FILE" logs backend --tail=50
    exit 1
  fi

  printf '  backend state: %s (%ss/%ss)\n' "$BACKEND_STATE" "$ELAPSED" "$WAIT_SECONDS"
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

printf 'Backend is ready.\n'

if command -v xdg-open >/dev/null 2>&1; then
  printf 'Opening %s ...\n' "$APP_URL"
  xdg-open "$APP_URL" >/dev/null 2>&1 &
else
  printf 'Open %s in your browser.\n' "$APP_URL"
fi

printf '\nStack is running.\n'
printf 'Version: %s\n' "$APP_VERSION"
printf 'To stop it later, run:\n'
printf '  docker compose -f "%s" down\n\n' "$COMPOSE_FILE"