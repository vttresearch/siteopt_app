<script setup>
import { isTauri } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useSettingStore } from "@/stores/settingstore.js";

const props = defineProps({
  root: String,
  fname: String,
})

const notify = useNotificationStore()
const settings = useSettingStore()

const openFile = async () => {
  if (!isTauri()) {
    notify.show("Tauri environment not detected. Run with 'npx tauri dev' to enable this button.", 6000, "error")
    console.log("Run with 'npx tauri dev' to enable this button.")
    return
  }
  let full_path = ""
  if (props.root !== "") full_path = settings.inputDataPath + "/" + props.root + "/" + props.fname + "/"
  else full_path = settings.inputDataPath + "/" + props.fname + "/"
  console.log(`full_path: ${full_path}`)
  notify.show(`Opening ${full_path}`, 5000, "info")
  try {
    await openPath(full_path);
  }
  catch (err) {
    notify.show(`Opening ${full_path} failed. [${err}]`, 10000, "error")
    console.error(`Error [[${err}]] Opening file ${full_path}`);
  }
};

</script>

<template>
  <button
      class="flex-nowrap whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-0.5"
      @click="openFile"
  >
    <font-awesome-icon class="pr-1" icon="fa-solid fa-download" fixed-width />Open
  </button>
</template>
