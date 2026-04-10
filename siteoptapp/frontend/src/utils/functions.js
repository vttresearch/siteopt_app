import { useNotificationStore } from '@/stores/notificationstore.js'
import { useSettingStore } from "@/stores/settingstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useResultStore } from "@/stores/resultstore.js";
import { useScenarioStore } from "@/stores/scenariostore.js";
import { API_BASE } from "@/config.js";


/**
 * Sends a request to backend using POST.
 *
 * @param {string} endpointSuffix - The endpoint suffix to post to
 * @param {Object} data - An object containing some data
 * @param {Object} notify - A notification utility with a `show(message, duration, type)` method for displaying errors.
 * The function performs:
 * - CSRF-protected POST request to the specified endpoint.
 * - Error handling for failed requests or unsuccessful responses.
 * - Displays error notifications using the provided `notify` utility.
 */
export async function postData(endpointSuffix, data, notify) {
  const csrfToken = getCookie("csrftoken");
  const url = `${API_BASE}api/post/${endpointSuffix}/`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({"data": data}),  // [] evaluates the expression inside, and uses the result as the key name in the object
    });
    if (!response.ok) {
      console.error("Invalid post:", await response.text());
      return false
    }
    const r = await response.json();
    if (!r.success) {
      notify.show(`${r.error}`, 5000, "error");
      return false
    }
    return r
  } catch (err) {
    console.error(`Error posting ${data}:`, err);
    return false
  }
}


/**
 * Sends data to backend using POST as-is (no Content-Type).
 *
 * @param {Object} data - An object containing data
 * @param {Object} notify - A notification utility with a `show(message, duration, type)` method for displaying errors.
 *
 */
export async function uploadFile(data, notify) {
  const csrfToken = getCookie("csrftoken");
  const url = `${API_BASE}api/upload/`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: data,
    });
    if (!response.ok) {
      console.error("Invalid post:", await response.text());
      return false
    }
    const r = await response.json();
    if (!r.success) {
      notify.show(`${r.error}`, 5000, "error");
      return false
    }
    return true
  } catch (err) {
    console.error(`Error posting ${data}:`, err);
    return false
  }
}


/**
 * Fetches data using GET from the specified API endpoint.
 *
 * @param {string} endpoint - The API endpoint suffix.
 * @param {Object} notify - A notification utility with a `show(message, duration, type)` method for displaying errors.
 *
 */
