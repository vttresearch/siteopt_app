<script setup>
import { ref, onMounted, watch } from 'vue';
import FileTree from '@/components/FileTree.vue';
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import Notification from "@/components/Notification.vue";
import Table from "@/components/Table.vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { checkBackendReady, fetchSettings, fetchFileTree, postNewPath } from "@/utils/functions.js";
import SelectInputFolder from "@/components/SelectInputFolder.vue";
import SelectProjectFolder from "@/components/SelectProjectFolder.vue";


const inputFiles = ref({});
const projectFiles = ref([]);
const loading = ref(true);
const backendUnavailable = ref(true);
const settingStore = useSettingStore()
const notify = useNotificationStore()
const settingsReceived = ref(false)

onMounted(async () => {
  const ready = await checkBackendReady()
  if (ready) {
    await fetchSettings()
    backendUnavailable.value = false
    loading.value = false
  }
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
