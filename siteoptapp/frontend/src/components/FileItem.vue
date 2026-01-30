<script setup>
import { ref } from 'vue';
import { useTableDataStore } from '@/stores/filedatastore.js';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postRequestData } from "@/utils/functions.js";
import OpenButton from "@/components/OpenButton.vue";


const props = defineProps({
  item_name: {type: String, required: true},
  parent_name: {type: String, required: false, default: ""},
  interm_paths: {type: String, required: false, default:""},
  base_path: {type: String, required: false, default: ""},
  enableOpen: {type: Boolean, default: false}
})

const store = useTableDataStore()
const notify = useNotificationStore()
const fdata = ref({})

async function fetchFileContents(fname) {
  let full_path = ""
  if (props.interm_paths === "") {
    full_path = props.base_path + "/" + fname
  }
  else {
    full_path = props.base_path + "/" + props.interm_paths + "/" + fname
  }
  console.log(`Requesting file: ${full_path}`)
  store.clear()
  store.toggleLoading()
  fdata.value = await postRequestData(full_path, fname, store, notify)
  store.toggleLoading()
}

function isExcel(fname) {
  return fname.endsWith(".xlsx")
}

function isCSV(fname) {
  return fname.endsWith(".csv")
}
</script>

<template>
  <div class="flex justify-between items-center">
    <div class="w-full cursor-pointer hover:bg-gray-200 p-0.5" @click="fetchFileContents(item_name)">

      <div v-if="isExcel(item_name)" class="overflow-hidden overflow-ellipsis">
        <span class="flex items-baseline justify-start gap-1">
          <i class="fa-regular fa-file-excel"></i>
          <span>{{ item_name }}</span>
        </span>
      </div>

      <div v-else-if="isCSV(item_name)" class="overflow-hidden overflow-ellipsis">
        <span class="flex items-baseline justify-start gap-1">
          <i class="fa-solid fa-file-csv"></i>
          <span>{{ item_name }}</span>
        </span>
      </div>

      <div v-else class="overflow-hidden overflow-ellipsis">
        <span class="flex items-baseline justify-start gap-1">
          <i class="fa-regular fa-file"></i>
          <span>{{ item_name }}</span>
        </span>
      </div>
    </div>

    <div v-if="props.enableOpen" class="md:ml-auto">
      <OpenButton :root="parent_name" :fname="item_name"/>
    </div>

  </div>
</template>
