from django.urls import path

from . import views


urlpatterns = [
    path("chat/", views.chat, name="assistant_chat"),
    path("chat/stream/", views.chat_stream, name="assistant_chat_stream"),
    path("session/new/", views.session_new, name="assistant_session_new"),
    path("session/reset/", views.session_reset, name="assistant_session_reset"),
    path("auth/status/", views.auth_status, name="assistant_auth_status"),
    path("auth/login/start/", views.auth_login_start, name="assistant_auth_login_start"),
    path("auth/login/status/", views.auth_login_status, name="assistant_auth_login_status"),
]
