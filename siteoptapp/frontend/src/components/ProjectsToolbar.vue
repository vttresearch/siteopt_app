<script setup>
import { ref } from 'vue';
import BaseButton from "@/components/ui/BaseButton.vue";
import Spinner from "@/components/Spinner.vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useTaskStore } from "@/stores/taskstore.js";
import { useMetadataStore } from "@/stores/metadatastore.js";
import { fetchSettings, postData, fetchInputFiles, fetchScenarios, fetchMetadataBulk } from "@/utils/functions.js";
import AskProjectNamePrompt from "@/components/AskProjectNamePrompt.vue";
import { useConfirmPrompt } from "@/composables/useConfirmPrompt.js";

const settingStore = useSettingStore()
const notify = useNotificationStore()
const dataStore = useTableDataStore()
const taskStore = useTaskStore()
const metadataStore = useMetadataStore()
const restoreOpen = ref(false)
const restoring = ref(false)
const restoreCandidates = ref(null)
const showMakeProjectPrompt = ref(false)
const { confirm } = useConfirmPrompt()
const projectToDelete = ref({})

/* Returns a boolean value whether the project tabs are disabled or not. */
function checkIfDisabled(itemName) {
  return settingStore.executionInProgress && itemName !== settingStore.activeProjectName
}

/* Returns a tooltip for project tabs */
function projectTabTitle(itemName) {
  if (checkIfDisabled(itemName)) {
    return "Disabled until execution has finished"
  }
  if (itemName === settingStore.activeProjectName) {
    const md = metadataStore.metadataByName[itemName]
    if (md) {
      // console.log(metadataStore.metadataByName[itemName])
      return "model: " + md.model + "\nsiteopt_toolbox: " + md.siteopt_toolbox + "\nsiteopt_data: " + md.siteopt_data
    }
  }
  return `Switch to project ${itemName}`
}

function projectCloseTabTitle(itemName){
  if (itemName === settingStore.activeProjectName && settingStore.executionInProgress) {
    return "Disabled until execution has finished"
  }
  return "Remove tab from view"
}

function validFolderName(name) {
  const folderNameRegex = /^(\/?[a-z0-9A-Z\-]+)+$/  // No special characters allowed
  return folderNameRegex.test(name);
}

async function workFolderNameTaken(name) {
  let allWorkFolderNames = []
  let retval = false
  const response = await postData("list_existing_work_folders", {}, notify)
  if (!response.success) {
    notify.show("Something's wrong. list_existing_work_folders doesn't work.", 5000, "error")
    console.error("list_existing_work_folders failed")
    return true
  }
  let hiddenWorkFolders = response.data ?? []
  if (hiddenWorkFolders.length > 0) {
    for (let hiddenWorkFolder of hiddenWorkFolders) {
      allWorkFolderNames.push(hiddenWorkFolder.name)
    }
  }
  if (settingStore.workFolders.length > 0) {
    for (let shownWorkFolderName of settingStore.workFolders) {
      allWorkFolderNames.push(shownWorkFolderName.name)
    }
  }
  for (let workFolderName of allWorkFolderNames) {
    if (name.toLowerCase() === workFolderName.toLowerCase()) {
      retval = true
    }
  }
  return retval
}

async function confirmMakeProject() {
  await dataStore.askSaveChanges(notify)
  showMakeProjectPrompt.value=true
}

async function makeProject(data) {
  showMakeProjectPrompt.value = false
  restoreOpen.value = false
  let name = data.name.trim()
  if (!await validateWorkFolderName(name)) return
  settingStore.creatingProjectFolder = true
  if (data.projectType === "dokken") {
    await postMakeWorkFolder("dokken", name)
  }
  else if (data.projectType === "dokken_light") {
    await postMakeWorkFolder("dokken_light", name)
  }
  else if (data.projectType === "example") {
    await postMakeWorkFolder("example", name)
  }
  else {
    notify.show(`Unknown project type ${data.projectType}`, 5000, "info")
    return
  }
  // Activate the last tab
  taskStore.clearAll()
  settingStore.setActiveProject(settingStore.workFolders.length -1)
  await fetchMetadataBulk(settingStore.workFolders.map(project => project.path))
}

function cancelMakeProject() {
  showMakeProjectPrompt.value = false
}

async function validateWorkFolderName(name) {
  if (name === "") {
    return false  // Clicked Ok with no name given
  }
  if (await workFolderNameTaken(name)) {
    notify.show(`Project ${name} already exists`, 5000, "info")
    return false
  }
  if (!validFolderName(name)) {
    notify.show(`Project name ${name} contains invalid characters`, 5000, "error")
    return false
  }
  return true
}

