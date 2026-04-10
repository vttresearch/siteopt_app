import asyncio
import inspect
import json
import logging
import os
import subprocess
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from django.conf import settings

from ai_assistant.tools import (
    normalize_plot_payload,
    read_current_input_summary,
    resolve_current_input_dir,
)


class CopilotIntegrationError(Exception):
    pass


logger = logging.getLogger("ai_assistant")

_BLOCKED_AGENT_TOOLS = [
    "task",
    "read_agent",
    "write_agent",
    "wait",
    "kill",
]

_OLLAMA_CACHE: dict[str, Any] = {
    "at": 0.0,
    "models": [],
    "key": "",
}


class _PermissionApproval(dict):
    def __getattr__(self, name: str) -> Any:
        return self.get(name)


def _load_copilot_sdk_classes() -> tuple[Any, Any]:
    try:
        from copilot import CopilotClient
    except ImportError as exc:
        raise CopilotIntegrationError(
            "github-copilot-sdk is not installed or the 'copilot' module is unavailable in the backend runtime."
        ) from exc

    try:
        from copilot.tools import Tool
    except ImportError:
        try:
            from copilot import Tool
        except ImportError as exc:
            raise CopilotIntegrationError(
                "Installed github-copilot-sdk is incompatible with this backend: missing Tool API."
            ) from exc

    return CopilotClient, Tool


def _accepts_keyword_session_args(method: Any, skip_positional: int = 0) -> bool:
    try:
        parameters = list(inspect.signature(method).parameters.values())
    except (TypeError, ValueError):
        return False
    if len(parameters) <= skip_positional:
        return False
    return parameters[skip_positional].kind is inspect.Parameter.KEYWORD_ONLY


async def _create_sdk_session(client: Any, session_config: dict[str, Any]) -> Any:
    if _accepts_keyword_session_args(client.create_session):
        return await client.create_session(**session_config)
    return await client.create_session(session_config)


async def _resume_sdk_session(client: Any, session_id: str, session_config: dict[str, Any]) -> Any:
    if _accepts_keyword_session_args(client.resume_session, skip_positional=1):
        return await client.resume_session(session_id, **session_config)
    return await client.resume_session(session_id, session_config)


def _split_csv_values(value: str | None) -> list[str]:
    raw = str(value or "")
    return [item.strip() for item in raw.split(",") if item.strip()]


def _parse_ollama_list_output(text: str) -> list[str]:
    models: list[str] = []
    for idx, line in enumerate((text or "").splitlines()):
        stripped = line.strip()
        if not stripped:
            continue
        if idx == 0 and stripped.lower().startswith("name"):
            continue
        name = stripped.split()[0].strip()
        if name:
            models.append(name)
    return models


def _normalize_ollama_base_url(base_url: str | None) -> str:
    candidate = str(base_url or "").strip()
    if not candidate:
        candidate = str(getattr(settings, "AI_ASSISTANT_OLLAMA_BASE_URL", "http://localhost:11434/v1") or "").strip()
    if not candidate:
        return ""
    if "://" not in candidate:
        candidate = f"http://{candidate}"
    parsed = urllib.parse.urlparse(candidate)
    scheme = parsed.scheme or "http"
    netloc = parsed.netloc or parsed.path
    path = parsed.path if parsed.netloc else ""
    normalized_path = path.rstrip("/")
    if not normalized_path:
        normalized_path = "/v1"
    elif not normalized_path.endswith("/v1"):
        normalized_path = normalized_path + "/v1"
    return urllib.parse.urlunparse((scheme, netloc, normalized_path, "", "", ""))


def _fetch_ollama_models_from_http(base_url: str) -> list[str]:
    if not base_url:
        return []

    parsed = urllib.parse.urlparse(base_url)
    models_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "/v1/models", "", "", ""))
    request = urllib.request.Request(models_url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=6) as response:
        payload = json.loads(response.read().decode("utf-8"))

    data = payload.get("data", []) if isinstance(payload, dict) else []
    discovered: list[str] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        model_name = str(item.get("id") or item.get("name") or "").strip()
        if model_name:
            discovered.append(model_name)
    return discovered


def get_local_ollama_models(force_refresh: bool = False, base_url_override: str | None = None) -> list[str]:
    configured = _split_csv_values(getattr(settings, "AI_ASSISTANT_OLLAMA_MODELS", ""))
    auto_discover = bool(getattr(settings, "AI_ASSISTANT_OLLAMA_AUTO_DISCOVER", True))
    cache_seconds = int(getattr(settings, "AI_ASSISTANT_OLLAMA_MODEL_CACHE_SECONDS", 20))
    normalized_base_url = _normalize_ollama_base_url(base_url_override)
    cache_key = normalized_base_url or "default"

    if not auto_discover:
        return configured

    now = time.monotonic()
    if (
        not force_refresh
        and _OLLAMA_CACHE.get("key") == cache_key
        and (now - float(_OLLAMA_CACHE.get("at", 0.0))) <= cache_seconds
    ):
        cached = _OLLAMA_CACHE.get("models", [])
        if isinstance(cached, list):
            return cached

    discovered: list[str] = []
    if normalized_base_url:
        try:
            discovered = _fetch_ollama_models_from_http(normalized_base_url)
        except Exception as exc:
            logger.info("assistant.ollama.http_list_unavailable base_url=%s error=%s", normalized_base_url, exc)
    else:
        try:
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                timeout=6,
                check=False,
            )
            if result.returncode == 0:
                discovered = _parse_ollama_list_output(result.stdout)
            else:
                logger.warning("assistant.ollama.list_failed returncode=%s stderr=%s", result.returncode, result.stderr)
        except Exception as exc:
            logger.info("assistant.ollama.list_unavailable error=%s", exc)

    merged: list[str] = []
    seen: set[str] = set()
    for model_name in [*configured, *discovered]:
        normalized = model_name.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        merged.append(model_name.strip())

    _OLLAMA_CACHE["at"] = now
    _OLLAMA_CACHE["models"] = merged
    _OLLAMA_CACHE["key"] = cache_key
    return merged


