<script setup>
import { ref, watch } from 'vue';
import SimpleCell from './SimpleCell.vue';
import SelectSheetButton from "@/components/SelectSheetButton.vue";
import { useTableDataStore } from '@/stores/filedatastore.js';


const data_store = useTableDataStore()
const sheetNames = ref([]);
const columns_by_sheet = ref({});
const column_name_and_data = ref({});
const selectedSheet = ref("");

// Watch for changes in the store's data
watch(() => data_store.daata, (newItems) => {
  sheetNames.value = Object.keys(newItems)  // or use slice(), or structuredClone if needed
  column_name_and_data.value = {};  // Clear when data changes
  selectedSheet.value = sheetNames.value[0]
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
});

function newSheetSelected(event) {
  selectedSheet.value = event
}

// @updeit:activeSheet="selectedSheet = $event"/>
</script>

<template>
  <div class="overflow-auto max-h-96 border border-gray-300 rounded">
  <!-- ?? {} is a nullish coalescing operator, so if column_name_and_data is null or undefined, it falls back to {} -->
  <table class="table-auto whitespace-nowrap" v-if="Object.keys(column_name_and_data ?? {}).length !== 0">
    <thead class="bg-gray-100 sticky top-0">
    <tr>
      <th class="px-2 py-0.5"></th>
      <th class="px-2 truncate" v-for="c in Object.keys(column_name_and_data)" :key="c" :title="c">{{ c }} <!-- Column name -->
      </th>
    </tr>
    </thead>
    <tbody>
      <tr v-for="i in column_name_and_data[Object.keys(column_name_and_data)[0]].length" :key="i">
        <th class="px-2 py-0.5 font-medium">{{ i }}</th>  <!-- Row number-->
        <td v-for="c in Object.keys(column_name_and_data)" :key="c">
          <SimpleCell :v="column_name_and_data[c][i-1]"></SimpleCell>
        </td>
      </tr>
    </tbody>
  </table>
  </div>
  <SelectSheetButton
      :sheets="sheetNames"
      :activeIndex="0"
      :activeSheet="selectedSheet"
      @update:activeSheet="newSheetSelected($event)"/>
  <p class="mt-4">Active button: {{ selectedSheet }}</p>
</template>

<style>
body {
  margin: 0;
}

table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

th {
  background-color: #eee;
}

tr:first-of-type th {
  width: 100px;
}

tr:first-of-type th:first-of-type {
  width: 25px;
}

td {
  border: 1px solid #ccc;
  height: 1.5em;
  overflow: hidden;
}
</style>