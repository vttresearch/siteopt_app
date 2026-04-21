"""
This script makes accounts based on the old client_id's so that old projects become visible in the UI.
Instructions:
1. Run script
python manage.py import_client_ids
Users created this way have no usable password, so each user must make an admin user
and set the passwords in Django admin.
2. Create admin account
python manage.py createsuperuser
3. Set the passwords in http://localhost:8000/admin/
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from pathlib import Path

WORK_ROOT = Path("work_container/")


class Command(BaseCommand):
    help = "Create users from existing client_id folders"

    def handle(self, *args, **options):
        for p in WORK_ROOT.iterdir():
            if not p.is_dir():
                continue

            username = p.name

            if User.objects.filter(username=username).exists():
                self.stdout.write(f"Exists: {username}")
                continue

            User.objects.create_user(
                username=username,
                password=None,   # unusable password
            )
            self.stdout.write(f"Created user: {username}")
