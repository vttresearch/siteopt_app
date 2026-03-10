<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useSettingStore } from "@/stores/settingstore.js";
import { useAssistantPlotStore } from "@/stores/assistantplotstore.js";
import {
  assistantAuthStatus,
  assistantAuthLoginStart,
  assistantAuthLoginStatus,
  assistantChatStream,
  assistantNewSession,
  assistantResetSession,
} from "@/utils/functions.js";

const SESSION_STORAGE_KEY = "siteopt-copilot-sessions-v1";

const settingStore = useSettingStore();
const assistantPlotStore = useAssistantPlotStore();
const open = ref(false);
const loadingStatus = ref(false);
const sending = ref(false);
const runtimeState = ref("idle");
const prompt = ref("");
const promptInput = ref(null);
const sessions = ref([]);
const activeSessionId = ref(null);
const status = ref({
  enabled: false,
  sdk_installed: false,
  cli_available: false,
  has_token: false,
  has_cached_token: false,
  cli_authenticated: false,
});
const authLogin = ref({
  running: false,
  loginId: null,
  state: "idle",
  userCode: "",
  verificationUrl: "https://github.com/login/device",
  logs: [],
  error: "",
});
const authPollTimer = ref(null);

const currentSession = computed(() => {
  return sessions.value.find((session) => session.id === activeSessionId.value) || null;
});

const baseModelCatalog = [
  { label: "Claude Haiku 4.5", value: "claude-haiku-4.5", paid: "0.33", free: "1" },
  { label: "Claude Opus 4.5", value: "claude-opus-4.5", paid: "3", free: "N/A" },
  { label: "Claude Opus 4.6", value: "claude-opus-4.6", paid: "3", free: "N/A" },
  { label: "Claude Opus 4.6 (fast mode) (preview)", value: "claude-opus-4.6-fast", paid: "30", free: "N/A" },
  { label: "Claude Sonnet 4", value: "claude-sonnet-4", paid: "1", free: "N/A" },
  { label: "Claude Sonnet 4.5", value: "claude-sonnet-4.5", paid: "1", free: "N/A" },
  { label: "Claude Sonnet 4.6", value: "claude-sonnet-4.6", paid: "1", free: "N/A" },
  { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro", paid: "1", free: "N/A" },
  { label: "Gemini 3 Flash", value: "gemini-3-flash", paid: "0.33", free: "N/A" },
  { label: "Gemini 3 Pro", value: "gemini-3-pro", paid: "1", free: "N/A" },
  { label: "Gemini 3.1 Pro", value: "gemini-3.1-pro", paid: "1", free: "N/A" },
  { label: "GPT-4.1", value: "gpt-4.1", paid: "0", free: "1" },
  { label: "GPT-4o", value: "gpt-4o", paid: "0", free: "1" },
  { label: "GPT-5 mini", value: "gpt-5-mini", paid: "0", free: "1" },
  { label: "GPT-5.1", value: "gpt-5.1", paid: "1", free: "N/A" },
  { label: "GPT-5.1-Codex", value: "gpt-5.1-codex", paid: "1", free: "N/A" },
  { label: "GPT-5.1-Codex-Mini", value: "gpt-5.1-codex-mini", paid: "0.33", free: "N/A" },
  { label: "GPT-5.1-Codex-Max", value: "gpt-5.1-codex-max", paid: "1", free: "N/A" },
  { label: "GPT-5.2", value: "gpt-5.2", paid: "1", free: "N/A" },
  { label: "GPT-5.2-Codex", value: "gpt-5.2-codex", paid: "1", free: "N/A" },
  { label: "GPT-5.3-Codex", value: "gpt-5.3-codex", paid: "1", free: "N/A" },
  { label: "Grok Code Fast 1", value: "grok-code-fast-1", paid: "0.25", free: "N/A" },
  { label: "Raptor mini", value: "raptor-mini", paid: "0", free: "1" },
  { label: "Goldeneye", value: "goldeneye", paid: "N/A", free: "1" },
  { label: "Auto", value: "auto", paid: "N/A", free: "N/A" },
];

const modelCatalog = ref([...baseModelCatalog]);

function formatMultiplier(value) {
  if (value === null || value === undefined) return "N/A";
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "n/a" || text.toLowerCase() === "not applicable") {
    return "N/A";
  }
  return `${text}x`;
}