async function removeProjectFromTabs(name) {
  if (!name) return
  // Disable when execution is in progress and the tab is active
  if (settingStore.executionInProgress && name === settingStore.activeProjectName) return
  restoreOpen.value = false  // Close recent projects list if open
  let changeActiveProject = settingStore.activeProjectName === name
  if (changeActiveProject) await dataStore.askSaveChanges(notify)
  await fetchMetadataBulk(settingStore.workFolders.map(project => project.path))
  const response = await postData("remove_work_folder", {"folder_name": name}, notify)
  if (response.success) {
    await fetchSettings()
    notify.show(`Project ${name} removed from view`, 2000, "info")
    if (!changeActiveProject) {
      // Don't change active project if non-active project was removed
      return
    }
    if (settingStore.workFolders.length > 0) {
      settingStore.setActiveProject(settingStore.workFolders.length - 1)
    }
    else {
      settingStore.setActiveProject(null)
      // Clear data store so that Data Editor is not filled with old data when a new project is opened
      dataStore.clear()
    }
  }
}

/* When project is switched by clicking a Tab. */
async function switchProject(i) {
  await dataStore.askSaveChanges(notify)
  taskStore.clearAll()
  settingStore.setActiveProject(i)
}

/* Opens a project from the recent projects list. */
async function restoreProject(c) {
  await dataStore.askSaveChanges(notify)
  const response = await postData("add_existing_work_folder", {"name": c.name, "path": c.path}, notify)
  if (response.success) {
    taskStore.clearAll()
    restoreOpen.value = false
    await fetchSettings()
    const index = settingStore.workFolders.length -1
    settingStore.setActiveProject(index >= 0 ? index : null)
    await fetchInputFiles(settingStore.activeProjectName)
    await fetchScenarios(settingStore.activeProjectPath)
    notify.show(`Project ${c.name} restored`, 2000, "info")
  }
}

async function confirmDeleteProject(c) {
  const ok = await confirm({
    title: `Delete Project ${c.name}?`,
    message: `Are you sure you want to delete all files related to project ${c.name}?` +
        " This operation cannot be undone.",
    confirmText: "Delete",
    cancelText: "Cancel",
    variant: "danger",
  })
  if (ok) {
    projectToDelete.value = c
    await deleteProject()
  }
}

async function deleteProject() {
  const response = await postData(
      "delete_project",
      {"name": projectToDelete.value.name, "path": projectToDelete.value.path},
      notify
  )
  if (response.success) {
    // Remove entry from restoreCandidates.value
    restoreCandidates.value = restoreCandidates.value.filter(item => item.name !== projectToDelete.value.name)
    notify.show(`Project ${projectToDelete.value.name} has been removed`)
  }
  projectToDelete.value = {}
}

async function openRestoreMenu() {
  if (restoreOpen.value) {
    // Make same button close the menu if it's open
    restoreOpen.value = false
    return
  }
  restoring.value = true
  const response = await postData("list_existing_work_folders", {}, notify)
  restoring.value = false
  if (response.success) {
    restoreCandidates.value = response.data ?? []
    restoreOpen.value = true
  }
}

async function postMakeWorkFolder(projectType, projectName) {
  const response = await postData("make_work_folder", {[projectType]: projectName}, notify)
  if (!response.success) {
    settingStore.creatingProjectFolder = false
    return
  }
  await fetchSettings();
  const index = Object.keys(settingStore.workFolders).indexOf(projectName);
  settingStore.setActiveProject(index >= 0 ? index : 0)
  await fetchInputFiles(settingStore.activeProjectName)
  settingStore.creatingProjectFolder = false
  // Fetch scenarios even though there aren't any in new projects but maybe there will be in the future
  await fetchScenarios(settingStore.activeProjectPath)
  notify.show(`New project ${projectName} created`, 2000, "info")
}

/* Shows icons only for the project this metadata belongs to */
const projectTypeIcon = (projectName) => {
  const metadata = metadataStore.metadataByName[projectName]
  if (!metadata?.model) return null
  switch (metadata.model) {
    case 'dokken':
      return 'fa-brands fa-square-deskpro'
    case 'dokken_light':
      return 'fa-solid fa-dharmachakra'
    case 'example':
      return 'fa-solid fa-dumpster-fire'
    default:
      return null
  }
}
function copyMetadataToClipboard(itemName) {
  if (itemName === settingStore.activeProjectName) {
    const md = metadataStore.metadataByName[itemName]
    if (md) {
      const result = Object.entries(md).map(([key, value]) => `${key}: ${value}`).join('\n')
      console.log(result)
      copyToClipboard(result)
      notify.show(`${itemName} metadata copied to clipboard`, 5000, "info")
    }
  }
}
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)

  } catch (err) {
    console.error('Failed to copy', err)
  }
}
</script>

