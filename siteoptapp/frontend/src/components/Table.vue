<script setup>
import { ref, watch, computed } from 'vue';
import { AgGridVue } from 'ag-grid-vue3';
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import { useTableDataStore } from '@/stores/filedatastore.js';
import Spinner from "@/components/Spinner.vue";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postSaveFile } from "@/utils/functions.js";
import { useSettingStore } from "@/stores/settingstore.js";


const data_store = useTableDataStore()
const sheetNames = ref([]);
const selectedSheet = ref("");
const fileData = ref({})
const rowData = ref([])
const columnDefs = ref([])
const mdText = ref("")
const notify = useNotificationStore()
const saving = ref(false)
const mdDirty = ref(false)
const csvDirty = ref(false)
const jsonDirty = ref(false)
const xlsxDirty = ref(false)
const xlsxDirtyBySheet = ref({})
const currentXlsxDirty = computed(() => !!xlsxDirtyBySheet.value[selectedSheet.value])
const jsonEditText = ref("")
const gridApi = ref(null)
const settingStore = useSettingStore()

const hasWorkFolders = computed(() =>
  Object.keys(settingStore.workFolders ?? {}).length > 0
)



function onGridReady(params) {
  gridApi.value = params.api
}

function onCellValueChanged() {
  const ft = data_store.daata?.filetype
  if (ft === "csv") csvDirty.value = true
  if (ft === "xlsx") markXlsxDirty()
}

function clearRefs() {
  sheetNames.value = []
  selectedSheet.value = ""
  fileData.value = {}
  rowData.value = []
  columnDefs.value = []
  mdText.value = ""
  jsonEditText.value = ""
  jsonDirty.value = false
}

function markXlsxDirty() {
  const s = selectedSheet.value
  if (!s) return
  xlsxDirtyBySheet.value = { ...xlsxDirtyBySheet.value, [s]: true }
}

function clearXlsxDirty(sheet) {
  xlsxDirtyBySheet.value = { ...xlsxDirtyBySheet.value, [sheet]: false }
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
    sheetNames.value = Object.keys(fileData.value)
    selectedSheet.value = sheetNames.value[0]

    const init = {}
    for (const s of sheetNames.value) init[s] = false
    xlsxDirtyBySheet.value = init
    updateTableFromExcel()
  }
  else if (fileType === "csv") {
    console.log("Updating table with CSV data")
    sheetNames.value = []
    selectedSheet.value = ""
    updateTableFromCsv()
    csvDirty.value = false
  }
  else if (fileType === "json") {
    console.log("Updating view with JSON data")
    sheetNames.value = []
    selectedSheet.value = ""
    rowData.value = []
    columnDefs.value = []
    mdText.value = ""

    try {
      jsonEditText.value = JSON.stringify(fileData.value, null, 2)
    } catch (e) {
      jsonEditText.value = String(fileData.value)
    }
    jsonDirty.value = false
  }
  else if (fileType === "md") {
    console.log("Updating view with Markdown data")

    sheetNames.value = []
    selectedSheet.value = ""
    rowData.value = []
    columnDefs.value = []

    mdText.value = fileData.value?.text ?? ""
    mdDirty.value = false
  }
  else if (fileType === "xlsx") {
    sheetNames.value = Object.keys(fileData.value)
    selectedSheet.value = sheetNames.value[0]
    updateTableFromExcel()
    xlsxDirty.value = false
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

watch(mdText, () => {
  if (data_store.daata?.filetype === "md") mdDirty.value = true
});

watch(jsonEditText, () => {
  if (data_store.daata?.filetype === "json") jsonDirty.value = true
});

/**
 * Updates columnDefs for AG Grid data from an .xlsx file is loaded or when user selects a sheet.
 */
function updateTableFromExcel() {
  const sheetObj = fileData.value?.[selectedSheet.value]
  const cols = sheetObj?.columns ?? []
  const rows = sheetObj?.rows ?? []

  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      cellClass: "bg-gray-50 font-medium text-left"
    },
    ...cols.map(col => ({
      headerName: col,
      field: col,
      minWidth: 100,
      editable: true
    }))
  ]

  rowData.value = rows
}

/**
 * Updates columnDefs for AG Grid when data from a .csv file is loaded.
 */
function updateTableFromCsv() {
  const cols = fileData.value?.columns ?? []
  const rows = fileData.value?.rows ?? []

  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      cellClass: "bg-gray-50 font-medium text-left"
    },
    ...cols.map(col => ({
      headerName: col,
      field: col,
      minWidth: 100,
      editable: true
    }))
  ]

  rowData.value = rows
}

function newSheetSelected(event) {
  selectedSheet.value = event
  updateTableFromExcel()
}

function rowsToColumns(rows) {
  if (!rows || rows.length === 0) return {}
  const cols = Object.keys(rows[0])
  const out = {}
  for (const c of cols) out[c] = []
  for (const r of rows) {
    for (const c of cols) out[c].push(r[c])
  }
  return out
}