def _resolve_ollama_provider(model_name: str | None, base_url_override: str | None = None) -> dict[str, str] | None:
    candidate = str(model_name or "").strip()
    if not candidate:
        return None

    normalized_base_url = _normalize_ollama_base_url(base_url_override)
    local_models = get_local_ollama_models(base_url_override=normalized_base_url)
    lower_local_models = {name.lower() for name in local_models}
    if candidate.lower() not in lower_local_models:
        if ":" not in candidate:
            return None
        logger.warning(
            "assistant.ollama.model_not_listed model=%s listed_count=%s; using Ollama provider by tag fallback",
            candidate,
            len(local_models),
        )

    base_url = normalized_base_url
    if not base_url:
        return None

    provider_type = str(getattr(settings, "AI_ASSISTANT_OLLAMA_PROVIDER_TYPE", "openai") or "openai").strip() or "openai"
    return {
        "type": provider_type,
        "base_url": base_url,
    }


def _is_cli_authenticated(cli_path: str) -> bool:
    candidate = str(cli_path or "").strip()
    if not candidate:
        return False

    try:
        result = subprocess.run(
            [
                candidate,
                "-p",
                "Reply exactly with: ok",
                "--silent",
                "--allow-all-tools",
                "--allow-all-paths",
                "--allow-all-urls",
            ],
            capture_output=True,
            text=True,
            timeout=8,
            check=False,
        )
    except Exception:
        return False

    combined = f"{result.stdout}\n{result.stderr}".lower()
    if "no authentication information found" in combined:
        return False
    if "couldn't authenticate" in combined or "could not authenticate" in combined:
        return False
    return result.returncode == 0


def get_runtime_status(token_override: str | None = None, ollama_base_url_override: str | None = None) -> dict[str, Any]:
    configured_cli_path = (settings.COPILOT_CLI_PATH or "").strip()
    resolved_cli_path = configured_cli_path or shutil.which("copilot") or ""
    sdk_installed = True
    try:
        import copilot  # noqa: F401
    except ImportError:
        sdk_installed = False

    configured_model = _resolve_model_name()
    normalized_base_url = _normalize_ollama_base_url(ollama_base_url_override)
    effective_provider = _resolve_ollama_provider(configured_model, base_url_override=normalized_base_url)
    local_models = get_local_ollama_models(base_url_override=normalized_base_url)
    cli_authenticated = _is_cli_authenticated(resolved_cli_path)

    return {
        "enabled": bool(getattr(settings, "ENABLE_AI_ASSISTANT", False)),
        "sdk_installed": sdk_installed,
        "configured_cli_path": configured_cli_path,
        "resolved_cli_path": resolved_cli_path,
        "cli_available": bool(resolved_cli_path),
        "has_token": bool(token_override or settings.COPILOT_GITHUB_TOKEN or cli_authenticated),
        "cli_authenticated": cli_authenticated,
        "effective_model": configured_model or "auto",
        "effective_provider": "ollama" if effective_provider else "copilot",
        "local_ollama_base_url": normalized_base_url,
        "local_models": local_models,
        "context_dir": str(_resolve_context_dir(None)),
    }


def _resolve_context_dir(context_dir_override: str | None) -> Path:
    default_context = getattr(settings, "AI_ASSISTANT_CONTEXT_DIR", str(Path(settings.BASE_DIR) / "work"))
    candidate = (context_dir_override or default_context or "").strip()
    if not candidate:
        return Path(settings.BASE_DIR).resolve()

    resolved = Path(candidate).resolve()
    return resolved if resolved.exists() else Path(settings.BASE_DIR).resolve()


def _resolve_tool_cwd(context_dir_override: str | None) -> Path:
    resolved = _resolve_context_dir(context_dir_override)
    try:
        return resolve_current_input_dir(str(resolved))
    except Exception:
        return resolved


def _client_option_value(config: Any, field_name: str, default: Any = None) -> Any:
    if config is None:
        return default
    if isinstance(config, dict):
        return config.get(field_name, default)
    return getattr(config, field_name, default)


def _build_client_options(token_override: str | None = None, context_dir_override: str | None = None) -> Any:
    from copilot.client import ExternalServerConfig, SubprocessConfig

    cli_url = str(getattr(settings, "COPILOT_CLI_URL", "") or "").strip()
    if cli_url:
        return ExternalServerConfig(cli_url)

    cli_args = list(getattr(settings, "AI_ASSISTANT_COPILOT_CLI_ARGS", []) or [])
    effective_token = token_override or settings.COPILOT_GITHUB_TOKEN or None
    cli_path = str(getattr(settings, "COPILOT_CLI_PATH", "") or "").strip() or None
    return SubprocessConfig(
        cli_path=cli_path,
        cli_args=cli_args,
        cwd=str(_resolve_tool_cwd(context_dir_override)),
        github_token=effective_token,
    )


