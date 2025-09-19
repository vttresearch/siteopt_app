<script setup>
import { ref, watch } from 'vue';
import { AgGridVue } from 'ag-grid-vue3';
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import { useTableDataStore } from '@/stores/filedatastore.js';
import Spinner from "@/components/Spinner.vue";


const data_store = useTableDataStore()
const sheetNames = ref([]);
const selectedSheet = ref("");
const fileData = ref({})
const rowData = ref([])
const columnDefs = ref([])

function clearRefs() {
  sheetNames.value = []
  selectedSheet.value = ""
  fileData.value = {}
  rowData.value = []
  columnDefs.value = []
}

// Watch for changes in the store's data
watch(() => data_store.daata, (newItems) => {
  if (Object.keys(newItems).length === 0) {
    clearRefs()
    return
  }
  const fileType = newItems["filetype"]
  fileData.value = newItems["data"]
  if (fileType === "xlsx") {
    console.log("Updating table with Excel data")
    sheetNames.value = Object.keys(fileData.value)  // or use slice(), or structuredClone if needed
    selectedSheet.value = sheetNames.value[0]
    updateTableFromExcel()
  }
  else if (fileType === "csv") {
    console.log("Updating table with CSV data")
    sheetNames.value = []
    selectedSheet.value = ""
    updateTableFromCsv()
  }
  else {
    console.warn(`Unsupported fileType: ${fileType}`)
    sheetNames.value = []
    selectedSheet.value = ""
    fileData.value = {}
    rowData.value = []
    columnDefs.value = []
  }
});

/**
 * Updates columnDefs for AG Grid data from an .xlsx file is loaded or when user selects a sheet.
 */
function updateTableFromExcel() {
  const sheet_data = fileData.value[selectedSheet.value]
  if (!Array.isArray(sheet_data) || sheet_data.length === 0) return

  // Step 1: Merge all column-wise objects into one
  const merged = Object.assign({}, ...sheet_data)
  // Step 2: Get column names
  const rowNumberColumn = {
  headerName: "#",
  valueGetter: "node.rowIndex + 1",
  width: 50,
  cellClass: 'bg-gray-50 font-medium text-left'
}
  const columns = Object.keys(merged)
  columnDefs.value = [rowNumberColumn, ...columns.map(col => ({
  headerName: col,
  field: col,
  minWidth: 100
  }))]
  // Step 3: Determine number of rows
  const rowCount = merged[columns[0]].length
  // Step 4: Build row-wise objects
  rowData.value = Array.from({ length: rowCount }, (_, i) => {
    const row = {}
    for (const col of columns) {
      row[col] = merged[col][i]
    }
    return row
  })
}

/**
 * Updates columnDefs for AG Grid when data from a .csv file is loaded.
 */
function updateTableFromCsv() {
  const csvData = fileData.value; // { time: [...], value: [...] }
  const columns = Object.keys(csvData); // ['time', 'value']
  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: 'left',
      cellClass: 'bg-gray-50 font-medium text-left'
    },
    ...columns.map((col, index) => ({
      headerName: col,
      field: col,
      minWidth: 100
    }))
  ];
  const rowCount = csvData[columns[0]].length;
  rowData.value = Array.from({ length: rowCount }, (_, i) => {
    const row = {};
    for (const col of columns) {
      row[col] = csvData[col][i];
    }
    return row;
  });
}

function newSheetSelected(event) {
  selectedSheet.value = event
  updateTableFromExcel()
}
</script>

<template>
  <Spinner v-if="data_store.loading" message="Loading data..." class="col-auto"/>
  <div v-else>
    <div class="text-gray-600 my-2 mb-6">{{ data_store.fname }}</div>
  <SelectSheetButtons
      v-if="selectedSheet.length > 0"
      :sheets="sheetNames"
      :activeIndex="0"
      :activeSheet="selectedSheet"
      @update:activeSheet="newSheetSelected($event)" />
    <!-- // ?? {} is a nullish coalescing operator, so if column_name_and_data is null or undefined, it falls back to {} -->
    <div class="w-full h-80 overflow-auto" v-if="Object.keys(columnDefs ?? {}).length !== 0">
      <AgGridVue
          class="w-full h-full"
          :domLayout="'normal'"
          :columnDefs="columnDefs"
          :rowData="rowData"
          :rowBuffer="10"
          :rowHeight="40"
          :animateRows="true"
          :rowSelection.enableClickSelection="false"
          :suppressColumnVirtualization="false"
          :suppressCellFocus="true"
          :suppressAnimationFrame="true"
          :enableCellTextSelection="false"
        />
      </div>
    <div v-else class="p-4 text-gray-500">Select a file to view data.</div>
  </div>
</template>
