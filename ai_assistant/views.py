import json
import logging
import queue
import threading
import time
import uuid
import hashlib
import subprocess
import re
import os
import pty
import select
import shutil
from pathlib import Path

from django.http import HttpResponseNotFound, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.conf import settings
from django.core.cache import cache

from siteoptapp.views import get_client_config, read_config_file

from ai_assistant.copilot_service import (
    CopilotIntegrationError,
    get_runtime_status,
    run_chat_message_with_token,
)


SESSION_CACHE_PREFIX = "ai_assistant:session:"
WORK_FOLDER_SDK_SESSION_PREFIX = "ai_assistant:work-folder-sdk-session:"
WORK_FOLDER_HISTORY_PREFIX = "ai_assistant:work-folder-history:"
logger = logging.getLogger("ai_assistant")

_AUTH_LOGIN_PROCESSES: dict[str, dict] = {}
_AUTH_LOGIN_LOCK = threading.Lock()


def _copilot_cli_path() -> str:
    configured = str(getattr(settings, "COPILOT_CLI_PATH", "") or "").strip()
    if configured:
        return configured
    return shutil.which("copilot") or ""


def _start_login_worker(login_id: str, cli_path: str) -> None:
    with _AUTH_LOGIN_LOCK:
        state = _AUTH_LOGIN_PROCESSES.get(login_id)
    if state is None:
        return

    code_pattern = re.compile(r"enter code\s+([A-Z0-9-]+)", re.IGNORECASE)
    url_pattern = re.compile(r"https://github\.com/login/device", re.IGNORECASE)

    def _append_log(line: str) -> None:
        with _AUTH_LOGIN_LOCK:
            current = _AUTH_LOGIN_PROCESSES.get(login_id)
            if current is None:
                return
            logs = current.setdefault("logs", [])
            logs.append(line)
            if len(logs) > 200:
                current["logs"] = logs[-200:]

    try:
        if not cli_path:
            raise FileNotFoundError("GitHub Copilot CLI not found in backend container")

        command = [cli_path, "login"]
        env = os.environ.copy()
        env.setdefault("HOME", str(Path.home()))
        master_fd, slave_fd = pty.openpty()
        process = subprocess.Popen(
            command,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            env=env,
            close_fds=True,
        )
        os.close(slave_fd)

        with _AUTH_LOGIN_LOCK:
            state = _AUTH_LOGIN_PROCESSES.get(login_id)
            if state is not None:
                state["pid"] = process.pid
                state["started_at"] = time.time()

        pending_text = ""
        sent_plaintext_confirm = False

        while True:
            if process.poll() is not None:
                break

            readable, _, _ = select.select([master_fd], [], [], 0.25)
            if not readable:
                continue

            try:
                chunk = os.read(master_fd, 4096)
            except OSError:
                break

            if not chunk:
                break

            text = chunk.decode("utf-8", errors="ignore")
            pending_text += text

            while "\n" in pending_text:
                line, pending_text = pending_text.split("\n", 1)
                clean_line = line.rstrip("\r")
                if clean_line:
                    _append_log(clean_line)

                code_match = code_pattern.search(clean_line)
                if code_match:
                    with _AUTH_LOGIN_LOCK:
                        current = _AUTH_LOGIN_PROCESSES.get(login_id)
                        if current is not None:
                            current["user_code"] = code_match.group(1)
                            current["verification_url"] = "https://github.com/login/device"

                if url_pattern.search(clean_line):
                    with _AUTH_LOGIN_LOCK:
                        current = _AUTH_LOGIN_PROCESSES.get(login_id)
                        if current is not None:
                            current["verification_url"] = "https://github.com/login/device"

            if (not sent_plaintext_confirm) and ("Store token in plaintext config file? (y/N)" in pending_text):
                os.write(master_fd, b"y\n")
                sent_plaintext_confirm = True
                _append_log("[auto] Accepted plaintext config token storage.")

        if pending_text.strip():
            _append_log(pending_text.strip())

        return_code = process.wait()
        with _AUTH_LOGIN_LOCK:
            current = _AUTH_LOGIN_PROCESSES.get(login_id)
            if current is not None:
                current["return_code"] = return_code
                current["state"] = "succeeded" if return_code == 0 else "failed"
                current["finished_at"] = time.time()
    except Exception as exc:
        with _AUTH_LOGIN_LOCK:
            current = _AUTH_LOGIN_PROCESSES.get(login_id)
            if current is not None:
                current.setdefault("logs", []).append(f"[error] {exc}")
                current["state"] = "failed"
                current["error"] = str(exc)
                current["finished_at"] = time.time()
    finally:
        try:
            os.close(master_fd)
        except Exception:
            pass


