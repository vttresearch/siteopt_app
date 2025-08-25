<script setup>
import { ref, watch } from 'vue';
import Cell from './Cell.vue';
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import { useTableDataStore } from '@/stores/filedatastore.js';


const data_store = useTableDataStore()
const sheetNames = ref([]);
const columns_by_sheet = ref({});
const column_name_and_data = ref({});
const selectedSheet = ref("");
const fileData = ref({})

// Watch for changes in the store's data
watch(() => data_store.daata, (newItems) => {
  sheetNames.value = Object.keys(newItems)  // or use slice(), or structuredClone if needed
  fileData.value = newItems
  selectedSheet.value = sheetNames.value[0]
  updateTable()

  /*
  column_name_and_data.value = {};  // Clear when data changes
  const first_sheet_data = newItems[selectedSheet.value];  // [{objectClass: [v1, v2]}, {object: [x1, x2]}]

  if (Array.isArray(first_sheet_data) && first_sheet_data.length > 0) {
    for (let i=0; i<first_sheet_data.length; i++) {
      const row_object = first_sheet_data[i];  // {objectClass: [v1, v2]}
      for (const key of Object.keys(row_object)) {
        const valueArray = row_object[key];
        console.log(`processing ${key}: ${valueArray}`)
        column_name_and_data.value[key] = Array.isArray(valueArray) ? valueArray : valueArray[0];
      }
    }
  }
  console.log(`sheet names: ${sheetNames.value}`)
*/
});

/**
 * Updates column_name_and_data when a file is reloaded or when a user selects a sheet
 */
function updateTable() {
  const sheet_data = fileData.value[selectedSheet.value];  // [{objectClass: [v1, v2]}, {object: [x1, x2]}]
  column_name_and_data.value = {};  // Clear when data changes
  if (Array.isArray(sheet_data) && sheet_data.length > 0) {
    for (let i=0; i<sheet_data.length; i++) {
      const row_object = sheet_data[i];  // {objectClass: [v1, v2]}
      for (const key of Object.keys(row_object)) {
        const valueArray = row_object[key];
        console.log(`processing ${key}: ${valueArray}`)
        column_name_and_data.value[key] = Array.isArray(valueArray) ? valueArray : valueArray[0];
      }
    }
  }
}

function newSheetSelected(event) {
  selectedSheet.value = event
  updateTable()
}

// @updeit:activeSheet="selectedSheet = $event"/>
</script>

<template>
  <div class="overflow-auto max-h-96 border border-gray-300 rounded">
  <!-- ?? {} is a nullish coalescing operator, so if column_name_and_data is null or undefined, it falls back to {} -->
  <SelectSheetButtons
      :sheets="sheetNames"
      :activeIndex="0"
      :activeSheet="selectedSheet"
      @update:activeSheet="newSheetSelected($event)"/>
  <table
      class="table-auto w-full border-collapse whitespace-nowrap"
      v-if="Object.keys(column_name_and_data ?? {}).length !== 0"
  >
    <thead class="bg-gray-100 sticky top-0">
    <tr>
      <th class="bg-gray-200 w-[25px] px-2 py-1"></th>
      <!-- Column name -->
      <th
          class="bg-gray-200 w-[100px] px-2 py-1 truncate text-left"
          v-for="c in Object.keys(column_name_and_data)"
          :key="c"
          :title="c"
      >
        {{ c }}
      </th>
    </tr>
    </thead>
    <tbody>
      <tr
          v-for="i in column_name_and_data[Object.keys(column_name_and_data)[0]].length"
          :key="i"
      >
        <!-- Row number-->
        <th class="bg-gray-50 px-2 py-1 font-medium text-left">{{ i }}</th>
        <td
            class="border border-gray-300 h-6 overflow-hidden px-2 py-1 text-left"
            v-for="c in Object.keys(column_name_and_data)"
            :key="c"
        >
          <Cell :v="column_name_and_data[c][i-1]"></Cell>
        </td>
      </tr>
    </tbody>
  </table>
    <div v-else class="p-4 text-gray-500">Select a file to view data.</div>
  </div>
</template>