<template>
  <div v-if="!settingStore.loadingProjects">
    <div class="flex justify-between items-center">

      <div v-if="settingStore.workFolders.length" class="flex flex-wrap">
        <div v-for="(item, i) in settingStore.workFolders" :key="item.name" class="flex items-stretch">
        <button
            type="button"
            :disabled="checkIfDisabled(item.name)"
            class="px-4 py-2 rounded-t-md font-medium transition-colors"
            :class="item.name === settingStore.activeProjectName ? 'bg-white text-blue-600 border border-b-0 border-gray-300 -mb-px' : checkIfDisabled(item.name) ? 'bg-gray-200 text-gray-400': 'text-gray-600 hover:bg-white/70 cursor-pointer'"
            :title="projectTabTitle(item.name)"
            @click="switchProject(i)"
            @contextmenu.prevent="copyMetadataToClipboard(item.name)">
          <span v-if="projectTypeIcon(item.name)" class="pr-2">
            <i :class="projectTypeIcon(item.name)"></i>
          </span>
          {{ item.name }}
          <span
              class="cursor-pointer rounded-md ml-3 p-1"
              :class="item.name === settingStore.activeProjectName ? 'text-red-600 hover:bg-gray-200' : 'text-gray-400 hover:bg-gray-200'"
              :title="projectCloseTabTitle(item.name)"
              @click.stop="removeProjectFromTabs(item.name)">
            ✕
          </span>
        </button>
        </div>
      </div>
      <!-- Placeholder for project tabs so toolbar buttons stay in place -->
      <div v-else>
        <span></span>
      </div>

      <div class="flex items-center gap-1">
      <button
          class="flex items-center gap-1 justify-center text-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-md disabled:opacity-50 px-2 py-2 cursor-pointer"
          type="button"
          :disabled="settingStore.creatingProjectFolder || settingStore.executionInProgress"
          @click="confirmMakeProject">
        <i v-if="settingStore.creatingProjectFolder" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-square-plus"></i>
        <span>New project</span>
      </button>
      <button
          class="flex items-center gap-1 justify-center text-white rounded-md disabled:opacity-50 px-2 py-3 cursor-pointer"
          type="button"
          :disabled="settingStore.creatingProjectFolder || restoring || settingStore.executionInProgress"
          title="Recent projects"
          @click="openRestoreMenu"
          :class="restoreOpen ? 'bg-gray-500 hover:bg-gray-700' : 'bg-blue-500 hover:bg-blue-700 shadow-lg'">
        <i class="fa-solid fa-bars"></i>
      </button>
    </div>
    </div>

    <div class="relative">
      <div v-if="restoreOpen" class="absolute top-0 left-0 w-full z-50 border border-gray-300 rounded p-3 bg-gray-50 shadow-xl">
        <div class="flex items-center justify-between mb-2">
          <div class="font-semibold text-gray-800">Restore project</div>
          <BaseButton variant="ghost" @click="restoreOpen = false">Close</BaseButton>
        </div>

        <div v-if="restoreCandidates.length === 0" class="text-sm text-gray-600">
          No hidden projects found.
        </div>
        <div v-else class="space-y-2">
          <div v-for="c in restoreCandidates"
               :key="c.path"
               class="w-full px-3 py-2 flex justify-between bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-blue-500"
               >
            <div>
              <div class="font-medium text-left">{{ c.name }}</div>
              <div class="text-xs text-gray-500 truncate">{{ c.path }}</div>
            </div>
            <div class="flex items-center gap-4">
              <button
                  class="px-1 py-1 text-white rounded border border-b-0 border-gray-400 bg-blue-500 hover:bg-blue-700"
                  :title="`Restore ${c.name}`"
                  @click="restoreProject(c)">
                <i class="fa-regular fa-folder-open"></i>
              </button>
              <button
                  class="px-1 py-1 text-white rounded border border-b-0 border-gray-400 bg-red-500 hover:bg-red-700"
                  :title="`Delete ${c.name}`"
                  @click="confirmDeleteProject(c)">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
  <div v-else>
    <Spinner message="Loading..." class="col-span-1 md:col-span-3" />
  </div>

  <AskProjectNamePrompt
      :visible="showMakeProjectPrompt"
      title="Create Project"
      message="Project name"
      placeholderText="Enter project name…"
      @confirm="makeProject"
      @cancel="cancelMakeProject"
  />
</template>