export const getData = async (endpoint, notify) => {
  const url = `${API_BASE}api/${endpoint}/`;
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Server ${url} error. status: [${response.status}] error: ${errorText}`);
      notify.show(`Server ${url} responded with error: ${errorText}`, 10000, "error");
      return;
    }
    return await response.json();
  } catch (err) {
    notify.show(`[${err}] in fetching url: ${url}`, "5000", "error");
    console.error(`Error fetching from ${url}:`, err);
  }
};


/**
 * Assistant API: get runtime/auth status.
 */
export const assistantAuthStatus = async (ollamaBaseUrl = null) => {
  try {
    const query = new URLSearchParams();
    if (ollamaBaseUrl) {
      query.set("ollama_base_url", String(ollamaBaseUrl));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await fetch(`${API_BASE}api/assistant/auth/status/${suffix}`, {
      method: "GET",
      credentials: "include",
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return { success: false, error: text || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Assistant API: start Copilot browser/device login flow.
 */
export const assistantAuthLoginStart = async () => {
  const csrfToken = getCookie("csrftoken");
  try {
    const response = await fetch(`${API_BASE}api/assistant/auth/login/start/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({}),
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return { success: false, error: text || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Assistant API: get Copilot browser/device login status.
 */
export const assistantAuthLoginStatus = async (loginId) => {
  try {
    const encoded = encodeURIComponent(String(loginId || ""));
    const response = await fetch(`${API_BASE}api/assistant/auth/login/status/?login_id=${encoded}`, {
      method: "GET",
      credentials: "include",
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return { success: false, error: text || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Assistant API: create a new server-side session.
 */
export const assistantNewSession = async (contextDir = null, systemPrompt = null, model = null, ollamaBaseUrl = null) => {
  const csrfToken = getCookie("csrftoken");
  try {
    const response = await fetch(`${API_BASE}api/assistant/session/new/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({
        context_dir: contextDir,
        system_prompt: systemPrompt,
        model,
        ollama_base_url: ollamaBaseUrl,
      }),
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return { success: false, error: text || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Assistant API: reset an existing server-side session history.
 */
export const assistantResetSession = async (sessionId) => {
  const csrfToken = getCookie("csrftoken");
  try {
    const response = await fetch(`${API_BASE}api/assistant/session/reset/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ session_id: sessionId }),
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return { success: false, error: text || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Assistant API: chat with SiteOpt Copilot.
 */
export const assistantChat = async (message, sessionId = "default", contextDir = null, model = null, ollamaBaseUrl = null) => {
  const csrfToken = getCookie("csrftoken");
  try {
    const response = await fetch(`${API_BASE}api/assistant/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({
        message,
        session_id: sessionId,
        context_dir: contextDir,
        model,
        ollama_base_url: ollamaBaseUrl,
      }),
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return { success: false, error: text || `HTTP ${response.status}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Assistant API: stream chat events (trace/progress/final) over SSE response.
 */
export const assistantChatStream = async (
  message,
  sessionId = "default",
  contextDir = null,
  model = null,
  ollamaBaseUrl = null,
  handlers = {}
) => {
  const csrfToken = getCookie("csrftoken");
  const onTrace = typeof handlers.onTrace === "function" ? handlers.onTrace : () => {};
  const onStatus = typeof handlers.onStatus === "function" ? handlers.onStatus : () => {};
  const onError = typeof handlers.onError === "function" ? handlers.onError : () => {};

  try {
    const response = await fetch(`${API_BASE}api/assistant/chat/stream/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({
        message,
        session_id: sessionId,
        context_dir: contextDir,
        model,
        ollama_base_url: ollamaBaseUrl,
      }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      return { success: false, error: text || `HTTP ${response.status}` };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalPayload = null;
    let errorPayload = null;

    const processEventBlock = (block) => {
      const lines = block.split("\n");
      let eventType = "message";
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      const rawData = dataLines.join("\n");
      if (!rawData) return;

      let parsed = null;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        parsed = { raw: rawData };
      }

      if (eventType === "trace") {
        if (parsed?.entry) onTrace(parsed.entry);
      } else if (eventType === "status") {
        onStatus(parsed);
      } else if (eventType === "error") {
        errorPayload = parsed;
        onError(parsed);
      } else if (eventType === "final") {
        finalPayload = parsed;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex = buffer.indexOf("\n\n");
      while (sepIndex !== -1) {
        const block = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        if (block.trim()) {
          processEventBlock(block);
        }
        sepIndex = buffer.indexOf("\n\n");
      }
    }

    if (finalPayload) {
      return finalPayload;
    }
    if (errorPayload) {
      return errorPayload;
    }
    return { success: false, error: "Stream completed without final payload." };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


/**
 * Fetches settings.
 */
export const fetchSettings = async () => {
  const settingStore = useSettingStore()
  const notify = useNotificationStore()
  const response = await getData("settings", notify)
  if (!response.success) {
    return
  }
  settingStore.setSettings(response.data.configs)
}


/**
 * Fetches the contents of a given file.
 *
 * @param {string} fname - File name.
 * @param {string} fpath - Full path to file (including the file name).
 *
 */
export async function fetchFileContents(fname, fpath) {
  console.log(`Downloading file: ${fpath}`)
  const notify = useNotificationStore()
  const dataStore = useTableDataStore()
  dataStore.clear()
  dataStore.toggleLoading()
  const response = await postData("fetch_data", {full_path: fpath}, notify)
  if (!response.success) {
    dataStore.toggleLoading()
    return
  }
  dataStore.addData(fname, fpath, response.data)
  dataStore.toggleLoading()
}

/**
 * Fetches the contents of current_input file tree of a given project.
 *
 * @param {string} projectName - Project folder name.
 *
 */
export async function fetchInputFiles(projectName) {
  const settingStore = useSettingStore()
  const notify = useNotificationStore()
  if (!projectName) {
    notify.show("[FIXME] Fetching current input files failed. Project name missing.")
    return
  }
  const response = await getData(`fetch_current_input_folder/${projectName}`, notify)
  if (!response.success) {
    notify.show(`${response.error}`)
    return
  }
  const contents = response.data
  settingStore.setCurrentInputFiles(contents)
}

/**
 * Fetches the results of a given project.
 *
 * @param {string} projectName - Project folder name.
 *
 */
export async function fetchResults(projectName) {
  const resultStore = useResultStore()
  const notify = useNotificationStore()
  if (!projectName) {
    notify.show("[FIXME] Fetching results failed. Project name missing.")
    return
  }
  const r = await postData("list_results",{ project_name: projectName }, notify)
  if (!r?.success) {
    return false
  }
  resultStore.runs = r.data || {}
  return true
}


/**
 * Fetches the scenarios of a given project.
 *
 * @param {string} projectPath - Full project path.
 *
 */
export async function fetchScenarios(projectPath) {
  const scenarioStore = useScenarioStore()
  const notify = useNotificationStore()
  if (!projectPath) {
    notify.show("[FIXME] Fetching scenarios failed. Project path missing.")
    return false
  }
  scenarioStore.loadingScenarios = true
  const configs = { db_key: "scenario", work_folder: projectPath }
  const response = await postData("fetch_input_db_data", configs, notify)
  if (!response?.success) {
    console.error(`fetching scenarios from input db failed for project ${projectPath}`)
    scenarioStore.loadingScenarios = false
    return false
  }
  scenarioStore.scenarios = response.data.scenarios || []
  scenarioStore.loadingScenarios = false
  return true
}


/**
 * Retries connection to backend every 5 seconds (4000ms + 1000ms) until max attempts is reached.
 */
export const checkBackendReady = async () => {
  const notify = useNotificationStore()
  const settingStore = useSettingStore();
  settingStore.backendAvailable = false;
  settingStore.backendRetryAttempts = 0;
  let timeout = 1000
  const maxAttempts = 10
  const url = `${API_BASE}api/health/`
  while (settingStore.backendRetryAttempts < maxAttempts) {
    try {
      const res = await fetchWithTimeout(url, 4000)
      if (res.ok) {
        settingStore.backendAvailable = true
        return true
      }
    } catch (err) {
      notify.show(`Reconnect attempt ${settingStore.backendRetryAttempts + 1}/${maxAttempts}`, 2000, "info")
    }
    settingStore.backendRetryAttempts++
    // This is like python's time.sleep()
    await new Promise(resolve => setTimeout(resolve, timeout)) // Wait 1s before retrying
  }
  return false
}


/**
 * Ensures that fetch fails exactly in given timeout
 *
 * @param url url to fetch
 * @param timeout time for fetch to finish
 * @returns {Promise<Response>} response if fetch succeeded, throws an error if timeout is reached.
 */
const fetchWithTimeout = async (url, timeout = 1000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {credentials: "include", signal: controller.signal })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

/**
 * Retrieves cookie with the given name.
 */
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    // console.log(cookies)
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Match start of cookie string with given name
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
