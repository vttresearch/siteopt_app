<script setup>
import { ref } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { fetchSettings, fetchWorkFolderFiles, postData } from "@/utils/functions.js";
import BaseButton from "@/components/ui/BaseButton.vue";
import Spinner from "@/components/Spinner.vue";
import AskNamePrompt from "@/components/AskNamePrompt.vue";


const notify = useNotificationStore()
const settingStore = useSettingStore()
const isValidWorkFolderName = ref(false)
const creating = ref(false)
const creatingWork = ref(false)
const creatingTest = ref(false)
const restoring = ref(false)
const restoreOpen = ref(false)
const restoreCandidates = ref([])
const showMakeProjectPrompt = ref(false)
const showMakeExampleProjectPrompt = ref(false)
const showMakeTestProjectPrompt = ref(false)

function validFolderName(name) {
  const folderNameRegex = /^(\/?[a-z0-9A-Z\-]+)+$/  // No special characters allowed
  return folderNameRegex.test(name);
}

function workFolderNameTaken(name) {
  const wf = settingStore.workFolders ?? {}
  return Object.prototype.hasOwnProperty.call(wf, name)
}

function cancelMakeProject() {
  showMakeProjectPrompt.value = false
  showMakeExampleProjectPrompt.value = false
  showMakeTestProjectPrompt.value = false
}

function confirmMakeProject(n) {
  showMakeProjectPrompt.value = false
  let name = n.trim()
  if (!validateWorkFolderName(name)) return
  settingStore.creatingProjectFolder = true
  postMakeWorkFolder("work_folder", name)
}

function confirmMakeProjectWithExampleData(n) {
  showMakeExampleProjectPrompt.value = false
  let name = n.trim()
  if (!validateWorkFolderName(name)) return
  settingStore.creatingProjectFolderWithExampleData = true
  postMakeWorkFolder("work_folder_with_example_data", name)
}

function confirmMakeTestProject(n) {
  showMakeTestProjectPrompt.value = false
  let name = n.trim()
  if (!validateWorkFolderName(name)) return
  settingStore.creatingTestProjectFolder = true
  postMakeWorkFolder("test_work_folder", name)
}

function validateWorkFolderName(name) {
  if (name === "") {
    // notify.show("Please enter project name (e.g. work1)", 5000, "info")
    return false  // Clicked Ok with no name given
  }
  if (workFolderNameTaken(name)) {
    notify.show(`Project ${name} already exists`, 1000, "info")
    return false
  }
  if (!validFolderName(name)) {
    notify.show(`Project name ${name} contains invalid characters`, 5000, "error")
    return false
  }
  return true
}

async function postMakeWorkFolder(pathKey, projectName) {
  creating.value = true
  const response = await postData("make_work_folder", {[pathKey]: projectName}, notify)
  if (!response.success) {
    clearCreating()
    return
  }
  await fetchSettings();
  // await fetchWorkFolderFiles();
  notify.show(`New project ${projectName} created`, 2000, "info")
  const index = Object.keys(settingStore.workFolders).indexOf(projectName);
  settingStore.setActiveProjectIndex(index >= 0 ? index : 0)
  clearCreating()
}

function clearCreating() {
  creating.value = false
  settingStore.creatingProjectFolder = false
  settingStore.creatingProjectFolderWithExampleData = false
  settingStore.creatingTestProjectFolder = false
}



</script>

<template>
  <div class="mb-3 text-lg font-semibold text-gray-800">Projects</div>
  <div class="flex flex-wrap items-center gap-2">
    <button
        class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
        type="button"
        :disabled="creating"
        @click="showMakeProjectPrompt=true">
      <i v-if="settingStore.creatingProjectFolder" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
      <i v-else class="fa-solid fa-square-plus"></i>
      <span>Create project</span>
    </button>
    <button
        class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
        type="button"
        :disabled="creating"
        @click="showMakeExampleProjectPrompt=true">
      <i v-if="settingStore.creatingProjectFolderWithExampleData" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
      <i v-else class="fa-solid fa-square-plus"></i>
      <span>Create project (example data)</span>
    </button>
    <button
        class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
        type="button"
        :disabled="creating"
        @click="showMakeTestProjectPrompt=true">
      <i v-if="settingStore.creatingTestProjectFolder" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
      <i v-else class="fa-solid fa-square-plus"></i>
      <span>Create test project</span>
    </button>
    <button
        class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
        type="button"
        :disabled="creating || restoring"
        @click="openRestore">
      <i class="fa-solid fa-folder-open"></i>
      <span>{{ restoring ? "Checking..." : "Open existing project" }}</span>
    </button>
  </div>


  <AskNamePrompt
      :visible="showMakeProjectPrompt"
      title="Create SiteOpt Project"
      message="Project name"
      placeholderText="Enter project name…"
      @confirm="confirmMakeProject"
      @cancel="cancelMakeProject"
  />
  <AskNamePrompt
      :visible="showMakeExampleProjectPrompt"
      title="Create SiteOpt Project using Example Data"
      message="Project name"
      placeholderText="Enter project name…"
      @confirm="confirmMakeProjectWithExampleData"
      @cancel="cancelMakeProject"
  />
  <AskNamePrompt
      :visible="showMakeTestProjectPrompt"
      title="Create Test Project"
      message="Project name"
      placeholderText="Enter project name…"
      @confirm="confirmMakeTestProject"
      @cancel="cancelMakeProject"
  />

</template>
