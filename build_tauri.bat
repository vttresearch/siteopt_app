@echo off
setlocal

echo Activating virtual environment
REM Activate virtual environment
call .venv\Scripts\activate.bat

echo Building backend...
REM == Step 1: Build Django backend using PyInstaller ==
pyinstaller --onefile run_django.py

REM == Step 2: Move the generated executable to the Tauri backend folder ==
echo Moving backend binary to Tauri bundle...
if not exist "siteoptapp\frontend\src-tauri\backend" (mkdir "siteoptapp\frontend\src-tauri\backend")
move /Y dist\run_django.exe siteoptapp\frontend\src-tauri\backend\run_django.exe

REM == Step 3: Build the Tauri app ==
echo Building Tauri app...
cd siteoptapp\frontend
npx tauri build

cd ..\..
echo Tauri bundle build process completed successfully.
endlocal
