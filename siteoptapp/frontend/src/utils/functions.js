import { useNotificationStore } from '@/stores/notificationstore.js'
import { useSettingStore } from "@/stores/settingstore.js";
import {API_BASE} from "@/config.js";



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

/**
 * Retries connection to backend every 5 seconds (4000ms + 1000ms) until max attempts is reached.
 */
export const checkBackendReady = async () => {
  const notify = useNotificationStore()
  let attempts = 0
  const maxAttempts = 10
  const url = `${API_BASE}api/health/`
  while (attempts < maxAttempts) {
    try {
      const res = await fetchWithTimeout(url, 4000)
      if (res.ok) {
        return true
      }
    } catch (err) {
      console.error(`Backend not responding (attempt ${attempts + 1})`)
      notify.show(`URL: ${url} not responding [attempt ${attempts + 1}/${maxAttempts}]`, 4000, "info")
    }
    attempts++
    // This is like python's time.sleep()
    await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retrying
  }
  console.error("Backend did not start in time")
  return false
}

export const fetchSettings = async () => {
  const notify = useNotificationStore()
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
      notify.show(`Server ${url} responded with error: ${errorText}`, 5000, "error")
      return false
    }
    const parsed = await response.json();
    settingStore.setSettings(parsed["configs"])
    console.log("Settings updated")
    return true
  }
  catch (err) {
    console.error(`[${url} Error in fetching Settings: ${err}`)
    notify.show(`[${url}] error: [${err}]`, "5000", "error")
    return false
  }
};

export function getCookie(name) {
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

/**
 * Fetches a file tree from the specified API endpoint and updates the given reactive reference.
 *
 * @param {string} endpoint - The API endpoint suffix (e.g., "fetch_input_file_tree").
 * @param {object} targetRef - A Vue ref object where the fetched file tree data will be stored.
 * @param {string} fallbackPath - A fallback path used to determine whether to proceed if the response is unsuccessful.
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
      //targetRef.value = {};
      return {}
      //if (fallbackPath === "") {
      //  return;
      //}
    }
    return r.data
  } catch (err) {
    notify.show(`[${err}] in fetching url: ${url}`, "5000", "error");
    console.error(`Error fetching from ${url}:`, err);
  }
};

/**
 * Sends a POST request to update a data path (e.g., input or project path) on the server,
 * handles the response, updates local settings, and optionally fetches updated settings.
 *
 * @param {string} endpointSuffix - The endpoint suffix to post to (e.g., "input_data_path").
 * @param {string} pathKey - The key used in the request body (e.g., "input_data_path" or "project_data_path").
 * @param {string} pathValue - The new path value to send to the server.
 * @param {Object} notify - A notification utility with a `show(message, duration, type)` method for displaying errors.
 * @param {Function} clearFn - A function to clear the corresponding path in local settings if the request fails.
 * The function performs:
 * - CSRF-protected POST request to the specified endpoint.
 * - Error handling for failed requests or unsuccessful responses.
 * - Updates the local settings store if the request succeeds.
 * - Fetches updated settings from the server after a successful update.
 * - Displays error notifications using the provided `notify` utility.
 */
export async function postNewPath(endpointSuffix, pathKey, pathValue, notify, clearFn = null) {
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
      body: JSON.stringify({[pathKey]: pathValue}),
    });
    if (!response.ok) {
      console.error(`Invalid ${pathKey}:`, await response.text());
      return false
    }
    const r = await response.json();
    if (!r.success) {
      if (clearFn !== null ) {
        clearFn(""); // Clears a path in settingStore. Forgot whether it's needed
      }
      notify.show(`${r.error}`, 3000, "error");
      return false
    }
  } catch (err) {
    console.error(`Error posting ${pathKey}:`, err);
    return false
  }
  return true
}


/**
 * Sends a POST to request file data.
 *
 * @param {string} path - Full abs. path to requested file.
 * @param {string} fname - File name.
 * @param {Object} store - Pinia store for storing received data
 * @param {Object} notify - A notification utility with a `show(message, duration, type)` method for displaying errors.
 * The function performs:
 * - CSRF-protected POST request to the specified endpoint.
 * - Error handling for failed requests or unsuccessful responses.
 * - Updates the local settings store if the request succeeds.
 * - Displays error notifications using the provided `notify` utility.
 */
export async function postRequestData(path, fname, store, notify) {
  const csrfToken = getCookie("csrftoken");
  const url = `${API_BASE}api/post/fetch_data/`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({["path"]: path}),
    });
    if (!response.ok) {
      console.error(`Invalid ${path}:`, await response.text());
      return {"success": false}
    }
    const r = await response.json();
    if (!r.success) {
      notify.show(`${r.error}`, 5000, "error");
      return {"success": false}
    }
    store.addData(fname, r.data)
    return {"success": true}
  } catch (err) {
    console.error(`Error posting ${path}:`, err);
    return {"success": false}
  }
}
