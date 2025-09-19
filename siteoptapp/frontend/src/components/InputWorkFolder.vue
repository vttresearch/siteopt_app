<script setup>
import { ref } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import {fetchSettings, postNewPath} from "@/utils/functions.js";

const notify = useNotificationStore()
const settings = useSettingStore()
const workFolderName = ref("")
const isValidWorkFolderName = ref(false)

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
  const postResult = await postNewPath("make_work_folder", "work_folder", workFolderName.value, notify)
  if (!postResult) {
    notify.show(`Making work folder ${workFolderName.value} failed`, 5000, "error")
    return
  }
  const fetchSettingsResult = await fetchSettings();
    if (!fetchSettingsResult) {
      notify.show(`Fetching settings failed after making work folder ${workFolderName.value}`, 5000, "error")
      return
    }
  notify.show(`New work folder ${workFolderName.value} created`, 2000, "info")
}

function clear() {
  workFolderName.value = ""
}

</script>

<template>
  <section>
    <div class="flex justify-between mb-2">
      <span class="w-full">
        <input
            class="p-1 w-full bg-blue-100"
            type="text"
            v-model="workFolderName"
            placeholder="Enter work folder name (e.g. work1)"
            v-on:keyup.enter="postNewWorkPath"
        />
      </span>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1 ml-1 mr-1" @click="postNewWorkPath">
        <font-awesome-icon icon="fa-regular fa-check-circle" fixed-width /></button>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1 mr-1" @click="clear">
        <font-awesome-icon icon="fa-solid fa-times" fixed-width /></button>
      </div>
    </section>
</template>
