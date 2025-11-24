<script setup>
import FileItem from "./FileItem.vue";
import FolderItem from "./FolderItem.vue";
import UploadButton from "@/components/UploadButton.vue";
import { useSettingStore } from "@/stores/settingstore.js";
import SelectFolder from "@/components/SelectFolder.vue";

const props = defineProps({
  title: String,
  model: Object,
})

const emit = defineEmits(['refresh']);
const settingStore = useSettingStore()

function handleUpload() {
  emit('refresh'); // Trigger refresh of file tree
}

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
    <div class="bg-white rounded-xl shadow-md relative p-2 text-xs">
      <div class="mb-4 text-gray-600 text-base flex justify-between items-center">
        <span>{{ title }}</span>
        <UploadButton folder_path="" @uploaded="handleUpload" />
      </div>
      <SelectFolder class="mb-4"/>
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
