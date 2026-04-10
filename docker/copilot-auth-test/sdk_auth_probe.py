import asyncio
import inspect
import json
import os
import sys
from typing import Any


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


def _approve_all_permissions(_request: Any) -> dict[str, Any]:
    return {"behavior": "allow", "updatedInput": None}


async def _main() -> int:
    prompt = os.environ.get("COPILOT_TEST_PROMPT", "Reply exactly with: ok")
    cwd = os.environ.get("COPILOT_TEST_CWD", "/tmp")
    model = (os.environ.get("COPILOT_TEST_MODEL", "") or "").strip() or None

    from copilot import CopilotClient
    from copilot.client import SubprocessConfig

    client_options = SubprocessConfig(cwd=cwd)
    client = CopilotClient(client_options)

    session = None
    try:
        await client.start()
        session_config: dict[str, Any] = {
            "on_permission_request": _approve_all_permissions,
            "system_message": {"content": "Reply concisely."},
            "excluded_tools": ["task", "write_agent", "read_agent", "wait", "kill"],
        }
        if model:
            session_config["model"] = model

        session = await _create_sdk_session(client, session_config)
        response = await session.send_and_wait({"prompt": prompt}, timeout=30)
        content = getattr(getattr(response, "data", None), "content", None)
        print(json.dumps({"ok": True, "content": content or ""}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1
    finally:
        try:
            await client.stop()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))