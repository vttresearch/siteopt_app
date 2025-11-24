@echo off
setlocal EnableDelayedExpansion

set CLEAN=false
set CLEAN_ONLY=false
set NO_CACHE=false

:parse_args
if "%~1"=="" goto :args_parsed
if "%~1"=="--clean" set CLEAN=true
if "%~1"=="--clean-only" set CLEAN_ONLY=true
if "%~1"=="--no-cache" set NO_CACHE=true
if "%~1"=="--help" goto :show_help
shift
goto :parse_args

:show_help
echo Usage: build.bat [OPTIONS]
echo.
echo Options:
echo   --clean       Clean build artifacts (node_modules, dist, staticfiles) before building.
echo   --clean-only  Clean build artifacts and exit without building.
echo   --no-cache    Build Docker image without using cache.
echo   --help        Show this help message.
echo.
goto :eof

:args_parsed

if "%CLEAN%"=="true" call :clean
if "%CLEAN_ONLY%"=="true" call :clean
if "%CLEAN_ONLY%"=="true" goto :eof

echo Starting build process...

:: 0. Setup Python Environment
if defined VIRTUAL_ENV goto :venv_active
if exist .venv\Scripts\activate.bat (
    echo Activating virtual environment (.venv)...
    call .venv\Scripts\activate.bat
) else (
    echo Note: No active virtual environment detected and .venv not found.
    echo Using system python.
)
:venv_active

:: 1. Python dependencies
echo ----------------------------------------------------------------
echo Step 1: Installing Python dependencies...
echo ----------------------------------------------------------------
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 goto :error

:: 2. Frontend dependencies and build
echo ----------------------------------------------------------------
echo Step 2: Building frontend...
echo ----------------------------------------------------------------
pushd siteoptapp\frontend

if not exist node_modules (
    echo Installing npm packages...
    call npm install
    if !ERRORLEVEL! NEQ 0 popd & goto :error
) else (
    echo node_modules exists, skipping npm install (use --clean to force reinstall)
)

echo Running npm build...
call npm run build
if !ERRORLEVEL! NEQ 0 popd & goto :error

popd

:: 3. Collect static
echo ----------------------------------------------------------------
echo Step 3: Collecting static files...
echo ----------------------------------------------------------------
python manage.py collectstatic --noinput
if %ERRORLEVEL% NEQ 0 goto :error

:: 4. Docker build
echo ----------------------------------------------------------------
echo Step 4: Building Docker image...
echo ----------------------------------------------------------------

set DOCKER_ARGS=
if "%NO_CACHE%"=="true" (
    echo Building with --no-cache...
    set DOCKER_ARGS=--no-cache
)

docker build %DOCKER_ARGS% -t siteopt-web .
if %ERRORLEVEL% NEQ 0 goto :error

echo ----------------------------------------------------------------
echo Build complete!
echo Run the container with:
echo   docker run --rm -p 5000:5000 siteopt-web
echo ----------------------------------------------------------------
goto :eof

:clean
echo Cleaning build artifacts...

if exist staticfiles (
    echo Removing staticfiles...
    rmdir /s /q staticfiles
)

if exist siteoptapp\frontend\dist (
    echo Removing frontend dist...
    rmdir /s /q siteoptapp\frontend\dist
)

if exist siteoptapp\frontend\node_modules (
    echo Removing node_modules...
    rmdir /s /q siteoptapp\frontend\node_modules
)

echo Removing __pycache__ directories...
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"

echo Clean complete.
goto :eof

:error
echo ----------------------------------------------------------------
echo Build failed!
echo ----------------------------------------------------------------
exit /b 1
