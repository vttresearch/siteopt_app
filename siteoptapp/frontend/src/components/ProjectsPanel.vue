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
  await fetchWorkFolderFiles();
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

async function openRestore() {
  restoring.value = true
  const response = await postData("list_existing_work_folders", {}, notify)
  restoring.value = false
  if (response.success) {
    restoreCandidates.value = response.data ?? []
    restoreOpen.value = true
  }
}

async function removeProject(name) {
  if (!name) return
  const ok = confirm(`Remove "${name}" from view? Files stay on disk.`)
  if (!ok) return

  const response = await postData("remove_work_folder", {"folder_name": name}, notify)
  if (response.success) {
    await fetchSettings()
    await fetchWorkFolderFiles()
    notify.show("Removed from view", 2000, "info")
  }
}

async function restoreProject(c) {
  const response = await postData("add_existing_work_folder", {"name": c.name, "path": c.path}, notify)
  if (response.success) {
    restoreOpen.value = false
    await fetchSettings()
    await fetchWorkFolderFiles()
    notify.show("Project restored", 2000, "info")
  }
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

  <!-- Tabs row -->
  <div v-if="!settingStore.loadingProjects" class="my-3">
    <div v-if="Array.isArray(settingStore.workFolderFiles) && settingStore.workFolderFiles.length" class="flex flex-wrap gap-2">
      <div v-for="(tree, i) in settingStore.workFolderFiles" :key="tree?.name ?? i" class="flex items-stretch">
      <BaseButton
        variant="secondary"
        class="relative pr-8"
        :class="i === settingStore.activeProjectIndex && 'ring-2 ring-blue-500'"
        @click="settingStore.setActiveProjectIndex(i)"
      >
        {{ tree?.name ?? `Project ${i + 1}` }}
        <span
          class="absolute right-2 top-1/2 -translate-y-1/2
                text-red-600 hover:text-red-800 cursor-pointer"
          title="Remove from view"
          @click.stop="removeProject(tree?.name)"
        >
          ✕
        </span>
      </BaseButton>
      </div>
    </div>
    <div v-if="restoreOpen" class="mb-3 border border-gray-300 rounded p-3 bg-gray-50">
      <div class="flex items-center justify-between mb-2">
        <div class="font-semibold text-gray-800">Restore project</div>
        <BaseButton variant="ghost" @click="restoreOpen = false">Close</BaseButton>
      </div>

      <div v-if="restoreCandidates.length === 0" class="text-sm text-gray-600">
        No hidden projects found.
      </div>
      <div v-else class="space-y-2">
        <BaseButton
            v-for="c in restoreCandidates"
            :key="c.path"
            variant="secondary"
            class="w-full justify-start text-left"
            @click="restoreProject(c)"
        >
          <div class="w-full">
            <div class="font-medium">{{ c.name }}</div>
            <div class="text-xs text-gray-500 truncate">{{ c.path }}</div>
          </div>
        </BaseButton>
      </div>
    </div>
  </div>
  <div v-else>
    <Spinner message="Loading..." class="col-span-1 md:col-span-3" />
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