function parseMultiplierNumber(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "n/a" || text.toLowerCase() === "not applicable") {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

const modelOptions = computed(() =>
  modelCatalog.value.map((model) => ({
    ...model,
    factor: formatMultiplier(model.paid),
    factorNumeric: parseMultiplierNumber(model.paid),
    displayLabel: `${model.label} (${formatMultiplier(model.paid)})`,
  }))
);

const localModelOptions = computed(() =>
  modelOptions.value.filter((option) => option.provider === "ollama" && option.value !== "auto")
);
const freeModelOptions = computed(() =>
  modelOptions.value.filter(
    (option) => option.value !== "auto" && option.provider !== "ollama" && option.factorNumeric === 0
  )
);
const paidModelOptions = computed(() =>
  modelOptions.value.filter(
    (option) => option.value !== "auto" && option.provider !== "ollama" && option.factorNumeric !== 0 && option.factorNumeric !== null
  )
);

const selectedModel = ref("gpt-5-mini");
const ollamaHostInput = ref("");
const ollamaPortInput = ref("11434");

function parseOllamaBaseUrl(baseUrl) {
  const raw = String(baseUrl || "").trim();
  if (!raw) {
    return { host: "", port: "11434" };
  }

  try {
    const normalized = raw.includes("://") ? raw : `http://${raw}`;
    const url = new URL(normalized);
    return {
      host: url.hostname || "",
      port: url.port || "11434",
    };
  } catch {
    return { host: raw, port: "11434" };
  }
}

function buildOllamaBaseUrl(host, port) {
  const cleanHost = String(host || "").trim();
  if (!cleanHost) return null;
  const cleanPort = String(port || "").trim() || "11434";
  return `http://${cleanHost}:${cleanPort}/v1`;
}

function syncOllamaInputsFromBaseUrl(baseUrl) {
  const parsed = parseOllamaBaseUrl(baseUrl);
  ollamaHostInput.value = parsed.host;
  ollamaPortInput.value = parsed.port;
}

const selectedOllamaBaseUrl = computed(() => buildOllamaBaseUrl(ollamaHostInput.value, ollamaPortInput.value));

const selectedModelMultiplier = computed(() => {
  if (selectedModel.value === "auto") {
    return "Multiplier: auto-selected by Copilot";
  }
  const info = modelOptions.value.find((model) => model.value === selectedModel.value);
  if (!info?.factor) {
    return "Factor: N/A";
  }
  return `Factor: ${info.factor}`;
});

const sessionMessages = computed(() => currentSession.value?.messages || []);

const canSend = computed(() => {
  return !sending.value && prompt.value.trim().length > 0 && status.value.enabled;
});

const statusLabel = computed(() => {
  if (!status.value.enabled) return "Assistant disabled";
  if (!status.value.sdk_installed) return "SDK missing";
  if (!status.value.cli_available) return "Copilot CLI missing";
  return "Ready";
});

const canShowCopilotLogin = computed(() => {
  const provider = String(selectedProviderType.value || status.value?.effective_provider || "").toLowerCase();
  return provider !== "ollama";
});

const isCopilotAuthenticated = computed(() => {
  return Boolean(status.value?.has_token || status.value?.cli_authenticated);
});

const authLoginStateLabel = computed(() => {
  if (isCopilotAuthenticated.value) return "Authenticated";
  if (authLogin.value.running) return "Waiting for authorization...";
  if (authLogin.value.state === "succeeded") return "Login completed";
  if (authLogin.value.state === "failed") return "Login failed";
  return "Not started";
});

const providerLabel = computed(() => {
  const provider = String(selectedProviderType.value || status.value?.effective_provider || "").toLowerCase();
  if (provider === "ollama") return "Provider: Ollama";
  return "Provider: Copilot";
});

const providerBadgeClass = computed(() => {
  const provider = String(selectedProviderType.value || status.value?.effective_provider || "").toLowerCase();
  if (provider === "ollama") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
});

const providerTooltip = computed(() => {
  const provider = String(selectedProviderType.value || status.value?.effective_provider || "").toLowerCase();
  if (provider === "ollama") {
    const baseUrl = String(selectedOllamaBaseUrl.value || status.value?.local_ollama_base_url || "").trim();
    return baseUrl ? `Using local model via ${baseUrl}` : "Using local model via Ollama";
  }
  return "Using GitHub Copilot provider";
});

const selectedProviderType = computed(() => {
  const selected = String(selectedModel.value || "").trim().toLowerCase();
  const option = modelCatalog.value.find((item) => String(item.value || "").trim().toLowerCase() === selected);
  if (option?.provider === "ollama") return "ollama";
  return "copilot";
});

const resolvedOllamaTargetLabel = computed(() => {
  if (selectedOllamaBaseUrl.value) {
    return selectedOllamaBaseUrl.value;
  }
  return String(status.value?.local_ollama_base_url || "").trim() || "Using container default";
});

const runtimeLabel = computed(() => {
  if (runtimeState.value === "processing") return "Processing";
  if (runtimeState.value === "retrying") return "Retrying";
  if (runtimeState.value === "done") return "Done";
  if (runtimeState.value === "error") return "Error";
  return "Idle";
});

const runtimeClass = computed(() => {
  if (runtimeState.value === "processing") return "text-blue-700";
  if (runtimeState.value === "retrying") return "text-orange-700";
  if (runtimeState.value === "done") return "text-green-700";
  if (runtimeState.value === "error") return "text-red-700";
  return "text-gray-500";
});

const activeContextDir = computed(() => {
  const idx = settingStore.activeProjectIndex || 0;
  const folderNames = Object.keys(settingStore.workFolders || {});
  const activeFolderName = folderNames[idx] || null;
  return activeFolderName ? settingStore.workFolders[activeFolderName] || null : null;
});


function persistSessions() {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
    })
  );
}


