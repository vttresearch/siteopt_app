<script setup>
import { ref, onMounted, watch } from 'vue';
import FileTree from '@/components/FileTree.vue';
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import Notification from "@/components/Notification.vue";
import Table from "@/components/Table.vue";
import { API_BASE } from "@/config.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { fetchSettings } from "@/utils/functions.js";
import SelectFolder from "@/components/SelectFolder.vue";


const inputFiles = ref([]);
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
  const checkBackEndReady = async () => {
    let attempts = 0
    const maxAttempts = 10
    const url = `${API_BASE}api/health/`
    while (attempts < maxAttempts) {
      try {
        const res = await fetchWithTimeout(url, 4000)
        if (res.ok) {
          const result = await fetchSettings()
          if (result.success) {
            backendUnavailable.value = false
          }
          return
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
    loading.value = false
  }
  checkBackEndReady()
})

watch(() => settingStore.inputDataPath, (newInputDataPath) => {
  loading.value = true;
  console.log(`inputDataPath changed: ${newInputDataPath}`)
  fetchInputFiles();
  loading.value = false;
});

const fetchInputFiles = async () => {
  const url = `${API_BASE}api/fetch_input_file_tree/`
  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Server ${url} error. status: [${response.status}] error: ${errorText}`)
      notify.show(`Server ${url} responded with error: ${errorText}`, 10000, "error")
      return
    }
    const r = await response.json();
    if (!r.success) {
        inputFiles.value = {}
      if (settingStore.inputDataPath === "") {
        return
      }
    }
    inputFiles.value = r.data.children;
    for (const [keys, values] in Object.entries(r.data)) {
      console.log(`${keys}: ${values}`)
    }

    console.log(`r.data: ${r.data} type: ${typeof r.data}`)
    console.log(`r.data.children: ${r.data.children} type: ${typeof r.data.children}`)
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
            <div class="col-span-1 bg-white rounded-xl shadow-md relative p-2 text-xs">
              <SelectFolder class="mb-4"/>
              <FileTree :model="inputFiles" />
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
