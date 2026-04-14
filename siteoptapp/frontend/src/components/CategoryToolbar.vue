<script setup>
import { ref, watch, computed } from "vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { fetchInputFiles, fetchFileContents } from "@/utils/functions.js";
import ConfirmPrompt from "@/components/ConfirmPrompt.vue";

const settingStore = useSettingStore()
const dataStore = useTableDataStore()
const notify = useNotificationStore()
const selected = ref(null);
const openCategory = ref(null);
const activeFilePath = ref("")
const confirmSave = ref(false)
const confirmSaveMessage = ref("")
const returnFocusEl = ref(null)
let confirmResolver = null

const currentInputFilePath = computed(() => {
  if (!activeFilePath.value) {
    return settingStore.activeProjectPath
  }
  else {
    return activeFilePath
  }
})

/* Fetches the contents of selected projects current input files */
watch(() => settingStore.activeProjectIndex, async (newIndex, oldIndex) => {
  if (newIndex !== oldIndex) {
    activeFilePath.value = ""
    await fetchInputFiles(settingStore.activeProjectName)
  }
})

/* Opens or closes categories */
function toggle(categoryName) {
  openCategory.value =
    openCategory.value === categoryName ? null : categoryName;
}

/* Downloads the selected file and updates data store. */
async function select(value) {
  selected.value = value;
  if (!settingStore.activeProjectPath) {
    notify.show("Project path is not initialized. Please refresh the page.", 5000, "error")
    return
  }
  let fpath = settingStore.activeProjectPath + "/" + "current_input" + "/"
  if (openCategory.value === "") {
    fpath = fpath + selected.value
  }
  else {
    fpath = fpath + openCategory.value + "/" + selected.value
  }
  openCategory.value = null;
  activeFilePath.value = fpath
  await fetchFileContents(selected.value, fpath)
}

async function onConfirmSave() {
  confirmSave.value = false
  confirmResolver?.("save")
}

function onConfirmDiscard() {
  confirmSave.value = false
  confirmResolver?.("discard")
}

function askSaveConfirmation(triggerEl) {
  confirmSaveMessage.value = `File ${dataStore.fname} has unsaved changes. ` +
      `Would you like to save or discard the changes?`
  returnFocusEl.value = triggerEl
  confirmSave.value = true
  return new Promise(resolve => {
    confirmResolver = resolve
  })
}

/* Asks confirmation to save current file it there are changes, downloads a new file and updates data store. */
async function confirmAndLoadFile(value, elTrigger) {
  selected.value = value
  const category = openCategory.value  // Save open category because the confirmation prompt closes it
  if (!settingStore.activeProjectPath) {
    notify.show("Project path is not initialized. Please refresh the page.", 5000, "error")
    return
  }
  if (dataStore.globalDirty) {
    const choice = await askSaveConfirmation(elTrigger)
    if (choice === "discard") {
      await downloadFile(category)
      return
    }
    if (choice === "save") {
      await saveAndDownloadFile(category)
      return
    }
  }
  await downloadFile(category)
}

async function saveAndDownloadFile(category) {
  await dataStore.saveCurrentFile({ notify })
  await downloadFile(category)
}

async function downloadFile(category) {
  let fpath = settingStore.activeProjectPath + "/" + "current_input" + "/"
  if (category === "") {
    fpath = fpath + selected.value
  }
  else {
    fpath = fpath + category + "/" + selected.value
  }
  openCategory.value = null;
  activeFilePath.value = fpath
  await fetchFileContents(selected.value, fpath)
}

</script>

<template>
  <p class="text-xs text-gray-500 rounded-md p-2 mb-1 bg-gray-100">{{ currentInputFilePath }}</p>

  <div class="flex gap-4 p-3 bg-gray-100 rounded-md relative">
    <!-- CATEGORIES -->
    <div
      v-for="category in settingStore.currentInputFiles"
      :key="category.name"
      class="relative"
    >
      <button
        @click="toggle(category.value)"
        class="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm
               hover:bg-gray-50 text-sm font-medium cursor-pointer"
      >
        {{ category.name }}
      </button>

      <!-- OPTIONS DROPDOWN -->
      <div
        v-if="openCategory === category.value"
        class="absolute left-0 mt-2 w-60 bg-white border border-gray-200
               rounded-md shadow-lg z-50"
      >
        <button
          v-for="opt in category.options"
          :key="opt.value"
          @click="confirmAndLoadFile(opt.value, $event.currentTarget)"
          class="block w-full text-left px-3 py-2 text-sm
                hover:bg-gray-100 border-b last:border-0
                data-[active=true]:bg-blue-600
                data-[active=true]:text-white"
          :data-active="selected === opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>

  <ConfirmPrompt
    v-model="confirmSave"
    :title="'Save changes?'"
    :message="confirmSaveMessage"
    :confirmText="`Save`"
    :cancelText="'Discard'"
    :returnFocusEl="returnFocusEl"
    @confirm="onConfirmSave"
    @cancel="onConfirmDiscard"
  />

</template>
