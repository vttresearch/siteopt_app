import { useNotificationStore } from '@/stores/notificationstore.js'
import { useSettingStore } from "@/stores/settingstore.js";
import { buildApiUrl } from "@/utils/apiUrl.js";


export const fetchSettings = async () => {
  const notify = useNotificationStore()
  const settingStore = useSettingStore()
  const url = buildApiUrl('api/settings/')
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    })
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Server ${url} error. status: [${response.status}] error: ${errorText}`)
      notify.show(`Server ${url} responded with error: ${errorText}`, 5000, "error")
      return {success: false}
    }
    console.log("parsing settings")
    const parsed = await response.json();
    settingStore.setSettings(parsed["configs"])
    console.log("new settings Stored")
    return {success: true}
  }
  catch (err) {
    console.error(`[${url} Error in fetching Settings: ${err}`)
    notify.show(`[${url}] error: [${err}]`, "5000", "error")
    return {success: false}
  }
};

export function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    console.log(cookies)
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