def _resolve_model_name(model_override: str | None = None) -> str | None:
    configured_model = str(model_override or getattr(settings, "AI_ASSISTANT_MODEL", "") or "").strip()
    if not configured_model:
        return None
    if configured_model.lower() in {"auto", "default", "github-copilot", "copilot"}:
        return None
    return configured_model


def _load_system_prompt(system_prompt_override: str | None = None) -> str:
    if system_prompt_override and system_prompt_override.strip():
        return system_prompt_override.strip()

    prompt_file_raw = str(getattr(settings, "AI_ASSISTANT_SYSTEM_PROMPT_FILE", "") or "").strip()
    if prompt_file_raw:
        prompt_path = Path(prompt_file_raw)
        if not prompt_path.is_absolute():
            prompt_path = Path(settings.BASE_DIR) / prompt_path
        try:
            if prompt_path.exists() and prompt_path.is_file():
                file_prompt = prompt_path.read_text(encoding="utf-8").strip()
                if file_prompt:
                    return file_prompt
        except Exception as exc:
            logger.warning("assistant.system_prompt.load_failed path=%s error=%s", prompt_path, exc)

    fallback = str(getattr(settings, "AI_ASSISTANT_SYSTEM_PROMPT", "") or "").strip()
    if fallback:
        return fallback
    return "You are a helpful assistant."


def _print_system_prompt_for_debug() -> None:
    try:
        prompt_text = _load_system_prompt(None)
        if prompt_text:
            print("AI Assistant system prompt:")
            print("-----")
            print(prompt_text)
            print("-----")
            logger.info("assistant.system_prompt.printed length=%s", len(prompt_text))
    except Exception:
        pass


def _print_runtime_diagnostics_for_debug() -> None:
    try:
        status = get_runtime_status()
        logger.info(
            "assistant.runtime.startup enabled=%s sdk_installed=%s cli_available=%s configured_cli_path=%s resolved_cli_path=%s has_token=%s cli_authenticated=%s effective_provider=%s effective_model=%s",
            bool(status.get("enabled")),
            bool(status.get("sdk_installed")),
            bool(status.get("cli_available")),
            str(status.get("configured_cli_path") or ""),
            str(status.get("resolved_cli_path") or ""),
            bool(status.get("has_token")),
            bool(status.get("cli_authenticated")),
            str(status.get("effective_provider") or "copilot"),
            str(status.get("effective_model") or "auto"),
        )
    except Exception:
        pass


_print_system_prompt_for_debug()
_print_runtime_diagnostics_for_debug()


