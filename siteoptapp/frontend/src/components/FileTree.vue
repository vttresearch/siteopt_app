<script setup>
import { ref } from 'vue';
import FileItem from "./FileItem.vue";
import FolderItem from "./FolderItem.vue";
import { useSettingStore } from "@/stores/settingstore.js";

const props = defineProps({
  model: Object,
  parentName: {
      type: String,
      default: ''
    }
})

const settingStore = useSettingStore()

function isFolder(list_item) {
  return "children" in list_item
}

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
    <ul>
      <template v-for="item in model" :key="item.name">
        <li v-if="!isFolder(item)">
          <FileItem :item_name="item.name" :parent_name="parentName" />
        </li>
        <li v-else>
          <FolderItem :folderName="item.name" :children="item.children" :parentName="item.name" />
        </li>
      </template>
    </ul>
  </section>
</template>
