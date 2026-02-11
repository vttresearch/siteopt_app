@echo off
setlocal

rem Build script for SiteOpt Web Interface with integrated Spine Toolbox
rem Note: This may take 15-30 minutes due to Julia package installation

set "ROOT_DIR=%~dp0.."
for %%I in ("%ROOT_DIR%") do set "ROOT_DIR=%%~fI"

set "CLEAN=false"
set "CLEAN_ONLY=false"
set "NO_CACHE=false"
set "SPINE_TOOLBOX_VERSION=0.10.5"
set "CONTAINER_NAME=siteopt-web-spine"
set "IMAGE_NAME=siteopt-web-spine:latest"

:arg_loop
if "%~1"=="" goto args_done
if "%~1"=="--clean" goto _arg_clean
if "%~1"=="--clean-only" goto _arg_clean_only
if "%~1"=="--no-cache" goto _arg_no_cache
if "%~1"=="--spine-toolbox-version" goto _arg_spine
if "%~1"=="--help" goto show_help
rem unknown, skip
shift
goto arg_loop

:_arg_clean
set "CLEAN=true"
shift
goto arg_loop

:_arg_clean_only
set "CLEAN_ONLY=true"
shift
goto arg_loop

:_arg_no_cache
set "NO_CACHE=true"
shift
goto arg_loop

:_arg_spine
shift
if "%~1"=="" (
  echo Missing version for --spine-toolbox-version
  exit /b 1
)
set "SPINE_TOOLBOX_VERSION=%~1"
shift
goto arg_loop

:show_help
echo Usage: build-spine.bat [OPTIONS]
echo.
echo Build script for SiteOpt Web Interface with integrated Spine Toolbox
echo Note: This may take 15-30 minutes due to Julia package installation
echo.
echo Options:
echo   --clean       Clean build artifacts (node_modules, dist, staticfiles) before building.
echo   --clean-only  Clean build artifacts and exit without building.
echo   --no-cache    Build Docker image without using cache.
echo   --spine-toolbox-version ^<tag^>  Spine-Toolbox git tag (default: 0.10.5).
echo   --help        Show this help message.
exit /b 0

:args_done
if "%CLEAN_ONLY%"=="true" (
  call :do_clean
  exit /b 0
)
if "%CLEAN%"=="true" call :do_clean
call :build
exit /b 0

:build

echo Starting build process...

rem 0. Initialize git submodules
echo ----------------------------------------------------------------
echo Step 0: Initializing git submodules...
echo ----------------------------------------------------------------
git submodule update --init --recursive

rem 1. Setup Python Environment
if defined VIRTUAL_ENV goto _venv_already
if exist "%ROOT_DIR%\.venv\Scripts\activate.bat" goto _venv_activate
echo Note: No active virtual environment detected and .venv not found.
where python >nul 2>&1
if errorlevel 1 echo python not found in PATH
goto _venv_done

:_venv_activate
echo Activating virtual environment (.venv)...
call "%ROOT_DIR%\.venv\Scripts\activate.bat"
goto _venv_done

:_venv_already
rem Virtual environment already active

:_venv_done

rem 2. Python dependencies
echo ----------------------------------------------------------------
echo Step 1: Installing Python dependencies...
echo ----------------------------------------------------------------
python -m pip install -r "%ROOT_DIR%\requirements.txt"

rem 3. Frontend dependencies and build
echo ----------------------------------------------------------------
echo Step 2: Building frontend...
echo ----------------------------------------------------------------
pushd "%ROOT_DIR%\siteoptapp\frontend" >nul
call npm ci --silent
call npm run build
popd >nul

rem 4. Collect static
echo ----------------------------------------------------------------
echo Step 3: Collecting static files...
echo ----------------------------------------------------------------
python "%ROOT_DIR%\manage.py" collectstatic --noinput

rem 5. Docker build
echo ----------------------------------------------------------------
echo Step 4: Building Docker image with Spine Toolbox...
echo ----------------------------------------------------------------
echo Note: Julia package installation may take 15-30 minutes...

set "DOCKER_ARGS=--build-arg SPINE_TOOLBOX_VERSION=%SPINE_TOOLBOX_VERSION%"
if "%NO_CACHE%"=="true" (
  set "DOCKER_ARGS=%DOCKER_ARGS% --no-cache"
)

docker build %DOCKER_ARGS% -f "%ROOT_DIR%\docker_solution\Dockerfile.spine" -t %IMAGE_NAME% "%ROOT_DIR%"

echo ----------------------------------------------------------------
echo Step 5: Starting container...
echo ----------------------------------------------------------------
echo Removing existing container "%CONTAINER_NAME%" if present...
docker rm -f "%CONTAINER_NAME%" >nul 2>&1
echo Opening browser at http://localhost:5000 ...
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:5000'"
docker run -p 5000:5000 --name "%CONTAINER_NAME%" %IMAGE_NAME%

echo ----------------------------------------------------------------
echo Build complete!
echo.
echo To run with docker-compose:
echo   docker-compose -f docker_solution\docker-compose.spine.yml up -d
echo.
echo Or run manually:
echo   docker run -p 5000:5000 --name %CONTAINER_NAME% %IMAGE_NAME%
echo.
echo Access the web interface at: http://localhost:5000
echo ----------------------------------------------------------------
goto :eof

:do_clean
echo Cleaning build artifacts...
if exist "%ROOT_DIR%\staticfiles" rmdir /s /q "%ROOT_DIR%\staticfiles"
if exist "%ROOT_DIR%\siteoptapp\frontend\dist" rmdir /s /q "%ROOT_DIR%\siteoptapp\frontend\dist"
if exist "%ROOT_DIR%\siteoptapp\frontend\node_modules" rmdir /s /q "%ROOT_DIR%\siteoptapp\frontend\node_modules"
for /d /r "%ROOT_DIR%" %%d in (__pycache__) do rmdir /s /q "%%d" 2>nul
echo Clean complete.
goto :eof
