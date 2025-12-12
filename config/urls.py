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
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.urls import re_path
from siteoptapp import views

urlpatterns = [
    path('admin/doc/', include('django.contrib.admindocs.urls')),
    path("admin/", admin.site.urls),
    path("api/fetch_input_data/", views.fetch_input_data, name="fetch_input"),
    path("api/fetch_data/<str:folder>/<str:fname>/", views.fetch_data, name="fetch_data"),
    path("api/fetch_data/<str:folder>/<str:fname>", views.fetch_data, name="fetch_data_no_slash"),
    path("api/post/<str:action>/", views.post, name="post"),
    path("api/health/", views.health_check, name="health_check"),
    path("api/settings/", views.settings, name="settings"),
    path("debug/api/download_excel_file/", views.download_excel_file, name="dl_excel_file"),
    path("api/upload_file/", views.upload_file, name="upload_file"),
    path("api/download_file/<path:file_path>", views.download_file, name="download_file"),
    # Work folder management
    path("api/work_folders/", views.list_work_folders, name="list_work_folders"),
    path("api/work_folders/create/", views.create_work_folder, name="create_work_folder"),
    path("api/work_folders/<int:folder_id>/", views.delete_work_folder, name="delete_work_folder"),
    path("api/work_folders/<int:folder_id>/tree/", views.fetch_work_folder_tree, name="fetch_work_folder_tree"),
    path("api/work_folders/<int:folder_id>/file/<path:file_path>", views.fetch_work_folder_file, name="fetch_work_folder_file"),
    path("api/work_folders/<int:folder_id>/upload/", views.upload_work_folder_file, name="upload_work_folder_file"),
    path("api/work_folders/<int:folder_id>/download/<path:file_path>", views.download_work_folder_file, name="download_work_folder_file"),
    path("api/work_folders/<int:folder_id>/download-zip/", views.download_work_folder_zip, name="download_work_folder_zip"),
    path("api/work_folders/<int:folder_id>/upload-zip/", views.upload_work_folder_zip, name="upload_work_folder_zip"),
    path("api/work_folders/<int:folder_id>/clear/", views.clear_work_folder, name="clear_work_folder"),
    path("api/work_folders/<int:folder_id>/save/", views.save_work_folder_file, name="save_work_folder_file"),
    path("api/save_file/", views.save_data_file, name="save_data_file"),
    # path("__reload__/", include("django_browser_reload.urls")),  # Disabled for production
    # Serve runtime config.js
    path("config.js", views.config_js, name="config_js"),
    # Serve static files
    re_path(r'^static/(?P<path>.*)$', views.static_file_handler, name="static_files"),
    # Serve frontend static assets
    re_path(r'^vite-assets/(?P<path>.*)$', views.frontend_static, name="frontend_static"),
    # Serve frontend for all other routes
    path("", views.frontend_view, name="frontend"),
]

# http://127.0.0.1:8000/admin/doc/ provides docs for the custom tag libraries that can be used
# with the load tag. For example, {% load static %}. Custom tag libraries must be added to
# INSTALLED_APPS. Note that {% load something % } is not inherited by child templates!