function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const restoredSessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    const byContext = new Map();
    for (const session of restoredSessions) {
      const contextKey = String(session?.contextDir || "").trim();
      if (!contextKey) continue;
      byContext.set(contextKey, session);
    }
    const normalizedSessions = Array.from(byContext.values());
    if (normalizedSessions.length > 0) {
      sessions.value = normalizedSessions;
      activeSessionId.value = parsed?.activeSessionId || normalizedSessions[0].id;
      const active = normalizedSessions.find((s) => s.id === activeSessionId.value) || normalizedSessions[0];
      if (!normalizedSessions.some((s) => s.id === activeSessionId.value)) {
        activeSessionId.value = normalizedSessions[0].id;
      }
      selectedModel.value = active?.model || "gpt-5-mini";
      syncOllamaInputsFromBaseUrl(active?.ollamaBaseUrl || null);
    }
  } catch {
    sessions.value = [];
    activeSessionId.value = null;
  }
}


function appendSystemMessage(text) {
  if (!currentSession.value) return;
  currentSession.value.messages.push({ role: "system", text, trace: null });
  persistSessions();
}


function notifyAssistantPlotReady(contextDir, plotPayload) {
  if (!contextDir || !plotPayload) return;
  window.dispatchEvent(
    new CustomEvent("assistant-plot-ready", {
      detail: {
        contextDir,
        title: plotPayload.title || plotPayload.source_file || "Assistant Plot",
      },
    })
  );
}


function syncHistoryFromBackend(history) {
  if (!currentSession.value || !Array.isArray(history)) return;
  currentSession.value.messages = history.map((item) => ({
    role: item.role || "assistant",
    text: item.content || "",
    trace: null,
  }));
  persistSessions();
}


function getSessionTitleFromContext(contextDir) {
  if (!contextDir) return "No project";
  const chunks = contextDir.split("/").filter(Boolean);
  return chunks[chunks.length - 1] || contextDir;
}


function findSessionByContext(contextDir) {
  return (
    sessions.value.find((session) => session.contextDir === contextDir) || null
  );
}


function getEffectiveContextDir() {
  return activeContextDir.value || currentSession.value?.contextDir || null;
}


function isUnboundSessionError(result) {
  const errorText = String(result?.error || "");
  return errorText.includes("Assistant session is not bound to a valid work folder");
}


async function rebindCurrentSession() {
  const contextDir = getEffectiveContextDir();
  if (!contextDir) {
    return false;
  }

  const result = await assistantNewSession(
    contextDir,
    null,
    currentSession.value?.model || selectedModel.value,
    currentSession.value?.ollamaBaseUrl || selectedOllamaBaseUrl.value,
  );
  if (!result?.success || !result.data?.session_id || !currentSession.value) {
    return false;
  }

  currentSession.value.id = result.data.session_id;
  currentSession.value.contextDir = result.data.context_dir || contextDir;
  currentSession.value.model = result.data.model || currentSession.value.model || selectedModel.value;
  currentSession.value.ollamaBaseUrl = result.data.ollama_base_url || currentSession.value.ollamaBaseUrl || selectedOllamaBaseUrl.value;
  currentSession.value.title = getSessionTitleFromContext(currentSession.value.contextDir);
  persistSessions();
  return true;
}


