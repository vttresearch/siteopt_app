import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.conf import settings


class Command(BaseCommand):
    help = "Create a superuser in production if it does not already exist"

    def handle(self, *args, **options):
        # Don't run in development
        if settings.DEBUG:
            self.stdout.write("DEBUG=True, skipping superuser creation")
            return
        username = os.getenv("DJANGO_SUPERUSER_USERNAME")
        email = os.getenv("DJANGO_SUPERUSER_EMAIL")
        password = os.getenv("DJANGO_SUPERUSER_PASSWORD")
        if not all([username, email, password]):
            self.stderr.write("Superuser env vars not fully set, skipping")
            return
        User = get_user_model()
        if User.objects.filter(username=username).exists():
            self.stdout.write(f"Superuser '{username}' already exists")
            return
        User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(f"Superuser '{username}' created")