def _session_ttl_seconds() -> int:
    return int(getattr(settings, "AI_ASSISTANT_SESSION_TTL", 60 * 60 * 24))


def _ensure_client_id(request):
    client_id = request.COOKIES.get("client_id") or request.headers.get("X-Client-ID")
    new_client = False
    if not client_id:
        client_id = str(uuid.uuid4())
        new_client = True
    return client_id, new_client


def _session_cache_key(client_id: str, session_id: str) -> str:
    return f"{SESSION_CACHE_PREFIX}{client_id}:{session_id}"


def _work_folder_sdk_session_cache_key(client_id: str, context_dir: str, model: str | None = None) -> str:
    digest = hashlib.sha256(context_dir.encode("utf-8")).hexdigest()[:16]
    return f"{WORK_FOLDER_SDK_SESSION_PREFIX}{client_id}:{digest}"


def _get_work_folder_sdk_session_id(client_id: str, context_dir: str | None, model: str | None = None) -> str | None:
    if not context_dir:
        return None
    key = _work_folder_sdk_session_cache_key(client_id, context_dir, model=model)
    value = cache.get(key)
    return str(value).strip() if value else None


def _set_work_folder_sdk_session_id(
    client_id: str,
    context_dir: str | None,
    sdk_session_id: str | None,
    model: str | None = None,
) -> None:
    if not context_dir:
        return
    key = _work_folder_sdk_session_cache_key(client_id, context_dir, model=model)
    if sdk_session_id:
        cache.set(key, sdk_session_id, timeout=_session_ttl_seconds())
    else:
        cache.delete(key)


def _get_default_context_root() -> Path:
    raw = getattr(settings, "AI_ASSISTANT_CONTEXT_DIR", str(Path(settings.BASE_DIR) / "work"))
    root = Path(raw).resolve()
    return root if root.exists() else Path(settings.BASE_DIR).resolve()


def _path_log_snapshot(path: Path, max_children: int = 8) -> dict:
    info = {
        "path": str(path),
        "exists": path.exists(),
        "readable": os.access(path, os.R_OK),
        "writable": os.access(path, os.W_OK),
        "executable": os.access(path, os.X_OK),
    }
    if not path.exists():
        return info

    info["is_dir"] = path.is_dir()
    info["is_file"] = path.is_file()
    try:
        stat_result = path.stat()
        info["mode"] = oct(stat_result.st_mode & 0o777)
        info["uid"] = stat_result.st_uid
        info["gid"] = stat_result.st_gid
    except Exception as exc:
        info["stat_error"] = str(exc)

    if path.is_dir():
        try:
            info["children"] = sorted(entry.name for entry in path.iterdir())[:max_children]
        except Exception as exc:
            info["children_error"] = str(exc)
    return info


def _log_session_path_diagnostics(
    *,
    stage: str,
    client_id: str,
    requested_context_dir: str | None,
    validated_context_dir: str | None,
    allowed_paths: list[Path],
    model: str | None,
    ollama_base_url: str | None,
    sdk_session_id: str | None,
) -> None:
    validated_path = Path(validated_context_dir).resolve() if validated_context_dir else None
    current_input = (validated_path / "current_input").resolve() if validated_path else None
    logger.info(
        "assistant.session.path_diagnostics stage=%s client_id=%s requested_context_dir=%s validated_context_dir=%s model=%s ollama_base_url=%s sdk_session_id=%s default_context_root=%s allowed_paths=%s validated_snapshot=%s current_input_snapshot=%s",
        stage,
        client_id,
        requested_context_dir or "",
        validated_context_dir or "",
        model or "",
        ollama_base_url or "",
        sdk_session_id or "",
        _get_default_context_root(),
        [str(path) for path in allowed_paths],
        json.dumps(_path_log_snapshot(validated_path), ensure_ascii=False) if validated_path else "",
        json.dumps(_path_log_snapshot(current_input), ensure_ascii=False) if current_input else "",
    )


