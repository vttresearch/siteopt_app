<script setup>
import { ref, watch, computed } from 'vue';
import FileItem from "./FileItem.vue";
import FolderItem from "./FolderItem.vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { readDir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { homeDir } from '@tauri-apps/api/path';
import { isTauri } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';

const props = defineProps({
  title: String,
  model: Object,
  inputPath: String,
})

const settingStore = useSettingStore()
const notify = useNotificationStore()

function isFolder(list_item) {
  return "children" in list_item
}
const openExplorer = async () => {
  const inTauri = isTauri()
  if (!inTauri) {
    notify.show("Tauri environment not detected. Run with 'npx tauri dev' to enable this button.", 6000, "error")
    console.log("Run with 'npx tauri dev' to enable this button.")
    return
  }
  try {
    await openPath('C:/Users/ttepsa/Documents');
  }
  catch (err) {
    console.error(`Error with openPath(): [${err}]`);
  }
};

const listDir = async () => {
  const baseDir = BaseDirectory
  const appData = BaseDirectory.AppData
  const appLocalData = BaseDirectory.AppLocalData
  console.log(`Home: ${baseDir.Home}`)
  console.log(`AppData: ${appData}`)
  console.log(`AppLocalData: ${appLocalData}`)

}
</script>

<template>
  <section>
    <div class="bg-white rounded-xl shadow-md relative p-2 text-xs">
      <div class="mb-4 text-gray-600 text-base"><span>{{ title }}</span></div>
      <div class="flex justify-between mb-4">
            <div v-if="inputPath !== ''" class="text-gray-600 text-base"><span>{{ inputPath }}</span></div>
            <div v-else class="text-gray-600 text-base"><span>Set path to input files to get started.</span></div>
        <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1" @click="openExplorer">Edit...</button>
      </div>
      <ul>
        <template v-for="item in props.model">
          <li v-if="!isFolder(item)">
            <FileItem :item_name="item.name"/>
          </li>
          <li v-else>
            <FolderItem :folderName="item.name" :children="item.children" />
          </li>
        </template>
      </ul>
    </div>
  </section>
</template>
