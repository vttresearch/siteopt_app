@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"
set "COMPOSE_FILE=%ROOT_DIR%docker-compose.prod.yml"
set "REGISTRY=registry.elexia.amct.pl"
set "APP_URL=http://localhost:5173"
set "WAIT_SECONDS=90"

echo ================================================================
echo SiteOpt Web Interface - Windows Launcher
echo ================================================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker is not installed or not available in PATH.
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop is not running or Docker engine is unavailable.
  exit /b 1
)

if not exist "%COMPOSE_FILE%" (
  echo Compose file not found: %COMPOSE_FILE%
  exit /b 1
)

echo Logging in to %REGISTRY% ...
docker login %REGISTRY%
if errorlevel 1 (
  echo Registry login failed.
  exit /b 1
)

echo.
echo Pulling images ...
docker compose -f "%COMPOSE_FILE%" pull
if errorlevel 1 (
  echo Pull failed.
  exit /b 1
)

echo.
echo Starting containers ...
docker compose -f "%COMPOSE_FILE%" up -d
if errorlevel 1 (
  echo Failed to start containers.
  exit /b 1
)

echo.
echo Waiting for backend health ...
set "BACKEND_ID="
for /f "usebackq delims=" %%I in (`docker compose -f "%COMPOSE_FILE%" ps -q backend`) do set "BACKEND_ID=%%I"

if not defined BACKEND_ID (
  echo Could not determine backend container id.
  exit /b 1
)

set /a ELAPSED=0
:wait_loop
set "BACKEND_STATE="
for /f "usebackq delims=" %%I in (`docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" %BACKEND_ID%`) do set "BACKEND_STATE=%%I"

if /I "!BACKEND_STATE!"=="healthy" goto backend_ready
if /I "!BACKEND_STATE!"=="running" goto backend_ready

if !ELAPSED! GEQ %WAIT_SECONDS% goto wait_timeout

echo   backend state: !BACKEND_STATE! ^(!ELAPSED!s/%WAIT_SECONDS%s^)
timeout /t 3 /nobreak >nul
set /a ELAPSED+=3
goto wait_loop

:wait_timeout
echo Backend did not become ready within %WAIT_SECONDS% seconds.
echo Showing recent backend logs:
docker compose -f "%COMPOSE_FILE%" logs backend --tail=50
exit /b 1

:backend_ready
echo Backend is ready.
echo Opening %APP_URL% ...
start "" "%APP_URL%"

echo.
echo Stack is running.
echo To stop it later, run:
echo   docker compose -f "%COMPOSE_FILE%" down
echo.
exit /b 0