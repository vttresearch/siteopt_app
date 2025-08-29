<script setup>
import { ref, onMounted, watch } from 'vue';
import FileTree from '@/components/FileTree.vue';
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import Notification from "@/components/Notification.vue";
import { API_BASE } from "@/config.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import Table from "@/components/Table.vue";


const input_data = ref([]);
const input_data_title = ref('');
const inputDataPath = ref("")
const loading = ref(true);
const backendUnavailable = ref(true);
const settingStore = useSettingStore()
const notify = useNotificationStore()
const settingsReceived = ref(false)


onMounted(() => {
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
      const response = await fetch(url, { signal: controller.signal })
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
  const checkBackEndReady = async () => {
    let attempts = 0
    const maxAttempts = 10
    const url = `${API_BASE}api/health/`
    while (attempts < maxAttempts) {
      try {
        const res = await fetchWithTimeout(url, 4000)
        if (res.ok) {
          await fetch_settings()
          return
        }
      } catch (err) {
        console.log(`Backend not responding (attempt ${attempts + 1})`)
        notify.show(`URL: ${url} not responding [attempt ${attempts + 1}/${maxAttempts}]`, 4000, "info")
      }
      attempts++
      // This is like python's time.sleep()
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1s before retrying
    }
    console.error("Backend did not start in time")
    loading.value = false
  }
  checkBackEndReady()
})

const fetch_settings = async () => {
  try {
    const url = `${API_BASE}api/settings/`
    const response = await fetch(url)
    if (!response.ok) {
      notify.show(`Fetching settings from ${url} failed. status: [${response.status}]`, 5000, "error")
      throw new Error("Fetching settings failed");
    }
    const r = await response.text();
    const parsed = JSON.parse(r)
    settingStore.setSettings(JSON.parse(r))
    inputDataPath.value = parsed["input_data_path"]
    console.log(`Settings fetched ${inputDataPath.value}`)
    backendUnavailable.value = false
  }
  catch (err) {
    notify.show(`[${err}] in fetching url: ${url}`, "5000", "error")
    console.error("Error in fetching Settings")
  }
};

watch(() => inputDataPath.value, (newInputDataPath) => {
  loading.value = true;
  console.log(`watching settingStore: ${newInputDataPath}`)
  fetch_input_files();
  loading.value = false;
});

const fetch_input_files = async () => {
  try {
    const url = `${API_BASE}api/fetch_input_data/`
    const response = await fetch(url);
    if (!response.ok) {
      notify.show(`Fetching input files from ${url} failed. status: [${response.status}]`, 5000, "error")
      throw new Error("Fetching input files failed");
    }
    const text = await response.text();
    const data = JSON.parse(text);
    input_data_title.value = data.title;
    input_data.value = data.children;
  } catch (err) {
    notify.show(`[${err}] in fetching url: ${url}`, "5000", "error")
    console.error("Error fetching input files:", err);
  }
};

</script>

<template>
  <section class="bg-blue-50 px-4 py-10">
    <div class="container-xl lg:container m-auto">
      <Notification />
      <h1 class="text-3xl text-blue-500 mb-6">Welcome to SiteOptApp</h1>
      <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Spinner v-if="loading" message="Loading..." class="col-span-1 md:col-span-3" />
          <template v-else>
            <template v-if="!backendUnavailable">
            <div>
              <FileTree class="col-span-1" :title="input_data_title" :model="input_data" :inputPath="inputDataPath" />
            </div>
              <ContentPanel class="col-span-2" :content="Table" />
            </template>
            <template v-else>
              <ContentPanel class="col-span-1" />
            </template>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