def _validate_client_work_dir(client_id: str, context_dir: str | None) -> str | None:
    if not context_dir:
        return None

    client_config = get_client_config(client_id)
    config = read_config_file(client_config.config_path)
    allowed_paths = [Path(path).resolve() for path in (config.get("work_folders", {}) or {}).values()]
    candidate = Path(context_dir).resolve()

    selected_work_dir: Path | None = None
    if candidate in allowed_paths:
        selected_work_dir = candidate
    else:
        for allowed in allowed_paths:
            try:
                candidate.relative_to(allowed)
                selected_work_dir = allowed
                break
            except ValueError:
                continue

    if selected_work_dir is None:
        logger.warning(
            "assistant.session.invalid_context client_id=%s context_dir=%s allowed_paths=%s reason=not_under_allowed_work_folder",
            client_id,
            candidate,
            [str(path) for path in allowed_paths],
        )
        return None

    current_input = (selected_work_dir / "current_input").resolve()
    if not current_input.exists() or not current_input.is_dir():
        logger.warning(
            "assistant.session.invalid_context client_id=%s context_dir=%s selected_work_dir=%s reason=missing_current_input",
            client_id,
            candidate,
            selected_work_dir,
        )
        return None

    root = _get_default_context_root()
    try:
        selected_work_dir.relative_to(root)
    except ValueError:
        logger.warning(
            "assistant.session.invalid_context client_id=%s context_dir=%s selected_work_dir=%s reason=outside_context_root root=%s",
            client_id,
            candidate,
            selected_work_dir,
            root,
        )
        return None

    return str(selected_work_dir)


def _get_or_create_session(client_id: str, session_id: str, context_dir: str | None = None) -> dict:
    key = _session_cache_key(client_id, session_id)
    state = cache.get(key)
    if state:
        return state
    validated_context_dir = _validate_client_work_dir(client_id, context_dir)
    default_model = str(getattr(settings, "AI_ASSISTANT_MODEL", "gpt-5-mini") or "gpt-5-mini")
    state = {
        "session_id": session_id,
        "history": [],
        "context_dir": validated_context_dir,
        "system_prompt": None,
        "model": default_model,
        "ollama_base_url": None,
        "sdk_session_id": _get_work_folder_sdk_session_id(client_id, validated_context_dir, model=default_model),
    }
    cache.set(key, state, timeout=_session_ttl_seconds())
    return state


def _save_session(client_id: str, session_id: str, state: dict) -> None:
    cache.set(_session_cache_key(client_id, session_id), state, timeout=_session_ttl_seconds())


def _normalize_requested_ollama_base_url(value: str | None) -> str | None:
    candidate = str(value or "").strip()
    return candidate or None


def _history_limit() -> int:
    return int(getattr(settings, "AI_ASSISTANT_HISTORY_LIMIT", 50))


def _work_folder_history_cache_key(client_id: str, context_dir: str) -> str:
    digest = hashlib.sha256(context_dir.encode("utf-8")).hexdigest()[:16]
    return f"{WORK_FOLDER_HISTORY_PREFIX}{client_id}:{digest}"


def _get_work_folder_history(client_id: str, context_dir: str | None) -> list[dict[str, str]]:
    if not context_dir:
        return []
    key = _work_folder_history_cache_key(client_id, context_dir)
    value = cache.get(key)
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role in {"user", "assistant", "system"} and content:
            normalized.append({"role": role, "content": content})
    return normalized[-_history_limit():]


def _set_work_folder_history(client_id: str, context_dir: str | None, history: list[dict[str, str]]) -> list[dict[str, str]]:
    if not context_dir:
        return []
    normalized: list[dict[str, str]] = []
    for item in history:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip().lower()
        content = str(item.get("content") or "").strip()
        if role in {"user", "assistant", "system"} and content:
            normalized.append({"role": role, "content": content})
    normalized = normalized[-_history_limit():]
    key = _work_folder_history_cache_key(client_id, context_dir)
    cache.set(key, normalized, timeout=_session_ttl_seconds())
    return normalized


