from django.conf import settings
from django.test import Client, TestCase, override_settings
from unittest.mock import patch
from pathlib import Path
import shutil
import tempfile
import pandas as pd

from siteoptapp.views import get_client_config, edit_config_file
from ai_assistant.copilot_service import (
    _approve_all_permission_requests,
    _build_prompt,
    _build_client_options,
    _contains_copilot_auth_error,
    _load_system_prompt,
    _resolve_model_name,
    _resolve_ollama_provider,
    _should_wrap_prompt,
    _trim_system_prompt_for_local,
    get_runtime_status,
)


class AssistantChatTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=False)
        settings_response = self.client.get("/api/settings/")
        self.client_id = settings_response.json()["data"]["client_id"]

        self.work_dir = (Path(settings.BASE_DIR) / "work" / "test-assistant-session").resolve()
        self.current_input_dir = self.work_dir / "current_input"
        self.current_input_dir.mkdir(parents=True, exist_ok=True)
        (self.current_input_dir / "modelspec.xlsx").touch(exist_ok=True)
        demand_dir = self.current_input_dir / "demand"
        demand_dir.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(
            {
                "time": pd.date_range("2021-01-01", periods=48, freq="h"),
                "value": [100.0 + i for i in range(48)],
            }
        ).to_csv(demand_dir / "tscr_cooldemand.csv", index=False)
        storages_dir = self.current_input_dir / "storages"
        storages_dir.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(
            {
                "time": pd.date_range("2021-01-01", periods=24 * 90, freq="h"),
                "value": [120.0 + (i % 24) for i in range(24 * 90)],
            }
        ).to_csv(storages_dir / "ts_demand_carpark.csv", index=False)

        client_config = get_client_config(self.client_id)
        edit_config_file(client_config.config_path, {"work_folders": {"test-assistant-session": str(self.work_dir)}})

    def tearDown(self):
        shutil.rmtree(self.work_dir, ignore_errors=True)

    def _new_session(self):
        response = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.work_dir)},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        return response.json()["data"]["session_id"]

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_success(self):
        session_id = self._new_session()
        with patch("ai_assistant.views.run_chat_message_with_token", return_value="hello from copilot"):
            response = self.client.post(
                "/api/assistant/chat/",
                data={"message": "hello", "session_id": session_id},
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["message"], "hello from copilot")
        self.assertEqual(body["data"]["session_id"], session_id)
        self.assertTrue(isinstance(body["data"]["history"], list))

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_includes_trace_when_backend_returns_it(self):
        session_id = self._new_session()
        with patch(
            "ai_assistant.views.run_chat_message_with_token",
            return_value={"message": "done", "trace": [{"event": "request.start"}, {"event": "request.success"}]},
        ):
            response = self.client.post(
                "/api/assistant/chat/",
                data={"message": "hello", "session_id": session_id},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"]["message"], "done")
        self.assertEqual(len(body["data"]["trace"]), 2)

    @override_settings(ENABLE_AI_ASSISTANT=False)
    def test_chat_not_found_when_disabled(self):
        response = self.client.post(
            "/api/assistant/chat/",
            data={"message": "hello"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_auth_status(self):
        status = self.client.get("/api/assistant/auth/status/")
        self.assertEqual(status.status_code, 200)
        status_body = status.json()
        self.assertTrue(status_body["success"])
        self.assertFalse(status_body["data"]["has_cached_token"])

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_session_new_and_reset(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.work_dir)},
            content_type="application/json",
        )
        self.assertEqual(create.status_code, 200)
        create_body = create.json()
        self.assertTrue(create_body["success"])
        session_id = create_body["data"]["session_id"]
        self.assertTrue(session_id)
        self.assertEqual(create_body["data"].get("model"), "gpt-5-mini")

        reset = self.client.post(
            "/api/assistant/session/reset/",
            data={"session_id": session_id},
            content_type="application/json",
        )
        self.assertEqual(reset.status_code, 200)
        reset_body = reset.json()
        self.assertTrue(reset_body["success"])
        self.assertEqual(reset_body["data"]["session_id"], session_id)

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_session_new_accepts_model_override(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.work_dir), "model": "gpt-5"},
            content_type="application/json",
        )
        self.assertEqual(create.status_code, 200)
        body = create.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"].get("model"), "gpt-5")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_session_new_accepts_ollama_base_url_override(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={
                "context_dir": str(self.work_dir),
                "model": "qwen3:30b",
                "ollama_base_url": "http://192.168.50.69:11434/v1",
            },
            content_type="application/json",
        )
        self.assertEqual(create.status_code, 200)
        body = create.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"].get("ollama_base_url"), "http://192.168.50.69:11434/v1")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_session_new_accepts_current_input_context_path(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.current_input_dir)},
            content_type="application/json",
        )
        self.assertEqual(create.status_code, 200)
        body = create.json()
        self.assertTrue(body["success"])
        self.assertEqual(body["data"].get("context_dir"), str(self.work_dir))

    def test_build_client_options_uses_current_input_as_cwd(self):
        options = _build_client_options(context_dir_override=str(self.work_dir))
        self.assertEqual(options.get("cwd"), str(self.current_input_dir))

    @override_settings(AI_ASSISTANT_COPILOT_CLI_ARGS=["--allow-all-paths"])
    def test_build_client_options_includes_cli_args(self):
        options = _build_client_options(context_dir_override=str(self.work_dir))
        self.assertEqual(options.get("cli_args"), ["--allow-all-paths"])

    def test_permission_approval_callback_returns_approved_result(self):
        result = _approve_all_permission_requests({}, {})
        self.assertEqual(getattr(result, "kind", None), "approved")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_passes_session_model_to_runtime(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.work_dir), "model": "gpt-5"},
            content_type="application/json",
        )
        session_id = create.json()["data"]["session_id"]

        with patch("ai_assistant.views.run_chat_message_with_token", return_value="ok") as mocked_run:
            response = self.client.post(
                "/api/assistant/chat/",
                data={"message": "hello", "session_id": session_id},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(mocked_run.called)
        _, kwargs = mocked_run.call_args
        self.assertEqual(kwargs.get("model_override"), "gpt-5")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_model_payload_overrides_session_model(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.work_dir), "model": "gpt-5"},
            content_type="application/json",
        )
        session_id = create.json()["data"]["session_id"]

        with patch("ai_assistant.views.run_chat_message_with_token", return_value="ok") as mocked_run:
            response = self.client.post(
                "/api/assistant/chat/",
                data={"message": "hello", "session_id": session_id, "model": "qwen3:4b"},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(mocked_run.called)
        _, kwargs = mocked_run.call_args
        self.assertEqual(kwargs.get("model_override"), "qwen3:4b")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_passes_ollama_base_url_override_to_runtime(self):
        create = self.client.post(
            "/api/assistant/session/new/",
            data={"context_dir": str(self.work_dir), "model": "qwen3:30b"},
            content_type="application/json",
        )
        session_id = create.json()["data"]["session_id"]

        with patch("ai_assistant.views.run_chat_message_with_token", return_value="ok") as mocked_run:
            response = self.client.post(
                "/api/assistant/chat/",
                data={
                    "message": "hello",
                    "session_id": session_id,
                    "model": "qwen3:30b",
                    "ollama_base_url": "http://192.168.50.69:11434/v1",
                },
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(mocked_run.called)
        _, kwargs = mocked_run.call_args
        self.assertEqual(kwargs.get("ollama_base_url_override"), "http://192.168.50.69:11434/v1")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_returns_plot_payload_from_assistant_result(self):
        session_id = self._new_session()
        with patch(
            "ai_assistant.views.run_chat_message_with_token",
            return_value={
                "message": "Here is monthly cool demand visualization.",
                "plot": {
                    "type": "timeseries",
                    "title": "Monthly cool demand",
                    "source_file": "demand/tscr_cooldemand.csv",
                    "rows": [{"date": "2021-01-01", "demand": 100.0}],
                    "x_column": "date",
                    "series_columns": ["demand"],
                },
            },
        ):
            response = self.client.post(
                "/api/assistant/chat/",
                data={"message": "show cooldemand monthly for 2021", "session_id": session_id},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertIsNotNone(body["data"].get("plot"))
        self.assertEqual(body["data"]["plot"].get("type"), "timeseries")

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_visualize_this_without_plot_payload_returns_no_plot(self):
        session_id = self._new_session()

        with patch(
            "ai_assistant.views.run_chat_message_with_token",
            return_value="Here's the average demand from ts_demand_carpark.csv for each month.",
        ):
            first = self.client.post(
                "/api/assistant/chat/",
                data={"message": "What was the average demand of car park for every month?", "session_id": session_id},
                content_type="application/json",
            )

        self.assertEqual(first.status_code, 200)

        with patch("ai_assistant.views.run_chat_message_with_token", return_value="Visualized."):
            second = self.client.post(
                "/api/assistant/chat/",
                data={"message": "Can you visualize this?", "session_id": session_id},
                content_type="application/json",
            )

        self.assertEqual(second.status_code, 200)
        body = second.json()
        self.assertTrue(body["success"])
        self.assertIsNone(body["data"].get("plot"))

    @override_settings(ENABLE_AI_ASSISTANT=True)
    def test_chat_passes_plot_payload_and_does_not_parse_text_blocks(self):
        session_id = self._new_session()
        with patch(
            "ai_assistant.views.run_chat_message_with_token",
            return_value={
                "message": "Showing monthly average demand.",
                "plot": {
                    "type": "timeseries",
                    "title": "Carpark monthly avg",
                    "source_file": "storages/ts_demand_carpark.csv",
                    "rows": [{"date": "2021-01-01", "demand": 50.0}],
                    "x_column": "date",
                    "series_columns": ["demand"],
                },
            },
        ):
            response = self.client.post(
                "/api/assistant/chat/",
                data={"message": "Please visualize carpark demand", "session_id": session_id},
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertIsNotNone(body["data"].get("plot"))
        self.assertEqual(body["data"]["plot"].get("source_file"), "storages/ts_demand_carpark.csv")
        self.assertEqual(body["data"]["plot"].get("title"), "Carpark monthly avg")


class AssistantServiceConfigTests(TestCase):
    @override_settings(AI_ASSISTANT_MODEL="auto")
    def test_resolve_model_name_auto_returns_none(self):
        self.assertIsNone(_resolve_model_name())

    @override_settings(AI_ASSISTANT_MODEL="gpt-5")
    def test_resolve_model_name_explicit_returns_name(self):
        self.assertEqual(_resolve_model_name(), "gpt-5")

    @override_settings(AI_ASSISTANT_SYSTEM_PROMPT="fallback prompt")
    def test_load_system_prompt_prefers_override(self):
        self.assertEqual(_load_system_prompt("override prompt"), "override prompt")

    def test_load_system_prompt_from_file(self):
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as tmp:
            tmp.write("prompt from file")
            tmp_path = tmp.name

        try:
            with override_settings(AI_ASSISTANT_SYSTEM_PROMPT_FILE=tmp_path, AI_ASSISTANT_SYSTEM_PROMPT="fallback prompt"):
                self.assertEqual(_load_system_prompt(None), "prompt from file")
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    @override_settings(AI_ASSISTANT_INCLUDE_FULL_FILE_SUMMARY_WITH_HISTORY=False)
    def test_build_prompt_omits_full_file_list_for_history_turns(self):
        prompt = _build_prompt(
            user_message="Increase heatdemands by 20%",
            history=[{"role": "user", "content": "HI"}, {"role": "assistant", "content": "Hello"}],
            file_summary="Available input files in current_input:\nfile1.csv\nfile2.csv",
        )
        self.assertIn("file list omitted for brevity", prompt)
        self.assertNotIn("file1.csv", prompt)

    @override_settings(AI_ASSISTANT_PROMPT_FILE_LIST_MAX_LINES=3)
    def test_build_prompt_truncates_file_list(self):
        prompt = _build_prompt(
            user_message="hello",
            history=None,
            file_summary="line1\nline2\nline3\nline4\nline5",
        )
        self.assertIn("... (+2 more files)", prompt)

    @override_settings(
        AI_ASSISTANT_OLLAMA_AUTO_DISCOVER=False,
        AI_ASSISTANT_OLLAMA_MODELS="qwen3:4b",
        AI_ASSISTANT_OLLAMA_BASE_URL="http://localhost:11434/v1",
        AI_ASSISTANT_OLLAMA_PROVIDER_TYPE="openai",
    )
    def test_resolve_ollama_provider_uses_snake_case_base_url(self):
        provider = _resolve_ollama_provider("qwen3:4b")
        self.assertIsNotNone(provider)
        self.assertEqual(provider["type"], "openai")
        self.assertEqual(provider["base_url"], "http://localhost:11434/v1")
        self.assertNotIn("baseUrl", provider)

    @override_settings(
        ENABLE_AI_ASSISTANT=True,
        AI_ASSISTANT_MODEL="qwen3:4b",
        AI_ASSISTANT_OLLAMA_AUTO_DISCOVER=False,
        AI_ASSISTANT_OLLAMA_MODELS="qwen3:4b,llama3.2:latest",
    )
    def test_runtime_status_exposes_local_models_and_provider(self):
        status = get_runtime_status()
        self.assertTrue(status["enabled"])
        self.assertEqual(status["effective_model"], "qwen3:4b")
        self.assertEqual(status["effective_provider"], "ollama")
        self.assertIn("qwen3:4b", status.get("local_models", []))
        self.assertIn("llama3.2:latest", status.get("local_models", []))

    @override_settings(
        ENABLE_AI_ASSISTANT=True,
        AI_ASSISTANT_MODEL="qwen3:30b",
        AI_ASSISTANT_OLLAMA_AUTO_DISCOVER=False,
        AI_ASSISTANT_OLLAMA_MODELS="qwen3:30b",
    )
    def test_runtime_status_uses_ollama_base_url_override(self):
        status = get_runtime_status(ollama_base_url_override="http://192.168.50.69:11434/v1")
        self.assertTrue(status["enabled"])
        self.assertEqual(status["effective_provider"], "ollama")
        self.assertEqual(status["local_ollama_base_url"], "http://192.168.50.69:11434/v1")

    @override_settings(AI_ASSISTANT_OLLAMA_ALLOW_WRAPPED_PROMPT=False)
    def test_should_wrap_prompt_disabled_for_local_by_default(self):
        wrapped = _should_wrap_prompt(history=[{"role": "user", "content": "x"}], resumed_existing_session=False, is_local_provider=True)
        self.assertFalse(wrapped)

    @override_settings(AI_ASSISTANT_OLLAMA_ALLOW_WRAPPED_PROMPT=True)
    def test_should_wrap_prompt_can_be_enabled_for_local(self):
        wrapped = _should_wrap_prompt(history=[{"role": "user", "content": "x"}], resumed_existing_session=False, is_local_provider=True)
        self.assertTrue(wrapped)

    @override_settings(AI_ASSISTANT_OLLAMA_SYSTEM_PROMPT_MAX_CHARS=10)
    def test_trim_system_prompt_for_local(self):
        trimmed = _trim_system_prompt_for_local("abcdefghijklmnopqrstuvwxyz", is_local_provider=True)
        self.assertIn("[System prompt trimmed for local-model context budget.]", trimmed)
        self.assertTrue(trimmed.startswith("abcdefghij"))

    def test_contains_copilot_auth_error(self):
        text = "Error: No GitHub OAuth token or Copilot HMAC key provided"
        self.assertTrue(_contains_copilot_auth_error(text))
        text2 = "The explore agent failed because it couldn’t authenticate via GitHub (or Copilot HMAC)."
        self.assertTrue(_contains_copilot_auth_error(text2))
        self.assertFalse(_contains_copilot_auth_error("regular response"))
