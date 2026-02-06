import { useNotificationStore } from '@/stores/notificationstore.js'
import { useSettingStore } from "@/stores/settingstore.js";
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


export const fetchSettings = async () => {
  const settingStore = useSettingStore()
  const url = `${API_BASE}api/settings/`
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    })
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Server ${url} error. status: [${response.status}] error: ${errorText}`)
      return false
    }
    const parsed = await response.json();
    settingStore.setSettings(parsed["configs"])
    console.log("Settings updated")
    return true
  }
  catch (err) {
    console.error(`[${url} Error in fetching Settings: ${err}`)
    return false
  }
};


/**
 * Fetches a file tree from the specified API endpoint and updates the given reactive reference.
 *
 * @param {string} endpoint - The API endpoint suffix (e.g., "fetch_input_file_tree").
 * @param {Object} notify - A notification utility with a `show(message, duration, type)` method for displaying errors.
 *
 * The function handles:
 * - Making a GET request to the API.
 * - Error handling for network and server issues.
 * - Updating the target ref with the file tree data if successful.
 * - Displaying notifications for errors or unsuccessful responses.
 */
export const fetchFileTree = async (endpoint, notify) => {
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
    const r = await response.json();
    if (!r.success) {
      return {}
    }
    return r.data
  } catch (err) {
    notify.show(`[${err}] in fetching url: ${url}`, "5000", "error");
    console.error(`Error fetching from ${url}:`, err);
  }
};


export async function fetchWorkFolderFiles() {
  const settingStore = useSettingStore()
  const notify = useNotificationStore()
  if (Object.keys(settingStore.workFolders).length === 0) {
    settingStore.setWorkFolderFiles([])
    settingStore.setActiveProjectIndex(0)
    settingStore.loadingProjects = false
    return
  }
  let files = await fetchFileTree("fetch_work_folders_tree", notify)
  settingStore.setWorkFolderFiles(files)

  if (settingStore.activeProjectIndex >= settingStore.workFolderFiles.length) {
    settingStore.activeProjectIndex = Math.max(0, settingStore.workFolderFiles.length - 1)
  }
  settingStore.loadingProjects = false
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
 *  Ensures that fetch fails exactly in given timeout
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
