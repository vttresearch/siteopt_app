<script setup>
import { ref, onMounted, watch } from 'vue';
import FileTree from '@/components/FileTree.vue';
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import Notification from "@/components/Notification.vue";
import DataViewer from "@/components/DataViewer.vue";
import { buildApiUrl } from "@/utils/apiUrl.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { fetchSettings } from "@/utils/functions.js";


const inputFiles = ref([]);
const inputDataTitle = ref('');
const loading = ref(true);
const backendUnavailable = ref(true);
const settingStore = useSettingStore()
const notify = useNotificationStore()
const tableDataStore = useTableDataStore()
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
    const url = buildApiUrl('api/health/')
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
  const url = buildApiUrl('api/fetch_input_data/')
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
        inputDataTitle.value = ""
        inputFiles.value = {}
      if (settingStore.inputDataPath === "") {
        return
      }
    }
    inputDataTitle.value = r.title;
    inputFiles.value = r.children;
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
              <FileTree class="col-span-1" :title="inputDataTitle" :model="inputFiles" @refresh="fetchInputFiles" />
            </div>
              <div class="col-span-2">
                <!-- Loading state for file data -->
                <div v-if="tableDataStore.loading" class="bg-white rounded-xl shadow-md">
                  <div class="p-4">
                    <div class="text-gray-600 text-base my-2 text-center py-12">
                      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
                      <div>Loading file data...</div>
                      <div class="text-sm text-gray-400 mt-2">{{ tableDataStore.fname || 'Processing file' }}</div>
                    </div>
                  </div>
                </div>
                <!-- File data display -->
                <div v-else-if="tableDataStore.daata && Object.keys(tableDataStore.daata).length > 0" class="bg-white rounded-xl shadow-md">
                  <div class="p-4">
                    <DataViewer 
                      :data="tableDataStore.daata" 
                      :fileName="tableDataStore.fname"
                    />
                  </div>
                </div>
                <!-- Empty state -->
                <div v-else class="bg-white rounded-xl shadow-md">
                  <div class="p-4">
                    <div class="text-gray-400 text-base my-2 text-center py-12">
                      <font-awesome-icon icon="fa-regular fa-file" class="text-4xl text-gray-400 mb-4" />
                      <div>Select a file from the tree to view data and charts</div>
                    </div>
                  </div>
                </div>
              </div>
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
