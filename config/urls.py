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
    path("api/fetch_input_file_tree/", views.fetch_input_file_tree, name="fetch_input_file_tree"),
    path("api/fetch_project_file_tree/", views.fetch_project_file_tree, name="fetch_project_file_tree"),
    path("api/fetch_work_folders_tree/", views.fetch_work_folders_tree, name="fetch_work_folders_tree"),
    path("api/post/<str:action>/", views.post, name="post"),
    path("api/health/", views.health_check, name="health_check"),
    path("api/settings/", views.settings, name="settings"),
    path("api/stream/execute/<str:job_id>", views.execute, name="execute"),
    path("debug/api/download_excel_file/", views.download_excel_file, name="dl_excel_file"),
    path("__reload__/", include("django_browser_reload.urls")),
]

# http://127.0.0.1:8000/admin/doc/ provides docs for the custom tag libraries that can be used
# with the load tag. For example, {% load static %}. Custom tag libraries must be added to
# INSTALLED_APPS. Note that {% load something % } is not inherited by child templates!
