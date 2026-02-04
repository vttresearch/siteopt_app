<script setup>
import { onMounted, ref } from 'vue';
import { saveAs } from 'file-saver';
import FileTree from '@/components/FileTree.vue';
import Table from "@/components/DataEditorPanel.vue";
import { API_BASE } from "@/config.js";
import SelectInputFolder from "@/components/SelectInputFolder.vue";

const count = ref(0);
const tasks = ref(["Task 1", "Task 2", "Task 3"])
const ifiles = ref(["fname1", "fname2"])
const data2 = ref("text")
const on_mounted_response = ref({})
const input_data_title = ref("")
const input_data = ref([])
const status = ref("fetching")
const isLoading = ref(false)
const error = ref(null)


onMounted(() => {
  // async IIFE lets you use async/await syntax while still
  // mounting the component synchronously.
  (async () => {
    // Update your refs to re-render the template.
    console.log(`API_BASE in Debug: ${API_BASE}`)
    const input_data_response = await fetch(`${API_BASE}api/fetch_input_file_tree/`)
    if (!input_data_response.ok) {
      status.value = "error fetching input data"
      throw new Error("on_mounted_response not Ok");
    }
    on_mounted_response.value = await input_data_response.text()
    on_mounted_response.value = JSON.parse(on_mounted_response.value)
    input_data_title.value = on_mounted_response.value.title
    input_data.value = on_mounted_response.value.children
    console.log(on_mounted_response.value)
    console.log(typeof(on_mounted_response.value))
    status.value = 'fetched'
  })()
})


async function test() {
  const response = await fetch("open_excel/excel_file.xlsx");
  console.log(response.text());
}

async function test2() {
  const response = await fetch("api/fetch_input_file_tree/");
  const data2 = await response.text()
  console.log(data2);
}

const dl_excel_file = async () => {
  isLoading.value = true;
  error.value = null;  // Reset error on new attempt

  try {
    const response = await fetch("api/download_excel_file/");
    if (!response.ok) {
      throw new Error(`Response not Ok: ${response.statusText}`);
    }
    // Get response as BLOB (Binary Large Object)
    const blob = await response.blob();
    // Trigger download using file-saver
    saveAs(blob, 'ms-excel-file.xlsx');
  } catch (err) {
    console.error("Error downloading Excel file:", err);
    error.value = "Downloading failed. Please try again.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <h1>Debug Page</h1>
  <button class="text-white bg-blue-900 hover:bg-gray-900 hover:text-white rounded-md px-3 py-2"
          @click="count++"
  >Count is {{ count }}
  </button>

  <SelectInputFolder />

  <div>
    <Table />
  </div>
  <br>

  <FileTree :title="input_data_title" :model="input_data" />

  <div>
    <ul>
      <li class="m-2">
        <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2"
                @click="test">Open Excel File 1</button>
      </li>
      <li class="m-2">
        <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2"
                @click="test2">Fetch Input Data</button>
      </li>
      <li class="m-2">
        <button class="text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2"
                @click="dl_excel_file">Download Excel File</button>
      </li>
    </ul>
  </div>
</template>
