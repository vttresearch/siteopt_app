<script setup>
import { onMounted, ref } from 'vue';
import { saveAs } from 'file-saver';
import FileTree from '@/components/FileTree.vue';
import Table from '@/components/Table.vue';

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

const jsondata = ref([
            {user: 'hc', name: 'Harry Cole',    phone: '1-415-2345678', gender: 'M', age: 25, birth: '1997-07-01'},
            {user: 'sm', name: 'Simon Minolta', phone: '1-123-7675682', gender: 'M', age: 20, birth: '1999-11-12'},
            {user: 'ra', name: 'Raymond Atom',  phone: '1-456-9981212', gender: 'M', age: 19, birth: '2000-06-11'},
            {user: 'ag', name: 'Mary George',   phone: '1-556-1245684', gender: 'F', age: 22, birth: '2002-08-01'},
            {user: 'kl', name: 'Kenny Linus',   phone: '1-891-2345685', gender: 'M', age: 29, birth: '1990-09-01'}
        ])

defineProps({
  input_files: Array,
})

onMounted(() => {
  // async IIFE lets you use async/await syntax while still
  // mounting the component synchronously.
  (async () => {
    // Update your refs to re-render the template.
    const input_data_response = await fetch("/api/fetch_input_data")
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
  const response = await fetch("api/fetch_input_data/");
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

  <!--
  <vue-excel-editor v-model="jsondata">
    <vue-excel-column field="user"   label="User ID"       type="string" width="80px" />
    <vue-excel-column field="name"   label="Name"          type="string" width="150px" />
    <vue-excel-column field="phone"  label="Contact"       type="string" width="130px" />
    <vue-excel-column field="gender" label="Gender"        type="select" width="50px" :options="['F','M','U']" />
    <vue-excel-column field="age"    label="Age"           type="number" width="70px" />
    <vue-excel-column field="birth"  label="Date Of Birth" type="date"   width="80px" />
  </vue-excel-editor>
  -->
  <div>
    <Table />
  </div>

  <FileTree :title="input_data_title" :model="input_data" />


  <div>
    <!--<p>[{{ status }}] on_mounted_response {{ on_mounted_response  }}</p>-->
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
    <!--
    <div>
    <button @click="dl_excel_file" :disabled="isLoading">
      <span v-if="isLoading">Downloading...</span>
      <span v-else>Download Excel</span>
    </button>
    <p class="text-red mt-10" v-if="error">{{ error }}</p>
    </div>
    -->
  </div>
</template>
