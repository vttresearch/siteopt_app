import { useNotificationStore } from '@/stores/notificationstore.js'
import { useSettingStore } from "@/stores/settingstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useResultStore } from "@/stores/resultstore.js";
import { useScenarioStore } from "@/stores/scenariostore.js";
import { useMetadataStore } from "@/stores/metadatastore.js";
import { API_BASE } from "@/config.js";
import { summarizeEditorFileValidation } from "./dataEditorValidationSummary.js";


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

export async function uploadInputCsv(data, notify) {
  const csrfToken = getCookie("csrftoken");
  const url = `${API_BASE}api/upload_input_csv/`;
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
    return r
  } catch (err) {
    console.error(`Error uploading input CSV:`, err);
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
  await refreshCurrentInputValidation(projectName, contents)
}

function buildCurrentInputFilePath(projectPath, categoryValue, fileName) {
  const basePath = `${projectPath}/current_input`
  return categoryValue
    ? `${basePath}/${categoryValue}/${fileName}`
    : `${basePath}/${fileName}`
}

async function fetchInputFileDataForValidation(fullPath, notify) {
  const response = await postData("fetch_data", { full_path: fullPath }, notify)
  if (!response?.success) return null
  return response.data
}

async function refreshCurrentInputValidation(projectName, contents) {
  const settingStore = useSettingStore()
  const notify = useNotificationStore()
  const projectPath = settingStore.activeProjectPath

  if (!projectPath || settingStore.activeProjectName !== projectName) {
    settingStore.setCurrentInputValidationByPath({})
    return
  }

  const fileEntries = (contents ?? []).flatMap((category) =>
    (category.options ?? []).map((option) => ({
      categoryValue: category.value,
      fileName: option.value,
      fullPath: buildCurrentInputFilePath(projectPath, category.value, option.value),
    })),
  )

  const results = await Promise.all(fileEntries.map(async (entry) => {
    const fileData = await fetchInputFileDataForValidation(entry.fullPath, notify)
    if (!fileData) {
      return [entry.fullPath, { invalidCount: 0, filetype: null, sheets: {} }]
    }

    return [entry.fullPath, summarizeEditorFileValidation({
      fileName: entry.fileName,
      fileData,
    })]
  }))

  if (settingStore.activeProjectName !== projectName) {
    return
  }

  settingStore.setCurrentInputValidationByPath(Object.fromEntries(results))
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
    return
  }
  scenarioStore.loadingScenarios = true
  const configs = {db_key: "scenario", work_folder: projectPath}
  const response = await postData("fetch_input_db_data", configs, notify)
  if (!response.success) {
    console.error(`fetching scenarios from input db failed for project ${projectPath}`)
    scenarioStore.loadingScenarios = false
    return false
  }
  scenarioStore.scenarios = response.data.scenarios || []
  scenarioStore.loadingScenarios = false
  return true
}


/**
 * Fetches metadata from the given project path.
 *
 * @param {string} projectPath - Full project path.
 * @param cacheOnly
 *
 */
export async function fetchMetadata(projectPath, { cacheOnly = false } = {}) {
  const metadataStore = useMetadataStore()
  const notify = useNotificationStore()
  metadataStore.loadingMetadata = true
  const response = await postData(
    'fetch_metadata',
    { path: projectPath },
    notify
  )
  metadataStore.loadingMetadata = false
  if (!response.success) {
    console.error(`fetching metadata for project ${projectPath} failed`)
    return false
  }
  // normalize empty object → null
  const metadata = response.data && Object.keys(response.data).length ? response.data : null
  // only cache real metadata
  if (metadata) {
    metadataStore.cacheMetadata(metadata)
  }
  if (!cacheOnly) {
    metadataStore.setMetadata(metadata)
  }
  return true
}


/**
 * Fetches metadata for all projects in tabs.
 *
 * @param {Array} paths - Project paths.
 *
 */
export async function fetchMetadataBulk(paths) {
  const metadataStore = useMetadataStore()
  const notify = useNotificationStore()
  metadataStore.loadingMetadata = true
  try {
    const res = await postData("fetch_metadata_bulk", { paths }, notify)
    if (!res.success) return
    for (const metadata of Object.values(res.data)) {
      if (metadata) {
        metadataStore.cacheMetadata(metadata)
      }
    }
  } finally {
    metadataStore.loadingMetadata = false
  }
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


async function getMe() {
  const url = `${API_BASE}api/me/`;
  const res = await fetch(url, {
    credentials: "include",
  })
  if (res.ok) {
    const data = await res.json()
    console.log("Logged in as", data.username)
  } else {
    console.log("Not logged in")
  }
}


async function logout() {
  const url = `${API_BASE}api/logout/`;
  await fetch("http://localhost:8000/api/logout/", {
    credentials: "include",
  })
}