def _apply_requested_model(client_id: str, session_state: dict, requested_model: str | None) -> None:
    model = (requested_model or "").strip()
    if not model:
        return

    current_model = str(session_state.get("model") or "").strip()
    if current_model == model:
        return

    session_state["model"] = model
    session_state["sdk_session_id"] = None
    _set_work_folder_sdk_session_id(
        client_id,
        session_state.get("context_dir"),
        None,
        model=model,
    )


def _apply_requested_ollama_base_url(client_id: str, session_state: dict, requested_ollama_base_url: str | None) -> None:
    next_base_url = _normalize_requested_ollama_base_url(requested_ollama_base_url)
    current_base_url = _normalize_requested_ollama_base_url(session_state.get("ollama_base_url"))
    if current_base_url == next_base_url:
        return

    session_state["ollama_base_url"] = next_base_url
    session_state["sdk_session_id"] = None
    _set_work_folder_sdk_session_id(
        client_id,
        session_state.get("context_dir"),
        None,
        model=session_state.get("model"),
    )


@csrf_protect
def chat(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "POST":
        return JsonResponse(
            {"success": False, "error": "Method not allowed. Use POST."},
            status=405,
        )

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON payload."}, status=400)

    user_message = (payload.get("message") or "").strip()
    if not user_message:
        return JsonResponse({"success": False, "error": "Field 'message' is required."}, status=400)

    session_id = (payload.get("session_id") or "default").strip() or "default"
    context_dir_override = (payload.get("context_dir") or "").strip() or None
    requested_model = (payload.get("model") or "").strip() or None
    requested_ollama_base_url = _normalize_requested_ollama_base_url(payload.get("ollama_base_url"))
    started = time.monotonic()

    client_id, new_client = _ensure_client_id(request)
    token_from_request = (payload.get("github_token") or "").strip() or None
    effective_token = token_from_request or (settings.COPILOT_GITHUB_TOKEN or None)
    session_state = _get_or_create_session(client_id, session_id, context_dir=context_dir_override)
    if not session_state.get("context_dir"):
        logger.warning("assistant.chat.unbound_session client_id=%s session_id=%s", client_id, session_id)
        return JsonResponse(
            {
                "success": False,
                "error": "Assistant session is not bound to a valid work folder. Create a new session from an active project first.",
            },
            status=400,
        )

    _apply_requested_model(client_id, session_state, requested_model)
    _apply_requested_ollama_base_url(client_id, session_state, requested_ollama_base_url)

    folder_history = _get_work_folder_history(client_id, session_state.get("context_dir"))
    session_state["history"] = folder_history

    try:
        logger.info(
            "assistant.chat.start client_id=%s session_id=%s context_dir=%s msg_chars=%s",
            client_id,
            session_id,
            session_state.get("context_dir"),
            len(user_message),
        )
        assistant_result = run_chat_message_with_token(
            user_message,
            github_token=effective_token,
            history=folder_history,
            context_dir=session_state.get("context_dir"),
            system_prompt=session_state.get("system_prompt"),
            model_override=session_state.get("model"),
            ollama_base_url_override=session_state.get("ollama_base_url"),
            sdk_session_id=session_state.get("sdk_session_id"),
        )
    except CopilotIntegrationError as exc:
        logger.warning("assistant.chat.integration_error client_id=%s session_id=%s error=%s", client_id, session_id, exc)
        return JsonResponse({"success": False, "error": str(exc)}, status=503)
    except Exception as exc:
        logger.exception("assistant.chat.error client_id=%s session_id=%s error=%s", client_id, session_id, exc)
        return JsonResponse({"success": False, "error": f"Assistant error: {exc}"}, status=500)

    if isinstance(assistant_result, dict):
        assistant_reply = str(assistant_result.get("message") or "")
        trace = assistant_result.get("trace") if isinstance(assistant_result.get("trace"), list) else []
        plot_payload = assistant_result.get("plot") if isinstance(assistant_result.get("plot"), dict) else None
        sdk_session_id = str(assistant_result.get("sdk_session_id") or "").strip() or None
    else:
        assistant_reply = str(assistant_result)
        trace = []
        plot_payload = None
        sdk_session_id = None

    if sdk_session_id:
        session_state["sdk_session_id"] = sdk_session_id
        _set_work_folder_sdk_session_id(
            client_id,
            session_state.get("context_dir"),
            sdk_session_id,
            model=session_state.get("model"),
        )

    session_history = folder_history
    session_history.append({"role": "user", "content": user_message})
    session_history.append({"role": "assistant", "content": assistant_reply})
    session_state["history"] = _set_work_folder_history(client_id, session_state.get("context_dir"), session_history)
    _save_session(client_id, session_id, session_state)

    elapsed = time.monotonic() - started
    logger.info(
        "assistant.chat.success client_id=%s session_id=%s elapsed=%.2fs plot=%s",
        client_id,
        session_id,
        elapsed,
        bool(plot_payload),
    )

    response = JsonResponse(
        {
            "success": True,
            "data": {
                "message": assistant_reply,
                "session_id": session_id,
                "history": session_state["history"],
                "context_dir": session_state.get("context_dir"),
                "model": session_state.get("model"),
                "ollama_base_url": session_state.get("ollama_base_url"),
                "sdk_session_id": session_state.get("sdk_session_id"),
                "plot": plot_payload,
                "trace": trace,
            },
        }
    )
    if new_client:
        response.set_cookie("client_id", client_id, httponly=False, samesite="Lax", max_age=31536000)
    return response


@csrf_protect
def chat_stream(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "POST":
        return JsonResponse(
            {"success": False, "error": "Method not allowed. Use POST."},
            status=405,
        )

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON payload."}, status=400)

    user_message = (payload.get("message") or "").strip()
    if not user_message:
        return JsonResponse({"success": False, "error": "Field 'message' is required."}, status=400)

    session_id = (payload.get("session_id") or "default").strip() or "default"
    context_dir_override = (payload.get("context_dir") or "").strip() or None
    requested_model = (payload.get("model") or "").strip() or None
    requested_ollama_base_url = _normalize_requested_ollama_base_url(payload.get("ollama_base_url"))

    client_id, new_client = _ensure_client_id(request)
    token_from_request = (payload.get("github_token") or "").strip() or None
    effective_token = token_from_request or (settings.COPILOT_GITHUB_TOKEN or None)
    session_state = _get_or_create_session(client_id, session_id, context_dir=context_dir_override)
    if not session_state.get("context_dir"):
        return JsonResponse(
            {
                "success": False,
                "error": "Assistant session is not bound to a valid work folder. Create a new session from an active project first.",
            },
            status=400,
        )

    _apply_requested_model(client_id, session_state, requested_model)
    _apply_requested_ollama_base_url(client_id, session_state, requested_ollama_base_url)

    folder_history = _get_work_folder_history(client_id, session_state.get("context_dir"))
    session_state["history"] = folder_history

    started = time.monotonic()
    event_queue: queue.Queue = queue.Queue()
    done_marker = object()

    def emit(event_type: str, payload_obj: dict):
        event_queue.put(
            f"event: {event_type}\n"
            + "data: "
            + json.dumps(payload_obj, ensure_ascii=False)
            + "\n\n"
        )

    def worker() -> None:
        try:
            logger.info(
                "assistant.chat_stream.start client_id=%s session_id=%s context_dir=%s msg_chars=%s",
                client_id,
                session_id,
                session_state.get("context_dir"),
                len(user_message),
            )

            def on_trace(entry: dict):
                emit("trace", {"entry": entry})

            assistant_result = run_chat_message_with_token(
                user_message,
                github_token=effective_token,
                history=folder_history,
                context_dir=session_state.get("context_dir"),
                system_prompt=session_state.get("system_prompt"),
                model_override=session_state.get("model"),
                ollama_base_url_override=session_state.get("ollama_base_url"),
                sdk_session_id=session_state.get("sdk_session_id"),
                event_callback=on_trace,
            )

            if isinstance(assistant_result, dict):
                assistant_reply = str(assistant_result.get("message") or "")
                trace = assistant_result.get("trace") if isinstance(assistant_result.get("trace"), list) else []
                plot_payload = assistant_result.get("plot") if isinstance(assistant_result.get("plot"), dict) else None
                sdk_session_id = str(assistant_result.get("sdk_session_id") or "").strip() or None
            else:
                assistant_reply = str(assistant_result)
                trace = []
                plot_payload = None
                sdk_session_id = None

            if sdk_session_id:
                session_state["sdk_session_id"] = sdk_session_id
                _set_work_folder_sdk_session_id(
                    client_id,
                    session_state.get("context_dir"),
                    sdk_session_id,
                    model=session_state.get("model"),
                )

            session_history = folder_history
            session_history.append({"role": "user", "content": user_message})
            session_history.append({"role": "assistant", "content": assistant_reply})
            session_state["history"] = _set_work_folder_history(client_id, session_state.get("context_dir"), session_history)
            _save_session(client_id, session_id, session_state)

            elapsed = time.monotonic() - started
            logger.info(
                "assistant.chat_stream.success client_id=%s session_id=%s elapsed=%.2fs plot=%s",
                client_id,
                session_id,
                elapsed,
                bool(plot_payload),
            )
            emit(
                "final",
                {
                    "success": True,
                    "data": {
                        "message": assistant_reply,
                        "session_id": session_id,
                        "history": session_state["history"],
                        "context_dir": session_state.get("context_dir"),
                        "model": session_state.get("model"),
                        "ollama_base_url": session_state.get("ollama_base_url"),
                        "sdk_session_id": session_state.get("sdk_session_id"),
                        "plot": plot_payload,
                        "trace": trace,
                    },
                },
            )
        except CopilotIntegrationError as exc:
            logger.warning(
                "assistant.chat_stream.integration_error client_id=%s session_id=%s error=%s",
                client_id,
                session_id,
                exc,
            )
            emit("error", {"success": False, "error": str(exc)})
        except Exception as exc:
            logger.exception("assistant.chat_stream.error client_id=%s session_id=%s error=%s", client_id, session_id, exc)
            emit("error", {"success": False, "error": f"Assistant error: {exc}"})
        finally:
            event_queue.put(done_marker)

    def event_stream():
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        yield "event: status\ndata: {\"status\": \"started\"}\n\n"
        while True:
            item = event_queue.get()
            if item is done_marker:
                break
            yield item

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    if new_client:
        response.set_cookie("client_id", client_id, httponly=False, samesite="Lax", max_age=31536000)
    return response


@csrf_protect
def session_new(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Method not allowed. Use POST."}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON payload."}, status=400)

    context_dir = (payload.get("context_dir") or "").strip() or None
    system_prompt = (payload.get("system_prompt") or "").strip() or None
    model = (payload.get("model") or "").strip() or str(getattr(settings, "AI_ASSISTANT_MODEL", "gpt-5-mini") or "gpt-5-mini")
    ollama_base_url = _normalize_requested_ollama_base_url(payload.get("ollama_base_url"))

    client_id, new_client = _ensure_client_id(request)
    validated_context_dir = _validate_client_work_dir(client_id, context_dir)
    if not validated_context_dir:
        return JsonResponse(
            {
                "success": False,
                "error": "Field 'context_dir' must point to an existing client work folder with current_input.",
            },
            status=400,
        )

    client_config = get_client_config(client_id)
    config = read_config_file(client_config.config_path)
    allowed_paths = [Path(path).resolve() for path in (config.get("work_folders", {}) or {}).values()]

    session_id = str(uuid.uuid4())
    history = _get_work_folder_history(client_id, validated_context_dir)
    state = {
        "session_id": session_id,
        "history": history,
        "context_dir": validated_context_dir,
        "system_prompt": system_prompt,
        "model": model,
        "ollama_base_url": ollama_base_url,
        "sdk_session_id": _get_work_folder_sdk_session_id(client_id, validated_context_dir, model=model),
    }
    _save_session(client_id, session_id, state)
    logger.info("assistant.session.new client_id=%s session_id=%s context_dir=%s", client_id, session_id, validated_context_dir)
    _log_session_path_diagnostics(
        stage="session_new",
        client_id=client_id,
        requested_context_dir=context_dir,
        validated_context_dir=validated_context_dir,
        allowed_paths=allowed_paths,
        model=model,
        ollama_base_url=ollama_base_url,
        sdk_session_id=state.get("sdk_session_id"),
    )

    response = JsonResponse(
        {
            "success": True,
            "data": {
                "session_id": session_id,
                "history": history,
                "context_dir": state["context_dir"],
                "model": state["model"],
                "ollama_base_url": state.get("ollama_base_url"),
                "sdk_session_id": state.get("sdk_session_id"),
            },
        }
    )
    if new_client:
        response.set_cookie("client_id", client_id, httponly=False, samesite="Lax", max_age=31536000)
    return response


@csrf_protect
def session_reset(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Method not allowed. Use POST."}, status=405)

    try:
        payload = json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON payload."}, status=400)

    session_id = (payload.get("session_id") or "").strip()
    if not session_id:
        return JsonResponse({"success": False, "error": "Field 'session_id' is required."}, status=400)

    client_id, _ = _ensure_client_id(request)
    key = _session_cache_key(client_id, session_id)
    state = cache.get(key)
    if state is None:
        return JsonResponse({"success": True, "data": {"session_id": session_id, "history": []}})

    state["history"] = []
    _set_work_folder_sdk_session_id(client_id, state.get("context_dir"), None, model=state.get("model"))
    _set_work_folder_history(client_id, state.get("context_dir"), [])
    state["sdk_session_id"] = None
    _save_session(client_id, session_id, state)
    logger.info("assistant.session.reset client_id=%s session_id=%s", client_id, session_id)
    return JsonResponse({"success": True, "data": {"session_id": session_id, "history": []}})


@csrf_protect
@ensure_csrf_cookie
def auth_status(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "GET":
        return JsonResponse({"success": False, "error": "Method not allowed. Use GET."}, status=405)

    client_id, new_client = _ensure_client_id(request)
    ollama_base_url_override = _normalize_requested_ollama_base_url(request.GET.get("ollama_base_url"))
    status = get_runtime_status(ollama_base_url_override=ollama_base_url_override)
    status["has_cached_token"] = False

    response = JsonResponse({"success": True, "data": status})
    if new_client:
        response.set_cookie("client_id", client_id, httponly=False, samesite="Lax", max_age=31536000)
    return response


@csrf_protect
def auth_login_start(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Method not allowed. Use POST."}, status=405)

    client_id, _ = _ensure_client_id(request)
    login_id = str(uuid.uuid4())
    cli_path = _copilot_cli_path()
    if not cli_path:
        return JsonResponse(
            {
                "success": False,
                "error": "GitHub Copilot CLI is not installed in the backend container. Rebuild the dev backend image.",
            },
            status=503,
        )

    with _AUTH_LOGIN_LOCK:
        _AUTH_LOGIN_PROCESSES[login_id] = {
            "login_id": login_id,
            "client_id": client_id,
            "state": "running",
            "created_at": time.time(),
            "logs": [],
            "verification_url": "https://github.com/login/device",
            "user_code": None,
            "return_code": None,
        }

    worker = threading.Thread(target=_start_login_worker, args=(login_id, cli_path), daemon=True)
    worker.start()

    return JsonResponse(
        {
            "success": True,
            "data": {
                "login_id": login_id,
                "state": "running",
                "verification_url": "https://github.com/login/device",
                "user_code": None,
            },
        }
    )


@csrf_protect
def auth_login_status(request):
    if not getattr(settings, "ENABLE_AI_ASSISTANT", False):
        return HttpResponseNotFound()

    if request.method != "GET":
        return JsonResponse({"success": False, "error": "Method not allowed. Use GET."}, status=405)

    login_id = (request.GET.get("login_id") or "").strip()
    if not login_id:
        return JsonResponse({"success": False, "error": "Query parameter 'login_id' is required."}, status=400)

    with _AUTH_LOGIN_LOCK:
        state = _AUTH_LOGIN_PROCESSES.get(login_id)
        if state is None:
            return JsonResponse({"success": False, "error": "Unknown login_id."}, status=404)

        payload = {
            "login_id": login_id,
            "state": state.get("state") or "running",
            "verification_url": state.get("verification_url") or "https://github.com/login/device",
            "user_code": state.get("user_code"),
            "return_code": state.get("return_code"),
            "logs": list(state.get("logs") or [])[-40:],
        }

    return JsonResponse({"success": True, "data": payload})
