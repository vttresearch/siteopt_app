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

function validFolderName() {
  const folderNameRegex = /^(\/?[a-z0-9A-Z\-]+)+$/  // No special characters allowed
  return folderNameRegex.test(workFolderName.value);
}

function workFolderNameTaken() {
  return Object.keys(settings.workFolders).includes(workFolderName.value)
}

function postNewWorkPath() {
  if (workFolderName.value === "") {
    notify.show("Please enter work folder name (e.g. work1)", 5000, "info")
    return
  }
  if (workFolderNameTaken()) {
    notify.show("Given work folder name already exists", 1000, "info")
    return
  }
  if (!validFolderName()) {
    notify.show("Given work folder name contains invalid characters", 5000, "error")
    return
  }
  makeWorkFolder()
}

const makeWorkFolder = async () => {
  creating.value = true
  const postResult = await postNewPath("make_work_folder", "work_folder", workFolderName.value, notify)
  if (!postResult) {
    creating.value = false
    return
  }
  const fetchSettingsResult = await fetchSettings();
    if (!fetchSettingsResult) {
      notify.show(`Fetching settings failed after making work folder ${workFolderName.value}`, 5000, "error")
      creating.value = false
      return
    }
  notify.show(`New work folder ${workFolderName.value} created`, 2000, "info")
  emit("created", workFolderName.value)
  workFolderName.value = ""
  creating.value = false
}

function clear() {
  if (!creating.value) workFolderName.value = ""
}

</script>

<template>
  <section>
    <div class="flex items-center gap-2 mb-2">
      <span class="flex-1">
        <input
            class="w-full px-3 py-2 bg-blue-100 rounded-md text-sm"
            type="text"
            v-model="workFolderName"
            :disabled="creating"
            placeholder="Enter work folder name (e.g. work1)"
            @keyup.enter="postNewWorkPath"
        />
      </span>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50" :disabled="creating" @click="postNewWorkPath">
        <font-awesome-icon icon="fa-regular fa-check-circle" fixed-width /></button>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50" :disabled="creating" @click="clear">
        <font-awesome-icon icon="fa-solid fa-times" fixed-width /></button>
      </div>
    </section>
</template>
