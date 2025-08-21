<script setup>
import { ref } from 'vue';
import DownloadButton from "./DownloadButton.vue";
import UploadButton from "./UploadButton.vue";
import { useTableDataStore } from '@/stores/filedatastore.js';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { API_BASE } from "@/config.js";


const store = useTableDataStore()

const props = defineProps({
  item_name: {type: String, required: true},
  parent_name: {type: String, required: false, default: ""},
})

const fdata = ref({})

async function fetchFileContents(fname) {
  console.log(`fname:${fname} parent:${props.parent_name}`)
  let fpath = API_BASE + "api/fetch_data/"
  if (props.parent_name !== "") {
    fpath = fpath.concat(props.parent_name + "/").concat(fname)
  }
  else {
    fpath = fpath.concat("root/").concat(fname)
  }
  console.log(`Fetching from ${fpath}`)
  const response = await fetch(fpath)
  if (!response.ok) {
    console.log("Failed")
  }
  else {
    console.log("Response received ok")
    fdata.value = await response.text()
    fdata.value = JSON.parse(fdata.value)
    console.log(fdata.value)
    store.addData(fname, fdata.value)
  }
}

function isExcel(fname) {
  return fname.endsWith(".xlsx")
}

function isCSV(fname) {
  return fname.endsWith(".csv")
}
</script>

<template>
  <div class="flex justify-between py-0.5">
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
    <div class="md:ml-auto">
      <div class="flex space-x-2">
        <DownloadButton :fname="item_name" />
        <UploadButton :fname="item_name" />
      </div>
    </div>
  </div>
</template>
