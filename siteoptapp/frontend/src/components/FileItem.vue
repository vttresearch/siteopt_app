<script setup>
import { ref } from 'vue';
import { useTableDataStore } from '@/stores/filedatastore.js';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
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
  <div class="flex justify-between py-0.5 pl-2">
    <div class="overflow-hidden overflow-ellipsis hover:bg-indigo-300 cursor-pointer" v-if="isExcel(item_name)">
      <span class="text-nowrap" @click="fetchFileContents(item_name)">
        <font-awesome-icon class="pr-1" icon="fa-regular fa-file-excel" fixed-width />{{ item_name }}
      </span>
    </div>
    <div class="overflow-hidden overflow-ellipsis hover:bg-indigo-300 cursor-pointer" v-else-if="isCSV(item_name)">
      <span class="text-nowrap" @click="fetchFileContents(item_name)">
        <font-awesome-icon class="pr-1" icon="fa-solid fa-file-csv" fixed-width />{{ item_name }}
      </span>
    </div>
    <div class="overflow-hidden overflow-ellipsis hover:bg-indigo-300 cursor-pointer" v-else>
      <span class="text-nowrap" @click="fetchFileContents(item_name)">
        <font-awesome-icon class="pr-1" icon="fa-regular fa-file" fixed-width />{{ item_name }}
      </span>
    </div>
    <div v-if="props.enableOpen" class="md:ml-auto">
      <OpenButton :root="parent_name" :fname="item_name"/>
    </div>
  </div>
</template>
