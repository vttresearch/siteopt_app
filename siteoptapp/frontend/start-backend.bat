@echo off
start "" cmd /C "call ..\..\.venv\Scripts\activate.bat && python ..\..\manage.py runserver"
