import asyncio
import inspect
import json
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ai_assistant.copilot_service import (
    _BLOCKED_AGENT_TOOLS,
    _approve_all_permission_requests,
    _build_client_options,
    _load_system_prompt,
    _normalize_ollama_base_url,
    _resolve_context_dir,
    _resolve_model_name,
    _resolve_ollama_provider,
    _trim_system_prompt_for_local,
)
from ai_assistant.tools import resolve_current_input_dir


def _preview(value: Any, max_chars: int = 300) -> str:
    text = str(value or "")
    text = text.replace("\n", "\\n")
    return text if len(text) <= max_chars else text[:max_chars] + "...[truncated]"


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    return repr(value)


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


class Command(BaseCommand):
    help = "Run a direct Copilot SDK session against a work/current_input directory and print tool events."

    def add_arguments(self, parser):
        parser.add_argument("--context-dir", required=True, help="Work directory or current_input directory to use.")
        parser.add_argument("--prompt", default="Read demand/tscr_heatdemand.csv", help="Prompt sent directly to the SDK session.")
        parser.add_argument("--model", default="", help="Optional model override.")
        parser.add_argument("--ollama-base-url", default="", help="Optional Ollama/OpenAI-compatible base URL.")
        parser.add_argument(
            "--timeout",
            type=float,
            default=float(getattr(settings, "AI_ASSISTANT_REQUEST_TIMEOUT", 300)),
            help="Timeout in seconds for send_and_wait.",
        )

    def handle(self, *args, **options):
        asyncio.run(self._handle_async(**options))

    async def _handle_async(self, **options):
        try:
            from copilot import CopilotClient
        except ImportError as exc:
            raise CommandError("github-copilot-sdk is not installed") from exc

        context_dir = str(options["context_dir"])
        prompt = str(options["prompt"])
        model_override = str(options.get("model") or "").strip() or None
        ollama_base_url_override = str(options.get("ollama_base_url") or "").strip() or None
        timeout = float(options.get("timeout") or 300)

        resolved_work_dir = _resolve_context_dir(context_dir)
        try:
            current_input_dir = resolve_current_input_dir(str(resolved_work_dir))
        except Exception as exc:
            raise CommandError(
                f"Invalid work directory: {resolved_work_dir}. Expected current_input under the selected path."
            ) from exc

        client_options = _build_client_options(context_dir_override=context_dir)
        configured_model = _resolve_model_name(model_override)
        normalized_ollama_base_url = _normalize_ollama_base_url(ollama_base_url_override)
        resolved_provider = _resolve_ollama_provider(configured_model, base_url_override=normalized_ollama_base_url)
        is_local_provider = bool(resolved_provider)
        resolved_system_prompt = _trim_system_prompt_for_local(_load_system_prompt(None), is_local_provider)

        self.stdout.write(
            json.dumps(
                {
                    "stage": "sdk_tool_probe.start",
                    "context_dir": context_dir,
                    "resolved_work_dir": str(resolved_work_dir),
                    "current_input_dir": str(current_input_dir),
                    "client_options": _json_safe(client_options),
                    "model": configured_model or "auto",
                    "provider": _json_safe(resolved_provider or {"type": "copilot"}),
                    "timeout": timeout,
                },
                ensure_ascii=False,
            )
        )

        client = CopilotClient(client_options) if client_options else CopilotClient()
        session = None
        unsubscribe = None

        try:
            await client.start()

            system_lines = [
                "You are running in a direct SDK tool probe for SiteOpt.",
                resolved_system_prompt,
                "",
                f"Active work directory: {resolved_work_dir}",
                "Active current_input directory: current working directory.",
                "Use tools directly to inspect files and report what happened.",
                "If any tool returns a real permission error, quote that error exactly.",
                "Do not infer permission problems unless a tool output explicitly shows one.",
            ]

            session_config: dict[str, Any] = {
                "system_message": {"mode": "replace", "content": "\n".join(system_lines)},
                "on_permission_request": _approve_all_permission_requests,
                "excluded_tools": list(_BLOCKED_AGENT_TOOLS),
            }
            if configured_model:
                session_config["model"] = configured_model
            if resolved_provider:
                session_config["provider"] = resolved_provider

            session = await _create_sdk_session(client, session_config)
            self.stdout.write(
                json.dumps(
                    {
                        "stage": "sdk_tool_probe.session_created",
                        "session_id": getattr(session, "session_id", ""),
                        "excluded_tools": session_config.get("excluded_tools", []),
                    },
                    ensure_ascii=False,
                )
            )

            def _event_handler(event: Any) -> None:
                raw_event_type = getattr(event, "type", "unknown")
                event_type = getattr(raw_event_type, "value", None) or str(raw_event_type)
                data = getattr(event, "data", None)
                result_obj = getattr(data, "result", None) if data is not None else None
                payload = {
                    "stage": "sdk_tool_probe.event",
                    "type": event_type,
                    "tool": str(getattr(data, "tool_name", "") or ""),
                    "agent": str(
                        getattr(data, "agent_display_name", None)
                        or getattr(data, "agent_name", None)
                        or ""
                    ),
                    "arguments": _preview(getattr(data, "arguments", "") if data is not None else ""),
                    "input": _preview(getattr(data, "input", "") if data is not None else ""),
                    "output": _preview(getattr(data, "output", "") if data is not None else ""),
                    "result_output": _preview(getattr(result_obj, "output", "") if result_obj is not None else ""),
                    "message": _preview(getattr(data, "message", "") if data is not None else ""),
                    "progress": _preview(getattr(data, "progress_message", "") if data is not None else ""),
                }
                print(json.dumps(payload, ensure_ascii=False), flush=True)

            unsubscribe = session.on(_event_handler)
            response = await session.send_and_wait(prompt, timeout=timeout)
            content = getattr(getattr(response, "data", None), "content", None)
            self.stdout.write(
                json.dumps(
                    {
                        "stage": "sdk_tool_probe.response",
                        "content": content or "",
                    },
                    ensure_ascii=False,
                )
            )
        finally:
            if unsubscribe is not None:
                try:
                    unsubscribe()
                except Exception:
                    pass
            try:
                await client.stop()
            except Exception:
                pass