async function createSession() {
  const contextDir = getEffectiveContextDir();
  if (!contextDir) {
    appendSystemMessage("Select or create a work project first; assistant sessions are bound to that work folder.");
    return;
  }

  const existing = findSessionByContext(contextDir);
  if (existing) {
    existing.model = selectedModel.value;
    existing.ollamaBaseUrl = selectedOllamaBaseUrl.value;
    existing.title = getSessionTitleFromContext(contextDir);
    activeSessionId.value = existing.id;
    persistSessions();
    return;
  }

  const result = await assistantNewSession(contextDir, null, selectedModel.value, selectedOllamaBaseUrl.value);
  if (!result?.success) {
    appendSystemMessage(result?.error || "Could not create assistant session for active work folder.");
    return;
  }

  const sessionId = result.data?.session_id;
  if (!sessionId) return;
  sessions.value.push({
    id: sessionId,
    title: getSessionTitleFromContext(contextDir),
    contextDir,
    model: result.data?.model || selectedModel.value,
    ollamaBaseUrl: result.data?.ollama_base_url || selectedOllamaBaseUrl.value,
    messages: [],
  });
  activeSessionId.value = sessionId;
  persistSessions();
}


async function resetCurrentSession() {
  if (!currentSession.value) return;
  const result = await assistantResetSession(currentSession.value.id);
  if (result?.success) {
    currentSession.value.messages = [];
    appendSystemMessage(`Session cleared for ${currentSession.value.title}.`);
    persistSessions();
  } else {
    appendSystemMessage(result?.error || "Could not reset session.");
  }
}

async function refreshStatus() {
  loadingStatus.value = true;
  try {
    const result = await assistantAuthStatus(selectedOllamaBaseUrl.value);
    if (result?.success && result.data) {
      status.value = result.data;
      mergeRuntimeModels(result.data);
      if (Boolean(result.data?.has_token || result.data?.cli_authenticated)) {
        authLogin.value.state = "succeeded";
        authLogin.value.running = false;
      }
    } else if (result?.error) {
      appendSystemMessage(result.error);
    }
  } catch {
    appendSystemMessage("Could not fetch assistant status.");
  } finally {
    loadingStatus.value = false;
  }
}

function stopAuthPolling() {
  if (authPollTimer.value) {
    clearInterval(authPollTimer.value);
    authPollTimer.value = null;
  }
}

async function pollAuthLoginStatus() {
  if (!authLogin.value.loginId) return;
  const result = await assistantAuthLoginStatus(authLogin.value.loginId);
  if (!result?.success || !result?.data) {
    authLogin.value.running = false;
    authLogin.value.state = "failed";
    authLogin.value.error = result?.error || "Could not fetch login status.";
    stopAuthPolling();
    return;
  }

  const data = result.data;
  authLogin.value.state = data.state || "running";
  authLogin.value.userCode = data.user_code || authLogin.value.userCode;
  authLogin.value.verificationUrl = data.verification_url || authLogin.value.verificationUrl;
  authLogin.value.logs = Array.isArray(data.logs) ? data.logs : [];

  if (data.state === "succeeded" || data.state === "failed") {
    authLogin.value.running = false;
    stopAuthPolling();
    await refreshStatus();
  }
}

async function startBrowserLogin() {
  authLogin.value.error = "";
  authLogin.value.logs = [];
  authLogin.value.userCode = "";
  authLogin.value.state = "running";
  authLogin.value.running = true;

  const startResult = await assistantAuthLoginStart();
  if (!startResult?.success || !startResult?.data) {
    authLogin.value.running = false;
    authLogin.value.state = "failed";
    authLogin.value.error = startResult?.error || "Could not start login flow.";
    return;
  }

  authLogin.value.loginId = startResult.data.login_id || null;
  authLogin.value.verificationUrl = startResult.data.verification_url || "https://github.com/login/device";
  if (authLogin.value.verificationUrl) {
    window.open(authLogin.value.verificationUrl, "_blank", "noopener,noreferrer");
  }

  await pollAuthLoginStatus();
  stopAuthPolling();
  authPollTimer.value = setInterval(() => {
    pollAuthLoginStatus();
  }, 2000);
}

