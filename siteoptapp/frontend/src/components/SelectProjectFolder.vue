<script setup>
import { ref, watch } from 'vue';
import { isTauri } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postNewPath } from "@/utils/functions.js";


const notify = useNotificationStore()
const settings = useSettingStore()
const inputFieldRef = ref('')
const isValidPath = ref(false)
const isDev = import.meta.env.DEV;
const validClass = ref("p-1 w-full bg-blue-100")  // input class when typed given path is valid
const invalidClass = ref("p-1 w-full bg-red-100")  // input class when typed path is invalid

/**
 * Checks whether path is valid whenever input field is updated.
 */
watch(inputFieldRef, (newPath) => {
  isValidPath.value = checkIfValidPath(newPath)
});

function checkIfValidPath(p) {
  const linuxPathRegex = /^(\/?[a-z0-9A-Z\-]+)+$/
  const winPathRegex = /^([a-zA-Z]:)?([\\\/][a-zA-Z0-9_\-\s.~]+)+[\\\/]?/
  const isValidLinux = linuxPathRegex.test(p);
  const isValidWin = winPathRegex.test(p);
  return isValidLinux || isValidWin
}

const selectDir = async () => {
  let selected = ""
  const inTauri = isTauri()
  if (!inTauri) {
    notify.show("Tauri environment not detected. Run with 'npx tauri dev' to enable this button.", 6000, "error")
    console.log("Run with 'npx tauri dev' to enable this button.")
    return
  }
  const homeD = await homeDir()
  console.log(`homeDir: ${homeD}`)
  try {
    selected = await open({
      directory: true,
      multiple: false,
      defaultPath: homeD
    });
  }
  catch (err) {
    console.error(`Error with plugin-dialog/open(): [${err}]`);
    return
  }
  if (selected) {
    console.log(`selected:${selected}`)
    settings.setProjectPath(selected)
  }
  else {
    console.log("Cancelled")
  }
};

function apply() {
  if (checkIfValidPath(inputFieldRef.value)) {
    postNewProjectPath(inputFieldRef.value)
  }
  else {
    notify.show("Invalid path", 1000, "info")
  }
}

function clear() {
  console.log("Clearing project path")
  postNewProjectPath("")
}

function postNewProjectPath(path) {
  return postNewPath("project_data_path", "project_data_path", path, settings.setProjectPath, notify)
}

</script>

<template>
  <section>
    <div class="flex justify-between mb-2">
      <span class="w-full">
        <input
            :class="[isValidPath ? validClass : invalidClass]"
            type="text"
            v-model="inputFieldRef"
            placeholder="Enter project path"
            v-on:keyup.enter="apply"
        />
      </span>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1 ml-1 mr-1" @click="apply">
        <font-awesome-icon icon="fa-regular fa-check-circle" fixed-width /></button>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1 mr-1" @click="clear">
        <font-awesome-icon icon="fa-solid fa-times" fixed-width /></button>
      <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1" @click="selectDir">
        <font-awesome-icon icon="fa-regular fa-folder-open" fixed-width /></button>
      </div>
      <div v-if="settings.projectPath !== ''" class="text-gray-600 text-base"><span>{{ settings.projectPath }}</span></div>
      <div v-else class="text-gray-600 text-base"><span>Set SiteOpt Spine Toolbox path</span></div>
    </section>
</template>