def _build_prompt(
    user_message: str,
    history: list[dict[str, str]] | None = None,
    file_summary: str | None = None,
) -> str:
    def _compact_file_summary(summary: str) -> str:
        max_lines = int(getattr(settings, "AI_ASSISTANT_PROMPT_FILE_LIST_MAX_LINES", 12))
        lines = [line for line in summary.splitlines() if line.strip()]
        if len(lines) <= max_lines:
            return "\n".join(lines)
        visible = lines[:max_lines]
        remaining = len(lines) - max_lines
        visible.append(f"... (+{remaining} more files)")
        return "\n".join(visible)

    prefix_lines = []
    if file_summary:
        include_full_on_history = bool(getattr(settings, "AI_ASSISTANT_INCLUDE_FULL_FILE_SUMMARY_WITH_HISTORY", False))
        if history and not include_full_on_history:
            prefix_lines.append("Verified current_input context is available (file list omitted for brevity).")
            prefix_lines.append("Use tools to inspect files before editing.")
        else:
            prefix_lines.append("Verified files in active current_input:")
            prefix_lines.append(_compact_file_summary(file_summary))

    if not history:
        if prefix_lines:
            prefix_lines.append("\nLatest user request:")
            prefix_lines.append(user_message)
            return "\n".join(prefix_lines)
        return user_message

    lines = [
        *prefix_lines,
        "",
        "Conversation so far:",
    ]
    max_history = int(getattr(settings, "AI_ASSISTANT_MAX_HISTORY_MESSAGES", 8))
    for item in history[-max_history:]:
        role = (item.get("role") or "user").strip().lower()
        if role not in ("user", "assistant", "system"):
            role = "user"
        content = (item.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")

    lines.append("user: " + user_message)
    lines.append("Respond to the latest user message.")
    return "\n".join(lines)


def _use_wrapped_prompt_mode() -> bool:
    mode = str(getattr(settings, "AI_ASSISTANT_PROMPT_MODE", "sdk-native") or "sdk-native").strip().lower()
    return mode in {"wrapped", "legacy", "history"}


def _trim_system_prompt_for_local(prompt_text: str, is_local_provider: bool) -> str:
    if not is_local_provider:
        return prompt_text
    max_chars = int(getattr(settings, "AI_ASSISTANT_OLLAMA_SYSTEM_PROMPT_MAX_CHARS", 1800))
    if max_chars <= 0 or len(prompt_text) <= max_chars:
        return prompt_text
    return prompt_text[:max_chars].rstrip() + "\n\n[System prompt trimmed for local-model context budget.]"


def _should_wrap_prompt(history: list[dict[str, str]] | None, resumed_existing_session: bool, is_local_provider: bool) -> bool:
    if is_local_provider:
        allow_wrapped_local = bool(getattr(settings, "AI_ASSISTANT_OLLAMA_ALLOW_WRAPPED_PROMPT", False))
        if not allow_wrapped_local:
            return False
    return _use_wrapped_prompt_mode() or (bool(history) and not resumed_existing_session)


def _contains_copilot_auth_error(text: str | None) -> bool:
    normalized = str(text or "").lower()
    markers = [
        "no github oauth token or copilot hmac key provided",
        "copilot hmac",
        "couldn’t authenticate via github",
        "couldn't authenticate via github",
        "explore agent failed",
    ]
    return any(marker in normalized for marker in markers)


def _truncate_file_summary(summary: str) -> str:
    max_summary_chars = int(getattr(settings, "AI_ASSISTANT_FILE_SUMMARY_MAX_CHARS", 2500))
    if len(summary) > max_summary_chars:
        return summary[:max_summary_chars] + "\n... (truncated)"
    return summary


def _log_text_preview(label: str, text: str, extra: str = "") -> None:
    if not bool(getattr(settings, "AI_ASSISTANT_LOG_PROMPTS", True)):
        return
    max_chars = int(getattr(settings, "AI_ASSISTANT_LOG_PROMPT_MAX_CHARS", 1200))
    preview = text if len(text) <= max_chars else text[:max_chars] + "\n...[truncated]"
    logger.info("assistant.prompt_log %s chars=%s %s\n%s", label, len(text), extra, preview)


def _log_preview(value: Any, max_chars: int = 240) -> str:
    text = str(value or "")
    text = text.replace("\n", "\\n")
    return text if len(text) <= max_chars else text[:max_chars] + "...[truncated]"


def _path_log_snapshot(path: Path, max_children: int = 8) -> dict[str, Any]:
    info: dict[str, Any] = {
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


def _log_request_context_diagnostics(
    *,
    stage: str,
    resolved_work_dir: Path,
    current_input_dir: Path,
    results_output_dir: Path,
    client_options: dict[str, Any],
    model: str | None,
    provider: dict[str, str] | None,
    sdk_session_id: str | None,
) -> None:
    logger.info(
        "assistant.context_diagnostics stage=%s model=%s sdk_session_id=%s provider=%s client_cwd=%s cli_args=%s work_dir=%s current_input=%s results_output=%s work_snapshot=%s current_input_snapshot=%s results_output_snapshot=%s",
        stage,
        model or "auto",
        sdk_session_id or "",
        provider.get("type", "copilot") if provider else "copilot",
        str(_client_option_value(client_options, "cwd") or ""),
        list(_client_option_value(client_options, "cli_args") or []),
        resolved_work_dir,
        current_input_dir,
        results_output_dir,
        json.dumps(_path_log_snapshot(resolved_work_dir), ensure_ascii=False),
        json.dumps(_path_log_snapshot(current_input_dir), ensure_ascii=False),
        json.dumps(_path_log_snapshot(results_output_dir), ensure_ascii=False),
    )


def _approve_all_permission_requests(_request: dict[str, Any], _context: dict[str, str]) -> Any:
    try:
        from copilot.types import PermissionRequestResult

        return _PermissionApproval(PermissionRequestResult(kind="approved"))
    except Exception:
        return _PermissionApproval(kind="approved")


async def _run_chat_async(
    user_message: str,
    token_override: str | None = None,
    history: list[dict[str, str]] | None = None,
    context_dir: str | None = None,
    system_prompt: str | None = None,
    model_override: str | None = None,
    ollama_base_url_override: str | None = None,
    sdk_session_id: str | None = None,
    event_callback: Any | None = None,
) -> dict[str, Any]:
    CopilotClient, Tool = _load_copilot_sdk_classes()

    resolved_work_dir = _resolve_context_dir(context_dir)
    results_output_dir = (resolved_work_dir / ".spinetoolbox" / "items" / "extract_results" / "output").resolve()
    try:
        current_input_dir = resolve_current_input_dir(str(resolved_work_dir))
    except Exception as exc:
        raise CopilotIntegrationError(
            f"Invalid work directory for assistant session: {resolved_work_dir}. "
            "Expected to find a current_input directory under the selected work folder."
        ) from exc

    execution_trace: list[dict[str, Any]] = []
    generated_plot_payload: dict[str, Any] | None = None

    def _trace(event: str, **fields: Any) -> None:
        entry = {"event": event, **fields}
        execution_trace.append(entry)
        if callable(event_callback):
            try:
                event_callback(entry)
            except Exception:
                pass

    async def create_visualization_tool(invocation):
        nonlocal generated_plot_payload
        _trace("tool.start", tool="create_visualization")
        args = invocation.get("arguments", {}) if isinstance(invocation, dict) else {}
        if isinstance(args, dict):
            _trace(
                "tool.input",
                tool="create_visualization",
                provided_keys=sorted(list(args.keys())),
                rows_count=len(args.get("rows", [])) if isinstance(args.get("rows"), list) else 0,
                x_column=str(args.get("x_column") or ""),
                series_columns=args.get("series_columns") if isinstance(args.get("series_columns"), list) else [],
            )
        normalized = normalize_plot_payload(args)
        if normalized is None:
            _trace("tool.error", tool="create_visualization", reason="invalid_payload")
            return {
                "textResultForLlm": (
                    "Invalid visualization payload. Required fields: rows (non-empty), "
                    "x_column (string), series_columns (non-empty list)."
                ),
                "resultType": "error",
                "sessionLog": "Visualization payload validation failed",
            }
        generated_plot_payload = normalized
        first_row = normalized.get("rows", [None])[0] if isinstance(normalized.get("rows"), list) else None
        _trace(
            "tool.success",
            tool="create_visualization",
            rows=len(normalized.get("rows", [])),
            x_column=normalized.get("x_column"),
            series_columns=normalized.get("series_columns", []),
            first_row_keys=sorted(list(first_row.keys())) if isinstance(first_row, dict) else [],
        )
        return {
            "textResultForLlm": "Visualization payload accepted and queued for UI rendering.",
            "resultType": "success",
            "sessionLog": "Visualization queued",
        }

    tools = [
        Tool(
            name="create_visualization",
            description=(
                "Create a chart to render in the SiteOpt UI. "
                "Pass rows, x_column, and series_columns using already computed data."
            ),
            parameters={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Chart title"},
                    "source_file": {"type": "string", "description": "Optional relative source file path"},
                    "x_column": {"type": "string", "description": "Name of x-axis field in rows"},
                    "series_columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "One or more y-series field names in rows",
                    },
                    "rows": {
                        "type": "array",
                        "items": {"type": "object"},
                        "description": "Data rows used directly for plotting",
                    },
                },
                "required": ["rows", "x_column", "series_columns"],
            },
            handler=create_visualization_tool,
        )
    ]

    client_options = _build_client_options(token_override=token_override, context_dir_override=context_dir)
    client = CopilotClient(client_options) if client_options else CopilotClient()
    configured_model = _resolve_model_name(model_override)
    resolved_system_prompt = _load_system_prompt(system_prompt)
    has_github_token = bool(token_override or settings.COPILOT_GITHUB_TOKEN)
    normalized_ollama_base_url = _normalize_ollama_base_url(ollama_base_url_override)
    resolved_provider = _resolve_ollama_provider(configured_model, base_url_override=normalized_ollama_base_url)
    is_local_provider = bool(resolved_provider)
    resolved_system_prompt = _trim_system_prompt_for_local(resolved_system_prompt, is_local_provider)

    session = None
    effective_sdk_session_id: str | None = sdk_session_id
    resumed_existing_session = False
    sdk_event_unsubscribe = None
    timeout_seconds = int(getattr(settings, "AI_ASSISTANT_REQUEST_TIMEOUT", 180))
    short_retry_timeout = int(getattr(settings, "AI_ASSISTANT_RETRY_TIMEOUT", min(180, timeout_seconds)))
    max_timeout_retries = int(getattr(settings, "AI_ASSISTANT_MAX_TIMEOUT_RETRIES", 3))
    start_time = time.monotonic()
    _log_request_context_diagnostics(
        stage="pre_client_start",
        resolved_work_dir=resolved_work_dir,
        current_input_dir=current_input_dir,
        results_output_dir=results_output_dir,
        client_options=client_options,
        model=configured_model,
        provider=resolved_provider,
        sdk_session_id=effective_sdk_session_id,
    )
    try:
        _trace("request.start", timeout_seconds=timeout_seconds, has_history=bool(history))
        logger.info(
            "assistant.request.start work_dir=%s current_input=%s timeout=%ss has_history=%s model=%s cli_args=%s",
            resolved_work_dir,
            current_input_dir,
            timeout_seconds,
            bool(history),
            configured_model or "auto",
            list(_client_option_value(client_options, "cli_args") or []),
        )
        await client.start()
        system_lines = [
            "You are SiteOpt Copilot. Your assistant name is SiteOpt Copilot. Do not claim any other assistant identity.",
            resolved_system_prompt,
            "",
            f"Active work directory: {resolved_work_dir}",
            "Active current_input directory: current working directory.",
            f"Spine Toolbox extract_results output root: {results_output_dir}",
            "Simulation results pattern: .spinetoolbox/items/extract_results/output/Base_<hash>/<timestamp>/results.xlsx",
            "When user asks for latest run results, inspect newest timestamp folder under Base_<hash>.",
            "For comparisons, compare multiple timestamp folders under the same Base_<hash> or across Base_<hash> folders when requested.",
            "Prefer relative paths from the current working directory for reads, searches, and edits inside current_input.",
            "Use direct tools in this session. Do not delegate to subagents or agent tools for directory inspection.",
            "Do not use sudo or propose permission fixes unless a tool output explicitly shows a real permission error.",
            "IMPORTANT: Write changes only under the active current_input directory. Read access is allowed in current_input and the Spine Toolbox extract_results output root for result analysis.",
            "When the user asks to plot/chart/visualize, call the create_visualization tool with rows, x_column, and series_columns before your final reply.",
        ]

        session_config = {
            "tools": tools,
            "system_message": {
                "mode": "replace",
                "content": "\n".join(system_lines)
            },
            "on_permission_request": _approve_all_permission_requests,
            "excluded_tools": list(_BLOCKED_AGENT_TOOLS),
        }
        _log_text_preview(
            "system_message",
            session_config["system_message"]["content"],
            extra=f"model={configured_model or 'auto'} local_provider={is_local_provider}",
        )
        if configured_model:
            session_config["model"] = configured_model
        if resolved_provider:
            if not has_github_token:
                local_guard_lines = [
                    "",
                    "LOCAL MODE CONSTRAINTS:",
                    "- Do not use GitHub-authenticated tools, Copilot OAuth flows, or any general-purpose/delegated sub-agent.",
                    "- If an auth/tool error occurs, continue with direct response using available context.",
                ]
                session_config["system_message"]["content"] += "\n" + "\n".join(local_guard_lines)
                existing_excluded = session_config.get("excluded_tools", [])
                session_config["excluded_tools"] = [*existing_excluded]
            session_config["provider"] = resolved_provider
            local_timeout_seconds = int(getattr(settings, "AI_ASSISTANT_OLLAMA_REQUEST_TIMEOUT", timeout_seconds))
            timeout_seconds = max(10, local_timeout_seconds)
            short_retry_timeout = min(short_retry_timeout, timeout_seconds)
            max_timeout_retries = 1
            reuse_local_session = bool(getattr(settings, "AI_ASSISTANT_OLLAMA_REUSE_SDK_SESSION", False))
            if not reuse_local_session:
                effective_sdk_session_id = None
            _trace("session.provider", model=configured_model, provider=resolved_provider.get("type", "openai"))
            logger.info(
                "assistant.session.provider type=%s base_url=%s model=%s timeout=%ss reuse_session=%s",
                resolved_provider.get("type", "openai"),
                resolved_provider.get("base_url", ""),
                configured_model,
                timeout_seconds,
                bool(getattr(settings, "AI_ASSISTANT_OLLAMA_REUSE_SDK_SESSION", False)),
            )
        else:
            logger.info("assistant.session.provider type=copilot model=%s", configured_model or "auto")

        if session_config.get("excluded_tools"):
            logger.info("assistant.session.tools.excluded=%s", session_config.get("excluded_tools"))
        if is_local_provider:
            _trace("prompt.system_trim", chars=len(resolved_system_prompt))
        if effective_sdk_session_id:
            try:
                session = await _resume_sdk_session(client, effective_sdk_session_id, session_config)
                resumed_existing_session = True
                _trace("session.resumed", model=configured_model or "auto", sdk_session_id=effective_sdk_session_id)
            except Exception as exc:
                logger.warning(
                    "assistant.session.resume_failed sdk_session_id=%s error=%s; creating a new session",
                    effective_sdk_session_id,
                    exc,
                )
                _trace("session.resume_failed", sdk_session_id=effective_sdk_session_id, error=str(exc))
                session = await _create_sdk_session(client, session_config)
                effective_sdk_session_id = getattr(session, "session_id", None)
                _trace("session.created", model=configured_model or "auto", sdk_session_id=effective_sdk_session_id)
        else:
            session = await _create_sdk_session(client, session_config)
            effective_sdk_session_id = getattr(session, "session_id", None)
            _trace("session.created", model=configured_model or "auto", sdk_session_id=effective_sdk_session_id)

        sdk_event_limit = int(getattr(settings, "AI_ASSISTANT_SDK_EVENT_TRACE_LIMIT", 300))

        def _sdk_event_handler(event: Any) -> None:
            try:
                if len(execution_trace) >= sdk_event_limit:
                    return
                raw_event_type = getattr(event, "type", "unknown")
                event_type = getattr(raw_event_type, "value", None) or str(raw_event_type)
                data = getattr(event, "data", None)
                fields: dict[str, Any] = {"event": "sdk.event", "type": event_type}
                event_id = getattr(event, "id", None)
                timestamp = getattr(event, "timestamp", None)
                parent_id = getattr(event, "parent_id", None)
                if event_id is not None:
                    fields["id"] = str(event_id)
                if timestamp is not None:
                    fields["timestamp"] = str(timestamp)
                if parent_id is not None:
                    fields["parent_id"] = str(parent_id)

                progress_message = getattr(data, "progress_message", None) if data is not None else None
                content = getattr(data, "content", None) if data is not None else None
                message = getattr(data, "message", None) if data is not None else None
                reasoning_text = getattr(data, "reasoning_text", None) if data is not None else None
                delta_content = getattr(data, "delta_content", None) if data is not None else None
                tool_name = getattr(data, "tool_name", None) if data is not None else None
                tool_call_id = getattr(data, "tool_call_id", None) if data is not None else None
                tool_arguments = getattr(data, "arguments", None) if data is not None else None
                partial_output = getattr(data, "partial_output", None) if data is not None else None
                result_obj = getattr(data, "result", None) if data is not None else None
                result_output = getattr(result_obj, "output", None) if result_obj is not None else None
                data_input = getattr(data, "input", None) if data is not None else None
                data_output = getattr(data, "output", None) if data is not None else None
                agent_name = getattr(data, "agent_display_name", None) if data is not None else None
                if not agent_name:
                    agent_name = getattr(data, "agent_name", None) if data is not None else None

                if progress_message:
                    fields["progress"] = str(progress_message)[:300]
                if message and event_type in {"session.warning", "session.info", "session.error", "system.message", "assistant.intent"}:
                    fields["message"] = str(message)[:300]
                if content and event_type in {"assistant.message", "assistant.message_delta"}:
                    fields["content"] = str(content)[:300]
                if delta_content and event_type in {"assistant.reasoning_delta", "assistant.message_delta"}:
                    fields["delta"] = str(delta_content)[:200]
                if reasoning_text and event_type == "assistant.reasoning":
                    fields["reasoning"] = str(reasoning_text)[:300]
                if tool_name:
                    fields["tool"] = str(tool_name)
                if tool_call_id:
                    fields["tool_call_id"] = str(tool_call_id)
                if tool_arguments is not None and event_type == "tool.execution_start":
                    fields["arguments"] = str(tool_arguments)[:500]
                if partial_output and event_type in {"tool.execution_progress", "tool.execution_partial_result"}:
                    fields["partial_output"] = str(partial_output)[:500]
                if result_output is not None and event_type == "tool.execution_complete":
                    fields["result_output"] = str(result_output)[:500]
                if data_input is not None and event_type in {"tool.execution_start", "tool.execution_progress", "tool.execution_complete"}:
                    fields["input"] = str(data_input)[:300]
                if data_output is not None and event_type in {"tool.execution_progress", "tool.execution_complete"}:
                    fields["output"] = str(data_output)[:500]
                if agent_name:
                    fields["agent"] = str(agent_name)

                execution_trace.append(fields)
                if callable(event_callback):
                    try:
                        event_callback(fields)
                    except Exception:
                        pass
                if event_type.startswith("tool.") or event_type.startswith("subagent."):
                    if event_type == "tool.execution_start":
                        logger.info(
                            "assistant.sdk_event type=%s tool=%s agent=%s progress=%s arguments=%s input=%s",
                            event_type,
                            fields.get("tool", ""),
                            fields.get("agent", ""),
                            fields.get("progress", ""),
                            _log_preview(fields.get("arguments", "")),
                            _log_preview(fields.get("input", "")),
                        )
                    elif event_type == "tool.execution_complete":
                        logger.info(
                            "assistant.sdk_event type=%s tool=%s agent=%s progress=%s result_output=%s output=%s",
                            event_type,
                            fields.get("tool", ""),
                            fields.get("agent", ""),
                            fields.get("progress", ""),
                            _log_preview(fields.get("result_output", "")),
                            _log_preview(fields.get("output", "")),
                        )
                    else:
                        logger.info(
                            "assistant.sdk_event type=%s tool=%s agent=%s progress=%s partial_output=%s",
                            event_type,
                            fields.get("tool", ""),
                            fields.get("agent", ""),
                            fields.get("progress", ""),
                            _log_preview(fields.get("partial_output", "")),
                        )
            except Exception:
                pass

        sdk_event_unsubscribe = session.on(_sdk_event_handler)

        should_wrap_prompt = _should_wrap_prompt(history, resumed_existing_session, is_local_provider)
        if should_wrap_prompt:
            file_summary = _truncate_file_summary(read_current_input_summary(current_input_dir))
            prompt = _build_prompt(user_message=user_message, history=history, file_summary=file_summary)
            _trace(
                "prompt.built",
                chars=len(prompt),
                mode="wrapped",
                reason="configured" if _use_wrapped_prompt_mode() else "history_rehydrate",
            )
        else:
            prompt = user_message
            reason = "ollama_local_budget" if is_local_provider else "sdk-native"
            _trace("prompt.built", chars=len(prompt), mode="sdk-native", reason=reason)

        async def _send_with_retries(prompt_text: str, stage: str, max_stage_timeout: int) -> Any:
            last_error: Exception | None = None
            for attempt in range(1, max_timeout_retries + 1):
                elapsed = time.monotonic() - start_time
                remaining_budget = timeout_seconds - elapsed
                if remaining_budget <= 0:
                    raise asyncio.TimeoutError()
                reserved_retry_budget = 0
                if is_local_provider and stage == "full_context":
                    # Preserve a real fallback window for local models instead of
                    # spending the entire request budget on the first pass.
                    reserved_retry_budget = min(short_retry_timeout, max(0, timeout_seconds - 5))

                usable_budget = remaining_budget - reserved_retry_budget
                if reserved_retry_budget and usable_budget <= 5 and remaining_budget > 5:
                    usable_budget = 5

                per_attempt_timeout = max(5, int(min(max_stage_timeout, usable_budget if reserved_retry_budget else remaining_budget)))
                try:
                    _log_text_preview(
                        "user_prompt",
                        prompt_text,
                        extra=(
                            f"stage={stage} attempt={attempt} model={configured_model or 'auto'} "
                            f"local_provider={is_local_provider}"
                        ),
                    )
                    _trace(
                        "request.attempt",
                        stage=stage,
                        attempt=attempt,
                        per_attempt_timeout_seconds=per_attempt_timeout,
                        remaining_budget_seconds=round(remaining_budget, 3),
                        reserved_retry_budget_seconds=reserved_retry_budget,
                    )
                    return await session.send_and_wait(prompt_text, timeout=float(per_attempt_timeout))
                except asyncio.TimeoutError as exc:
                    last_error = exc
                    elapsed_now = time.monotonic() - start_time
                    _trace(
                        "request.attempt_timeout",
                        stage=stage,
                        attempt=attempt,
                        elapsed_seconds=round(elapsed_now, 3),
                        configured_timeout_seconds=timeout_seconds,
                        per_attempt_timeout_seconds=per_attempt_timeout,
                    )
                    logger.warning(
                        "assistant.request.attempt_timeout stage=%s attempt=%s elapsed=%.2fs configured_timeout=%ss per_attempt_timeout=%ss",
                        stage,
                        attempt,
                        elapsed_now,
                        timeout_seconds,
                        per_attempt_timeout,
                    )
                    if attempt < max_timeout_retries:
                        continue
                    raise exc
            if last_error is not None:
                raise last_error
            raise asyncio.TimeoutError()

        try:
            response = await _send_with_retries(prompt, "full_context", timeout_seconds)
        except asyncio.TimeoutError:
            _trace("request.retry", reason="full_context_timeout", retry_timeout_seconds=short_retry_timeout)
            logger.warning(
                "assistant.request.full_context_timeout elapsed=%.2fs; retrying with minimal context timeout=%ss",
                time.monotonic() - start_time,
                short_retry_timeout,
            )
            response = await _send_with_retries(user_message, "minimal_context", short_retry_timeout)

        if response and getattr(response, "data", None):
            content = getattr(response.data, "content", None)
            if content:
                if is_local_provider and _contains_copilot_auth_error(content):
                    logger.warning("assistant.local.auth_error_sanitized model=%s", configured_model or "auto")
                    content = (
                        "The local model attempted to use an authenticated Copilot-only agent/tool and failed. "
                        "Please retry; local-mode guardrails were applied to avoid that path."
                    )
                elapsed = time.monotonic() - start_time
                _trace("request.success", elapsed_seconds=round(elapsed, 3))
                logger.info("assistant.request.success elapsed=%.2fs", elapsed)
                return {
                    "message": content,
                    "trace": execution_trace,
                    "plot": generated_plot_payload,
                    "sdk_session_id": effective_sdk_session_id,
                }

        _trace("request.empty_response")
        return {
            "message": "I completed the request but did not receive a final assistant message.",
            "trace": execution_trace,
            "plot": generated_plot_payload,
            "sdk_session_id": effective_sdk_session_id,
        }
    except asyncio.TimeoutError as exc:
        elapsed = time.monotonic() - start_time
        _trace("request.timeout", elapsed_seconds=round(elapsed, 3), timeout_seconds=timeout_seconds)
        logger.error("assistant.request.timeout elapsed=%.2fs timeout=%ss", elapsed, timeout_seconds)
        if generated_plot_payload is not None:
            logger.warning("assistant.request.timeout_with_plot elapsed=%.2fs timeout=%ss", elapsed, timeout_seconds)
            return {
                "message": (
                    "The assistant timed out while finishing its response, but a visualization payload was produced and rendered."
                ),
                "trace": execution_trace,
                "plot": generated_plot_payload,
                "sdk_session_id": effective_sdk_session_id,
            }
        raise CopilotIntegrationError(
            f"Timeout after {float(timeout_seconds):.1f}s waiting for Copilot response. "
            "Check Copilot auth and try a shorter prompt."
        ) from exc
    except Exception as exc:
        if "session.idle" in str(exc).lower():
            elapsed = time.monotonic() - start_time
            _trace("request.session_idle_timeout", elapsed_seconds=round(elapsed, 3), timeout_seconds=timeout_seconds)
            logger.error("assistant.request.session_idle_timeout elapsed=%.2fs timeout=%ss", elapsed, timeout_seconds)
            if generated_plot_payload is not None:
                logger.warning("assistant.request.session_idle_timeout_with_plot elapsed=%.2fs timeout=%ss", elapsed, timeout_seconds)
                return {
                    "message": (
                        "The assistant session timed out while finishing its response, but a visualization payload was produced and rendered."
                    ),
                    "trace": execution_trace,
                    "plot": generated_plot_payload,
                    "sdk_session_id": effective_sdk_session_id,
                }
            raise CopilotIntegrationError(
                f"Timeout after {float(timeout_seconds):.1f}s waiting for session.idle. "
                "Check Copilot auth and try a shorter prompt."
            ) from exc
        _trace("request.error", error=str(exc))
        logger.exception("assistant.request.error error=%s", exc)
        raise CopilotIntegrationError(str(exc)) from exc
    finally:
        if sdk_event_unsubscribe is not None:
            try:
                sdk_event_unsubscribe()
            except Exception:
                pass
        try:
            await client.stop()
        except Exception:
            pass


def run_chat_message(user_message: str) -> str:
    result = asyncio.run(_run_chat_async(user_message))
    return result.get("message", "")


def run_chat_message_with_token(
    user_message: str,
    github_token: str | None = None,
    history: list[dict[str, str]] | None = None,
    context_dir: str | None = None,
    system_prompt: str | None = None,
    model_override: str | None = None,
    ollama_base_url_override: str | None = None,
    sdk_session_id: str | None = None,
    event_callback: Any | None = None,
) -> dict[str, Any]:
    return asyncio.run(
        _run_chat_async(
            user_message,
            token_override=github_token,
            history=history,
            context_dir=context_dir,
            system_prompt=system_prompt,
            model_override=model_override,
            ollama_base_url_override=ollama_base_url_override,
            sdk_session_id=sdk_session_id,
            event_callback=event_callback,
        )
    )
