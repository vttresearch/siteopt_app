<script setup>
import { ref } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { fetchSettings, postNewPath } from "@/utils/functions.js";


const notify = useNotificationStore()
const settings = useSettingStore()
const workFolderName = ref("")
const isValidWorkFolderName = ref(false)
const emit = defineEmits(["created"])
const creating = ref(false)
const creatingWork = ref(false)
const creatingTest = ref(false)

function validFolderName() {
  const folderNameRegex = /^(\/?[a-z0-9A-Z\-]+)+$/  // No special characters allowed
  return folderNameRegex.test(workFolderName.value);
}

function workFolderNameTaken() {
  const wf = settings.workFolders ?? {}
  return Object.prototype.hasOwnProperty.call(wf, workFolderName.value)
}

function postNewWorkPath() {
  if (!validateWorkFolderName()) return
  creatingWork.value = true
  makeWorkFolder("work_folder")
}

function postNewTestWorkPath() {
  if (!validateWorkFolderName()) return
  creatingTest.value = true
  makeWorkFolder("test_work_folder")
}

function validateWorkFolderName() {
  if (workFolderName.value === "") {
    notify.show("Please enter project name (e.g. work1)", 5000, "info")
    return false
  }
  if (workFolderNameTaken()) {
    notify.show("Given project name already exists", 1000, "info")
    return false
  }
  if (!validFolderName()) {
    notify.show("Given project name contains invalid characters", 5000, "error")
    return false
  }
  return true
}

async function makeWorkFolder(pathKey) {
  creating.value = true
  const postResult = await postNewPath("make_work_folder", pathKey, workFolderName.value, notify)
  if (!postResult) {
    clearCreating()
    return
  }
  const fetchSettingsResult = await fetchSettings();
    if (!fetchSettingsResult) {
      notify.show(`Fetching settings failed after making work folder ${workFolderName.value}`, 5000, "error")
      clearCreating()
      return
    }
  notify.show(`New project ${workFolderName.value} created`, 2000, "info")
  emit("created", workFolderName.value)
  workFolderName.value = ""
  clearCreating()
}

function clearCreating() {
  creating.value = false
  creatingWork.value = false
  creatingTest.value = false
}

function clear() {
  if (!creating.value) workFolderName.value = ""
}

</script>

<template>
  <section>
    <div class="flex items-center gap-2">
      <span class="w-80">
        <input
            class="w-full px-3 py-2 bg-blue-100 rounded-md text-sm"
            type="text"
            v-model="workFolderName"
            :disabled="creating"
            placeholder="Enter project name (e.g. work1)"
            @keyup.enter="postNewWorkPath"
        />
      </span>
      <button
          class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          :disabled="creating"
          @click="postNewWorkPath">
        <i v-if="creatingWork" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-upload"></i>
        <span>Create project</span>
      </button>
      <button
          class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          :disabled="creating"
          @click="postNewTestWorkPath">
        <i v-if="creatingTest" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-upload"></i>
        <span>Create test project</span>
      </button>
    </div>
  </section>
</template>
