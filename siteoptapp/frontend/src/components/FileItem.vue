<script setup>
import { ref } from 'vue';
import EditButton from "@/components/EditButton.vue";
import DownloadButton from "@/components/DownloadButton.vue";
import { useTableDataStore } from '@/stores/filedatastore.js';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { buildApiUrl } from "@/utils/apiUrl.js";


const store = useTableDataStore()

const props = defineProps({
  item_name: {type: String, required: true},
  parent_name: {type: String, required: false, default: ""},
})

const fdata = ref({})

async function fetchFileContents(fname) {
  console.log(`fname:${fname} parent:${props.parent_name}`)
  let apiPath = "api/fetch_data/";
  if (props.parent_name !== "") {
    apiPath = apiPath.concat(props.parent_name + "/").concat(fname)
  }
  else {
    apiPath = apiPath.concat("root/").concat(fname)
  }
  const fpath = buildApiUrl(apiPath);
  console.log(`Fetching from ${fpath}`)
  store.toggleLoading()
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
  store.toggleLoading()
}

function isExcel(fname) {
  return fname.endsWith(".xlsx")
}

function isCSV(fname) {
  return fname.endsWith(".csv")
}

// Generate file path for download
function getFilePath() {
  if (props.parent_name && props.parent_name !== "") {
    return `${props.parent_name}/${props.item_name}`;
  } else {
    return `root/${props.item_name}`;
  }
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
    <div class="md:ml-auto flex gap-1">
      <DownloadButton :file_path="getFilePath()" :filename="item_name"/>
      <EditButton :root="parent_name" :fname="item_name"/>
    </div>
  </div>
</template>
