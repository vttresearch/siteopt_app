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
    },
  fullParents : {
    type: String,
    default: ''
  },
  path: {
    type: String,
    default: ''
  },
  enableOpen: {
    type: Boolean,
    default: false
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

function concatParentName(itemName) {
  // console.log(`fullParents:${props.fullParents}`)
  if (props.parentName !== "") {
    return props.fullParents + "/" + itemName
  }
  else {
    //console.log(`Returning: ${itemName}`)
    return itemName
  }
}
</script>

<template>
  <section>
    <ul>
      <template v-for="item in model" :key="item.name">
        <li v-if="!isFolder(item)">
          <FileItem :item_name="item.name" :parent_name="parentName" :interm_paths="fullParents" :base_path="props.path" :enableOpen="props.enableOpen"/>
        </li>
        <li v-else>
          <FolderItem :folderName="item.name" :children="item.children" :parentName="concatParentName(item.name)" :base_path="props.path" :enableOpen="props.enableOpen" />
        </li>
      </template>
    </ul>
  </section>
</template>
