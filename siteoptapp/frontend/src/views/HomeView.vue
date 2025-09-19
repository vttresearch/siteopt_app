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
import InputWorkFolder from "@/components/InputWorkFolder.vue";


const inputFiles = ref({});
const projectFiles = ref([]);
const workFolderFiles = ref([]);
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

watch(() => [settingStore.inputDataPath, settingStore.projectPath, settingStore.workFolders], ([newInputDataPath, newProjectPath, newworkFolders], [prevInputDataPath, prevProjectPath, prevworkFolders]) => {
  if (newInputDataPath !== prevInputDataPath) {
    loading.value = true;
    fetchInputFiles();
    loading.value = false;
  }
  if (newProjectPath !== prevProjectPath) {
    loading.value = true;
    fetchProjectFiles();
    loading.value = false;
  }
  if (newworkFolders !== prevworkFolders) {
    loading.value = true;
    fetchWorkFolderFiles();
    loading.value = false;
  }
});

const fetchInputFiles = async () => {
  if (settingStore.inputDataPath === "") {
    /* Clear button clicked */
    inputFiles.value = {}
    return
  }
  const data = await fetchFileTree("fetch_input_file_tree", notify)
  inputFiles.value = data.children
  // settingStore.inputDataPath.value = data.children
};

const fetchProjectFiles = async () => {
  if (settingStore.projectPath === "") {
    /* Clear button clicked */
    projectFiles.value = {}
    return
  }
  const data = await fetchFileTree("fetch_project_file_tree", notify)
  projectFiles.value = data.children
  // settingStore.projectPath.value = data.children
};

const fetchWorkFolderFiles = async () => {
  if (Object.keys(settingStore.workFolders).length === 0) {
    /* Clear button clicked (Not implemented) */
    workFolderFiles.value = {}
    return
  }
  workFolderFiles.value = await fetchFileTree("fetch_work_folders_tree", notify)
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
              <h1 class="text-black text-base mb-2 font-bold">Input data files</h1>
              <SelectInputFolder class="mb-1"/>
              <FileTree class="bg-gray-100 rounded-xl shadow-md relative p-2" :model="inputFiles" :path="settingStore.inputDataPath"/>
              <hr class="mt-3">
              <h1 class="text-black text-base mb-2 font-bold">Project files</h1>
              <SelectProjectFolder class="mb-1"/>
              <FileTree class="bg-gray-100 rounded-xl shadow-md relative p-2" :model="projectFiles" :path="settingStore.projectPath"/>
              <hr class="mt-3">
              <h1 class="text-black text-base mb-2 font-bold">Work folders</h1>
              <InputWorkFolder class="mb-1" />
              <template v-for="tree in workFolderFiles">
                <div class="text-gray-600 text-base"><span>{{ tree[0].path + "\\" + tree[0].name }}</span></div>
                <FileTree class="bg-gray-100 rounded-xl shadow-md relative p-2" :model="tree" :path="tree[0].path" />
              </template>
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
