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
import {fetchSettings, fetchFileTree, postNewPath} from "@/utils/functions.js";
import SelectInputFolder from "@/components/SelectInputFolder.vue";
import SelectProjectFolder from "@/components/SelectProjectFolder.vue";


const inputFiles = ref({});
const projectFiles = ref([]);
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

watch(() => [settingStore.inputDataPath, settingStore.projectPath], ([newInputDataPath, newProjectPath], [prevInputDataPath, prevProjectPath]) => {
  if (newInputDataPath !== prevInputDataPath) {
    loading.value = true;
    console.log(`inputDataPath changed: ${newInputDataPath}`)
    fetchInputFiles();
    loading.value = false;
  }
  if (newProjectPath !== prevProjectPath) {
    loading.value = true;
    console.log(`projectPath changed: ${newProjectPath}`)
    fetchProjectFiles();
    loading.value = false;
  }
});

const fetchInputFiles = async () => {
  if (settingStore.inputDataPath === "") {
    /* Clear button clicked */
    inputFiles.value = {}
    return
  }
  return fetchFileTree("fetch_input_file_tree", inputFiles, settingStore.inputDataPath, notify)
};

const fetchProjectFiles = async () => {
  if (settingStore.projectPath === "") {
    /* Clear button clicked */
    projectFiles.value = {}
    return
  }
  return fetchFileTree("fetch_project_file_tree", projectFiles, settingStore.projectPath, notify)
};

function makeWorkFolder() {
  /* TODO: Get current work folders and add a new one to the list */
  const path = "work2"
  return postNewPath("make_work_folder", "work_folder", path, settingStore.addWorkFolder, notify)
}

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
              <h1 class="text-black text-base mb-2 font-bold">Input data files</h1>
              <SelectInputFolder class="mb-1"/>
              <FileTree class="bg-gray-100 rounded-xl shadow-md relative p-2" :model="inputFiles" />
              <hr class="mt-3">
              <h1 class="text-black text-base mb-2 font-bold">Project files</h1>
              <SelectProjectFolder class="mb-1"/>
              <FileTree class="bg-gray-100 rounded-xl shadow-md relative p-2" :model="projectFiles" />
              <hr class="mt-3">
              <h1 class="text-black text-base mb-2 font-bold">Work folders</h1>
              <button
                  class="flex-nowrap whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-0.5"
                  @click="makeWorkFolder">Make work folder
              </button>
              <hr class="mt-3">
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