function mergeRuntimeModels(runtimeStatus) {
  const localModels = Array.isArray(runtimeStatus?.local_models) ? runtimeStatus.local_models : [];
  const localOptions = localModels
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .map((name) => ({
      label: `${name} (Ollama local)`,
      value: name,
      paid: "N/A",
      free: "N/A",
      provider: "ollama",
    }));

  const merged = [...baseModelCatalog, ...localOptions];
  const deduped = [];
  const seen = new Set();
  for (const option of merged) {
    const key = String(option.value || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(option);
  }

  modelCatalog.value = deduped;
}

async function sendMessage() {
  const text = prompt.value.trim();
  if (!text) return;

  if (!currentSession.value) {
    await createSession();
  }
  if (currentSession.value && (currentSession.value.model || "gpt-5-mini") !== selectedModel.value) {
    await createSession();
  }
  if (!currentSession.value) return;

  currentSession.value.messages.push({ role: "user", text, trace: null });
  const assistantPlaceholder = { role: "assistant", text: "Working...", trace: [] };
  currentSession.value.messages.push(assistantPlaceholder);
  persistSessions();
  prompt.value = "";
  sending.value = true;
  runtimeState.value = "processing";

  const retryTimer = setTimeout(() => {
    if (sending.value) runtimeState.value = "retrying";
  }, 7000);

  const placeholderIdx = currentSession.value.messages.length - 1;
  const requestContextDir = getEffectiveContextDir();

  try {
    let result = await assistantChatStream(
      text,
      currentSession.value.id,
      requestContextDir,
      currentSession.value.model || selectedModel.value,
      currentSession.value.ollamaBaseUrl || selectedOllamaBaseUrl.value,
      {
        onTrace: (entry) => {
          if (!currentSession.value?.messages?.[placeholderIdx]) return;
          const msg = currentSession.value.messages[placeholderIdx];
          if (!Array.isArray(msg.trace)) {
            msg.trace = [];
          }
          msg.trace.push(entry);
          if (msg.trace.length > 300) {
            msg.trace = msg.trace.slice(-300);
          }
          persistSessions();
        },
      }
    );

    if (isUnboundSessionError(result)) {
      const rebound = await rebindCurrentSession();
      if (rebound && currentSession.value) {
        result = await assistantChatStream(
          text,
          currentSession.value.id,
          getEffectiveContextDir(),
          currentSession.value.model || selectedModel.value,
          currentSession.value.ollamaBaseUrl || selectedOllamaBaseUrl.value,
          {
            onTrace: (entry) => {
              if (!currentSession.value?.messages?.[placeholderIdx]) return;
              const msg = currentSession.value.messages[placeholderIdx];
              if (!Array.isArray(msg.trace)) {
                msg.trace = [];
              }
              msg.trace.push(entry);
              if (msg.trace.length > 300) {
                msg.trace = msg.trace.slice(-300);
              }
              persistSessions();
            },
          }
        );
      }
    }

    if (result?.success) {
      if (currentSession.value) {
        currentSession.value.ollamaBaseUrl = result.data?.ollama_base_url || currentSession.value.ollamaBaseUrl || selectedOllamaBaseUrl.value;
      }
      if (Array.isArray(result.data?.history)) {
        syncHistoryFromBackend(result.data.history);
        const plotPayload = result.data?.plot;
        const tracePayload = Array.isArray(result.data?.trace) ? result.data.trace : null;
        if (plotPayload && currentSession.value?.messages?.length) {
          const assistantMessages = currentSession.value.messages
            .map((message, idx) => ({ message, idx }))
            .filter((entry) => entry.message.role === "assistant");
          const lastAssistant = assistantMessages[assistantMessages.length - 1];
          if (lastAssistant) {
            if (tracePayload) {
              currentSession.value.messages[lastAssistant.idx].trace = tracePayload;
            }
            persistSessions();
          }
          if (activeContextDir.value) {
            assistantPlotStore.setPlot(activeContextDir.value, plotPayload);
            notifyAssistantPlotReady(activeContextDir.value, plotPayload);
            appendSystemMessage("Visualization generated. Open Data Editor → Assistant Plot to view it.");
          }
        } else if (tracePayload && currentSession.value?.messages?.length) {
          const assistantMessages = currentSession.value.messages
            .map((message, idx) => ({ message, idx }))
            .filter((entry) => entry.message.role === "assistant");
          const lastAssistant = assistantMessages[assistantMessages.length - 1];
          if (lastAssistant) {
            currentSession.value.messages[lastAssistant.idx].trace = tracePayload;
            persistSessions();
          }
        }
      } else {
        if (currentSession.value?.messages?.[placeholderIdx]) {
          currentSession.value.messages[placeholderIdx].text = result.data?.message || "";
          currentSession.value.messages[placeholderIdx].trace =
            Array.isArray(result.data?.trace) ? result.data.trace : currentSession.value.messages[placeholderIdx].trace;
        }
        if (result.data?.plot && activeContextDir.value) {
          assistantPlotStore.setPlot(activeContextDir.value, result.data.plot);
          notifyAssistantPlotReady(activeContextDir.value, result.data.plot);
          appendSystemMessage("Visualization generated. Open Data Editor → Assistant Plot to view it.");
        }
        persistSessions();
      }
      runtimeState.value = "done";
    } else {
      if (currentSession.value?.messages?.[placeholderIdx]) {
        currentSession.value.messages.splice(placeholderIdx, 1);
      }
      appendSystemMessage(result?.error || "Assistant request failed.");
      runtimeState.value = "error";
    }
  } catch (error) {
    if (currentSession.value?.messages?.[placeholderIdx]) {
      currentSession.value.messages.splice(placeholderIdx, 1);
    }
    appendSystemMessage(String(error));
    runtimeState.value = "error";
  } finally {
    clearTimeout(retryTimer);
    sending.value = false;
    setTimeout(() => {
      if (!sending.value) runtimeState.value = "idle";
    }, 1200);
  }
}


async function syncSessionToActiveProject() {
  if (!activeContextDir.value) {
    return;
  }
  await createSession();
}

function handleOpenChatEvent() {
  open.value = true;
  nextTick(() => {
    promptInput.value?.focus();
  });
}

marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(text) {
  const raw = String(text || "");
  const html = marked.parse(raw);
  return DOMPurify.sanitize(String(html));
}

function baseName(path) {
  const text = String(path || "");
  if (!text) return "";
  const chunks = text.split("/").filter(Boolean);
  return chunks[chunks.length - 1] || text;
}

function parseTraceArguments(args) {
  if (!args) return null;
  if (typeof args === "object") return args;
  if (typeof args !== "string") return null;

  try {
    return JSON.parse(args);
  } catch {
    // Fall back to Python-dict-like strings emitted by some SDK events.
  }

  const parsed = {};
  const keyValue = /'([^']+)'\s*:\s*'([^']*)'/g;
  let match;
  while ((match = keyValue.exec(args)) !== null) {
    parsed[match[1]] = match[2];
  }

  const viewRange = /'view_range'\s*:\s*\[(\d+)\s*,\s*(\d+)\]/.exec(args);
  if (viewRange) {
    parsed.view_range = [Number(viewRange[1]), Number(viewRange[2])];
  }

  return Object.keys(parsed).length ? parsed : null;
}

function buildExecutionDetailLines(trace) {
  if (!Array.isArray(trace) || !trace.length) return [];

  const lines = [];
  const toolByCallId = {};

  for (const entry of trace) {
    if (!entry || typeof entry !== "object") {
      lines.push(String(entry));
      continue;
    }

    if (entry.event !== "sdk.event") {
      if (entry.event === "request.start") {
        lines.push(`Request started (timeout ${entry.timeout_seconds || "?"}s)`);
        continue;
      }
      if (entry.event === "session.resumed") {
        lines.push(`Resumed session ${entry.sdk_session_id || ""}`.trim());
        continue;
      }
      if (entry.event === "session.created") {
        lines.push(`Created new session ${entry.sdk_session_id || ""}`.trim());
        continue;
      }
      if (entry.event === "prompt.built") {
        lines.push(`Built prompt (${entry.mode || "unknown"}, ${entry.chars || 0} chars)`);
        continue;
      }
      if (entry.event === "request.success") {
        lines.push(`Request finished in ${entry.elapsed_seconds || "?"}s`);
        continue;
      }
      continue;
    }

    const type = String(entry.type || "");

    if (type === "assistant.message" && entry.content) {
      lines.push(String(entry.content));
      continue;
    }

    if (type === "tool.execution_start") {
      const args = parseTraceArguments(entry.arguments);
      const toolName = String(entry.tool || "tool");
      const callId = String(entry.tool_call_id || "");
      if (callId) {
        toolByCallId[callId] = toolName;
      }

      if (toolName === "glob") {
        lines.push(`Search: ${args?.pattern || entry.arguments || "(pattern)"}`);
        continue;
      }

      if (toolName === "view") {
        const file = args?.path ? baseName(args.path) : "file";
        const vr = Array.isArray(args?.view_range) ? args.view_range : null;
        if (vr && vr.length === 2) {
          lines.push(`Read ${file}, lines ${vr[0]} to ${vr[1]}`);
        } else {
          lines.push(`Read ${file}`);
        }
        continue;
      }

      if (toolName === "report_intent") {
        if (args?.intent) {
          lines.push(String(args.intent));
        }
        continue;
      }

      if (toolName === "bash") {
        lines.push("Run shell command");
        continue;
      }

      lines.push(`Run tool: ${toolName}`);
      continue;
    }

    if (type === "tool.execution_complete") {
      const callId = String(entry.tool_call_id || "");
      const toolName = String(entry.tool || toolByCallId[callId] || "");
      if (toolName === "bash") {
        lines.push("Shell command completed");
      }
      continue;
    }
  }

  return lines.length ? lines : trace.map((entry) => JSON.stringify(entry));
}

function isAssistantWorkingMessage(msg) {
  return msg?.role === "assistant" && String(msg?.text || "").trim() === "Working...";
}

onMounted(() => {
  loadSessions();
  refreshStatus();
  syncSessionToActiveProject();
  window.addEventListener("open-copilot-chat", handleOpenChatEvent);
});

onBeforeUnmount(() => {
  window.removeEventListener("open-copilot-chat", handleOpenChatEvent);
  stopAuthPolling();
});

watch(activeContextDir, async () => {
  await syncSessionToActiveProject();
});

watch(activeSessionId, () => {
  if (!currentSession.value) return;
  selectedModel.value = currentSession.value.model || "gpt-5-mini";
  syncOllamaInputsFromBaseUrl(currentSession.value.ollamaBaseUrl || null);
});

watch(selectedModel, async () => {
  await syncSessionToActiveProject();
});

watch([ollamaHostInput, ollamaPortInput], () => {
  if (currentSession.value) {
    currentSession.value.ollamaBaseUrl = selectedOllamaBaseUrl.value;
    persistSessions();
  }
});
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50">
    <button
      class="rounded-full bg-blue-700 px-4 py-2 text-white shadow hover:bg-blue-800"
      @click="open = !open"
    >
      Copilot
    </button>

    <div v-if="open" class="mt-2 w-[620px] max-w-[95vw] h-[75vh] max-h-[820px] rounded-lg border border-gray-300 bg-white shadow-lg flex flex-col">
      <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div class="text-sm font-semibold">SiteOpt Copilot</div>
        <div class="flex items-center gap-2">
          <span class="rounded px-2 py-0.5 text-[11px]" :class="providerBadgeClass" :title="providerTooltip">
            {{ providerLabel }}
          </span>
          <div class="text-xs" :class="statusLabel === 'Ready' ? 'text-green-700' : 'text-orange-700'">
            {{ loadingStatus ? "Checking..." : statusLabel }}
          </div>
        </div>
      </div>

      <div class="border-b border-gray-200 px-3 py-2 text-xs">
        <div class="flex items-center gap-2">
          <span class="font-semibold shrink-0">Project session:</span>
          <span class="truncate min-w-0 flex-1">{{ currentSession?.title || "No project selected" }}</span>
          <button class="rounded border border-gray-300 px-2 py-1 shrink-0" @click="resetCurrentSession">Clear session</button>
        </div>
        <div class="mt-2 flex items-center gap-2 min-w-0">
          <label class="shrink-0 font-semibold">Model:</label>
          <div class="min-w-0">
            <select
              v-model="selectedModel"
              class="w-[260px] max-w-[60vw] rounded border border-gray-300 px-2 py-1 text-xs bg-white"
              title="Choose Copilot model for this project session"
            >
              <option value="auto">Auto</option>
              <optgroup v-if="localModelOptions.length" label="Local (Ollama)">
                <option v-for="option in localModelOptions" :key="option.value" :value="option.value">{{ option.displayLabel }}</option>
              </optgroup>
              <optgroup label="Free (0x)">
                <option v-for="option in freeModelOptions" :key="option.value" :value="option.value">{{ option.displayLabel }}</option>
              </optgroup>
              <optgroup label="Paid (>0x)">
                <option v-for="option in paidModelOptions" :key="option.value" :value="option.value">{{ option.displayLabel }}</option>
              </optgroup>
            </select>
            <div class="mt-1 text-[11px] text-gray-500">{{ selectedModelMultiplier }}</div>
          </div>
        </div>
        <div class="mt-2 flex items-end gap-2 min-w-0">
          <div>
            <label class="block text-[11px] font-semibold text-gray-600">Ollama host</label>
            <input
              v-model="ollamaHostInput"
              class="w-[220px] max-w-[50vw] rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="192.168.50.69"
              @change="refreshStatus"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-gray-600">Port</label>
            <input
              v-model="ollamaPortInput"
              class="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
              placeholder="11434"
              @change="refreshStatus"
            />
          </div>
          <div class="min-w-0 flex-1 text-[11px] text-gray-500">
            {{ resolvedOllamaTargetLabel }}
          </div>
        </div>
        <div class="mt-1 text-gray-500 truncate">{{ activeContextDir || "No active work folder" }}</div>
      </div>

      <div class="border-b border-gray-200 px-3 py-2">
        <div class="flex items-center justify-between">
          <button class="rounded border border-gray-300 px-2 py-1 text-xs" @click="refreshStatus">Refresh status</button>
          <div class="text-xs" :class="runtimeClass">
            {{ runtimeLabel }}
          </div>
        </div>
        <div v-if="canShowCopilotLogin" class="mt-2 rounded border border-gray-200 p-2 text-xs">
          <div class="flex items-center justify-between gap-2">
            <div class="font-semibold">GitHub Copilot Login</div>
            <button
              class="rounded border border-gray-300 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="authLogin.running"
              @click="startBrowserLogin"
            >
              {{ authLogin.running ? "Starting..." : "Login in browser" }}
            </button>
          </div>
          <div class="mt-1 text-gray-600">{{ authLoginStateLabel }}</div>
          <div v-if="authLogin.userCode" class="mt-1">
            Code: <span class="font-mono font-semibold">{{ authLogin.userCode }}</span>
          </div>
          <div v-if="authLogin.verificationUrl && !isCopilotAuthenticated" class="mt-1 break-all">
            URL: {{ authLogin.verificationUrl }}
          </div>
          <div v-if="authLogin.error" class="mt-1 text-red-700">{{ authLogin.error }}</div>
          <details v-if="Array.isArray(authLogin.logs) && authLogin.logs.length" class="mt-2">
            <summary class="cursor-pointer text-gray-700">Login logs</summary>
            <div class="mt-1 max-h-28 overflow-y-auto rounded bg-gray-50 p-2 font-mono text-[11px] text-gray-700">
              <div v-for="(line, idx) in authLogin.logs" :key="idx" class="whitespace-pre-wrap break-words">{{ line }}</div>
            </div>
          </details>
        </div>
      </div>

      <div class="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        <div v-for="(msg, idx) in sessionMessages" :key="idx" class="rounded px-2 py-1"
             :class="msg.role === 'user' ? 'bg-blue-50' : (msg.role === 'assistant' ? 'bg-gray-100' : 'bg-amber-50')">
          <div>
            <span class="font-semibold">{{ msg.role }}:</span>
          </div>

          <div
            v-if="msg.role === 'assistant' && Array.isArray(msg.trace) && msg.trace.length && isAssistantWorkingMessage(msg)"
            class="mt-2 rounded border border-gray-200 bg-white p-2 text-xs"
          >
            <div class="font-semibold text-gray-700">Execution details</div>
            <div class="mt-2 space-y-1">
              <div v-for="(line, traceIdx) in buildExecutionDetailLines(msg.trace)" :key="traceIdx" class="break-words text-gray-700">
                {{ line }}
              </div>
            </div>
          </div>

          <details
            v-if="msg.role === 'assistant' && Array.isArray(msg.trace) && msg.trace.length && !isAssistantWorkingMessage(msg)"
            class="mt-2 rounded border border-gray-200 bg-white p-2 text-xs"
          >
            <summary class="cursor-pointer font-semibold text-gray-700">Execution details</summary>
            <div class="mt-2 space-y-1">
              <div v-for="(line, traceIdx) in buildExecutionDetailLines(msg.trace)" :key="traceIdx" class="break-words text-gray-700">
                {{ line }}
              </div>
            </div>
          </details>

          <div
            v-if="msg.role === 'assistant' || msg.role === 'system'"
            class="assistant-markdown break-words"
            v-html="renderMarkdown(msg.text)"
          ></div>
          <div v-else class="whitespace-pre-wrap break-words">{{ msg.text }}</div>

        </div>
      </div>

      <div class="flex gap-2 border-t border-gray-200 p-3">
        <input
          v-model="prompt"
          ref="promptInput"
          class="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="Ask to edit/read SiteOpt inputs..."
          @keydown.enter="sendMessage"
        />
        <button
          class="rounded bg-blue-700 px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          :disabled="!canSend"
          @click="sendMessage"
        >
          {{ sending ? "..." : "Send" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assistant-markdown :deep(p) {
  margin: 0.35rem 0;
}

.assistant-markdown :deep(ul),
.assistant-markdown :deep(ol) {
  margin: 0.35rem 0;
  padding-left: 1.1rem;
}

.assistant-markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.assistant-markdown :deep(th),
.assistant-markdown :deep(td) {
  border: 1px solid var(--color-gray-300);
  padding: 0.25rem 0.4rem;
  text-align: left;
  vertical-align: top;
}

.assistant-markdown :deep(code) {
  white-space: pre-wrap;
}
</style>
