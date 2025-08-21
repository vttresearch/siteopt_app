# run_django.py

import os
import sys
from django.core.management import execute_from_command_line

# Set the settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# Run the server
execute_from_command_line(["manage.py", "runserver", "--noreload"])
