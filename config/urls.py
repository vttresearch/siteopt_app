"""
URL configuration for djangoVue project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from siteoptapp import views

urlpatterns = [
    path('admin/doc/', include('django.contrib.admindocs.urls')),
    path("admin/", admin.site.urls),
    path("api/login/", views.login_view, name="login_view"),
    path("api/logout/", views.logout_view, name="logout_view"),
    path("api/me/", views.me_view, name="me_view"),
    path("api/users/", views.users, name="users"),
    path("api/register/", views.register_user, name="register_user"),
    path("api/fetch_current_input_folder/<str:folder_name>/", views.fetch_current_input_folder, name="fetch_current_input_folder"),
    path("api/post/<str:action>/", views.post, name="post"),
    path("api/upload/", views.upload_and_replace, name="upload_and_replace"),
    path("api/upload_input_csv/", views.upload_input_csv, name="upload_input_csv"),
    path("api/health/", views.health_check, name="health_check"),
    path("api/settings/", views.settings, name="settings"),
    path("api/stream/execute/<str:job_id>", views.execute, name="execute"),
]

# http://127.0.0.1:8000/admin/doc/ provides docs for the custom tag libraries that can be used
# with the load tag. For example, {% load static %}. Custom tag libraries must be added to
# INSTALLED_APPS. Note that {% load something % } is not inherited by child templates!