async function saveCurrentFile() {
  if (!data_store.fpath) {
    notify.show("No file path available to save.", 3000, "error")
    return
  }

  const filetype = data_store.daata?.filetype

  let payloadType = null
  let payloadData = null
  let dirtyRef = null

  if (filetype === "md") {
    payloadType = "md"
    payloadData = { text: mdText.value }
    dirtyRef = mdDirty
  } else if (filetype === "csv") {
    payloadType = "csv"
    if (!gridApi.value) {
      notify.show("Grid not ready yet.", 3000, "error")
      return
    }
    gridApi.value.stopEditing()

    const rows = []
    gridApi.value.forEachNode(node => rows.push(node.data))
    payloadData = rows
    dirtyRef = csvDirty
  } else if (filetype === "json") {
    payloadType = "json"

    // validate before sending
    let parsed
    try {
      parsed = JSON.parse(jsonEditText.value)
    } catch (e) {
      notify.show(`Invalid JSON: ${e}`, 5000, "error")
      return
    }

    payloadData = parsed
    dirtyRef = jsonDirty
  } else if (filetype === "xlsx") {
    payloadType = "xlsx"
    if (!gridApi.value) {
      notify.show("Grid not ready yet.", 3000, "error")
      return
    }
    gridApi.value.stopEditing()

    const rows = []
    gridApi.value.forEachNode(node => rows.push(node.data))
    payloadData = rows
    dirtyRef = null // handled per sheet

    const sheetObj = fileData.value?.[selectedSheet.value]
    const cols = sheetObj?.columns ?? []

    saving.value = true
    const r = await postSaveFile(
      data_store.fpath,
      payloadType,
      payloadData,
      { sheet: selectedSheet.value, columns: cols },
      notify
    )
    saving.value = false

    if (r.success) {
      clearXlsxDirty(selectedSheet.value)
      notify.show("Saved", 2000, "info")
    }
    return
  } else {
    notify.show(`Save not implemented for ${filetype}`, 3000, "error")
    return
  }

  saving.value = true
  const r = await postSaveFile(
    data_store.fpath,
    payloadType,
    payloadData,
    meta,
    notify
  )
  saving.value = false

  if (r.success) {
    dirtyRef.value = false
    notify.show("Saved", 2000, "info")
  }
}

</script>

<template>
  <Spinner v-if="data_store.loading" message="Loading data..." class="col-auto"/>
  <div v-else>
    <div class="mb-3 text-lg font-semibold text-gray-800">
      Data Editor
    </div>
    <div class="flex items-center justify-between text-gray-600 my-2 mb-4">
      <div class="truncate">{{ data_store.fname }}</div>

      <button
        v-if="['md','csv','json', 'xlsx'].includes(data_store.daata?.filetype)"
        class="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
        :disabled="(data_store.daata?.filetype === 'md' && !mdDirty)
        || (data_store.daata?.filetype === 'csv' && !csvDirty)
        || (data_store.daata?.filetype === 'json' && !jsonDirty)
        || (data_store.daata?.filetype === 'xlsx' && !currentXlsxDirty) 
        || saving"
        @click="saveCurrentFile"
      >
        {{ saving ? "Saving..." : "Save" }}
      </button>
    </div>

    <div v-if="data_store.daata?.filetype === 'md' && mdDirty" class="text-xs text-gray-500 mb-2">
      Unsaved changes
    </div>
    <div v-if="data_store.daata?.filetype === 'csv' && csvDirty" class="text-xs text-gray-500 mb-2">
      Unsaved changes
    </div>
    <div v-if="data_store.daata?.filetype === 'json' && jsonDirty" class="text-xs text-gray-500 mb-2">
      Unsaved changes
    </div>
    <div v-if="data_store.daata?.filetype === 'xlsx' && currentXlsxDirty" class="text-xs text-gray-500 mb-2">
      Unsaved changes in {{ selectedSheet }}
    </div>

  <SelectSheetButtons
      v-if="selectedSheet.length > 0"
      :sheets="sheetNames"
      :activeIndex="0"
      :activeSheet="selectedSheet"
      @update:activeSheet="newSheetSelected($event)" />
  <textarea
    v-if="data_store.daata?.filetype === 'md'"
    v-model="mdText"
    class="w-full h-80 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
  />
  <textarea
    v-if="data_store.daata?.filetype === 'json'"
    v-model="jsonEditText"
    class="w-full h-80 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
  />
    <!-- // ?? {} is a nullish coalescing operator, so if column_name_and_data is null or undefined, it falls back to {} -->
  <div class="w-full h-80 overflow-auto" v-if="Object.keys(columnDefs ?? {}).length !== 0">
    <AgGridVue
        class="w-full h-full"
        :domLayout="'normal'"
        :columnDefs="columnDefs"
        :rowData="rowData"
        @grid-ready="onGridReady"
        @cell-value-changed="onCellValueChanged"
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
    <div v-else class="p-4 text-gray-500">
      {{ hasWorkFolders ? "Select a file to view data." : "Create a new project to begin." }}
    </div>
  </div>
</template>
