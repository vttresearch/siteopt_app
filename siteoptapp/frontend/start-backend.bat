@echo off
setlocal

REM Check if Django is already running
tasklist | findstr /i "python.exe" | findstr /i "manage.py" >nul
if %errorlevel%==0 (
    echo Django backend is already running.
    exit /b
)

REM Activate virtual environment and start Django
echo Starting Django backend...
start "" cmd /C "call ..\..\.venv\Scripts\activate.bat && python ..\..\manage.py runserver"

endlocal
