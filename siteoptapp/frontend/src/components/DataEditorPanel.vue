<script setup>
import { ref, watch, computed, nextTick, onUnmounted } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import Spinner from "@/components/Spinner.vue";
import TimeSeriesChart from "@/components/TimeSeriesChart.vue";
import CategoryToolbar from "@/components/CategoryToolbar.vue";
import { detectTimeSeriesStructure } from "@/utils/chartUtils.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useSheetStore } from '@/stores/sheetStore';
import { uploadFile, fetchFileContents } from "@/utils/functions.js";

const data_store = useTableDataStore();
const notify = useNotificationStore();
const settingStore = useSettingStore();
const sheetStore = useSheetStore();
const rowData = ref([]);
const columnDefs = ref([]);
const originalText = ref("");
const activeView = ref("editor"); // "editor" | "plot"
const selectedCount = ref(0);
const selected = ref(null);
const selectedFileForUpload = ref(null);

const rowSelectionOptions = {
  mode: "multiRow",
  enableSelectionWithoutKeys: false,
  enableClickSelection: false,
}

const defaultColDef = {
  editable: true,
  resizable: true,
  suppressKeyboardEvent: (params) => {
    const key = params.event?.key

    // Let our custom cellKeyDown handler own Delete
    if (key === "Delete") {
      return true
    }

    // Let our custom shortcut own Ctrl+Enter
    if (key === "Enter" && params.event?.ctrlKey) {
      return true
    }

    return false
  }
}

const hasSelection = computed(() => selectedCount.value > 0);
const hasWorkFolders = computed(() => Object.keys(settingStore.workFolders ?? {}).length > 0);

function markDirty() {
  // .md editor does not use grid, so it's ignored here
  const t = data_store.daata?.filetype
  if (t === 'csv') csvDirty.value = true
  else if (t === 'json') jsonDirty.value = true
  else if (t === 'xlsx') markXlsxDirty();
}
function markXlsxDirty() {
  sheetStore.markDirty(sheetStore.activeSheet, true)
  sheetStore.toggleSheetDataUpdated()
  xlsxDirty.value = true
}

function clearXlsxDirty() {
  Object.keys(sheetStore.sheetsByName).forEach((key) => sheetStore.markDirty(key, false))
  sheetStore.toggleSheetDataUpdated()
  xlsxDirty.value = false
}

const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(plotRows.value);
  return structure?.isTimeSeries ?? false;
});

onUnmounted(() => {
  data_store.unregisterGridApi(data_store.gridApi)
})

function onGridReady(params) {
  data_store.registerGridApi(params.api)

  // Update selection count reactively
  params.api.addEventListener('selectionChanged', () => {
    selectedCount.value = params.api.getSelectedRows().length
  })
  // keyboard shortcuts for adding & removing rows
  params.api.addEventListener('cellKeyDown', (e) => {
    // Ctrl+Enter → add row
    if (e.event?.ctrlKey && e.event?.key === 'Enter') {
      onAddRow()
    }
    // Delete key → clear selected/focused cells
    if (e.event?.key === 'Delete') {
      if (e.api.getEditingCells?.().length) return

      const cleared = clearSelectionOrFocusedCell(e.api)
      if (cleared) {
        e.event.preventDefault()
        e.event.stopPropagation()
      }
    }
  })
}

function onCellValueChanged() {
  markDirty()
}

function clearRefs() {
  rowData.value = [];
  columnDefs.value = [];
  originalText.value = "";
  // Clear these manually because data_store.clear() causes a circular watcher loop because it clears data_store.daata
  data_store.fname = ""
  data_store.fpath = ""
  data_store.mdDirty = false;
  data_store.csvDirty = false;
  data_store.jsonDirty = false;
  data_store.xlsxDirty = false;
  data_store.globalDirty = false
  data_store.mdText = "";
  data_store.jsonEditText = "";

}

// --- Add row ---
function createBlankRow(newIndex) {
  // Build a blank object that contains all data fields from columnDefs
  const row = {__id: String(newIndex)}
  return row
}

// Rebuilds rowData from currently displayed rows
function syncRowDataFromGrid() {
  const api = data_store.gridApi
  const count = api.getDisplayedRowCount()
  const rows = []
  for (let i = 0; i < count; i++) {
    rows.push(api.getDisplayedRowAtIndex(i).data)
  }
  rowData.value = rows
}

/* Adds a new row */
function onAddRow() {
  const api = data_store.gridApi
  if (!api) return

  const newRow = createBlankRow(api.getDisplayedRowCount())
  api.applyTransaction({ add: [newRow] })
  syncRowDataFromGrid()
  data_store.markDirty()

  nextTick(() => {
    const lastIndex = api.getDisplayedRowCount() - 1
    if (lastIndex < 0) return

    const firstEditableField = columnDefs.value.find(
      c => c.field && c.field !== "__id" && c.editable !== false
    )?.field

    if (!firstEditableField) return

    api.ensureIndexVisible(lastIndex, "bottom")
    api.setFocusedCell(lastIndex, firstEditableField)
  })
}

/* Deletes selected rows */
function onDeleteSelected() {
  if (!data_store.gridApi) return
  const selected = data_store.gridApi.getSelectedRows()
  if (!selected?.length) return
  // Remove from grid using a transaction
  data_store.gridApi.applyTransaction({ remove: selected })
  // Keep backing data in sync
  const rows = []
  data_store.gridApi.forEachNodeAfterFilterAndSort((node) => {
    rows.push(node.data)
  })
  rowData.value = rows
  data_store.markDirty()
}

/* Custom data type detector for Excel data.
* If any row contains a string -> all cells in the column are strings.
* If row has only numbers -> all cells in the column are numbers.
* */
function detectColumnDataType(rows, col) {
  let allNumeric = true
  for (const row of rows) {
    const value = row[col]
    // Skip null or empty cells
    if (value == null || value === "") continue
    // Check if numeric
    if (typeof value === "number") continue
    if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) continue
    // If we reach here → value is string-like
    allNumeric = false
    break
  }
  return allNumeric ? "number" : "text"
}

function updateTableWithActiveSheet() {
  const sheetObj = sheetStore.sheetsByName[sheetStore.activeSheet] || {}
  const cols = sheetObj.columns ?? []  // Columns
  const validationsByColumn = sheetObj.columns?.validationsByColumn || {}
  let rows = sheetObj.rows || []
  // Add row numbers
  rows = rows.map((r, i) => ({ __id: String(i), ...r }))
  // Build AG Grid columns
  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 60,
      pinned: "left",
      editable: false,
      sortable: false,
      filter: false,
      cellClass: "bg-blue-50 font-light text-xs text-left",
    },
    ...cols.map(col => {
      const validationOptions = validationsByColumn[col]
      // Detect data type from all rows
      const dataType = detectColumnDataType(rows, col)
      if (Array.isArray(validationOptions) && validationOptions.length > 0) {
        return {
          headerName: col,
          field: col,
          minWidth: 120,
          editable: true,
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: validationOptions },
          cellDataType: 'text',
          cellClass: "bg-blue-50 ag-cell-dropdown",
          headerClass: "ag-header-dropdown",
          headerTooltip: "Select from predefined values",
        }
      }
      return {
        headerName: col,
        field: col,
        minWidth: 100,
        editable: true,
        cellDataType: dataType,
      }
    })
  ]
  // Update grid's reactive data source
  rowData.value = rows
}

function updateTableFromCsv(fileData) {
  const cols = fileData?.columns ?? [];
  let rows = fileData?.rows ?? [];
  rows = rows.map((r, i) => ({ __id: String(i), ...r }));
  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 50,
      pinned: "left",
      editable: false,
      sortable: false,
      filter: false,
      cellClass: "bg-blue-50 font-light text-xs text-left",
    },
    ...cols.map((col) => ({
      headerName: col,
      field: col,
      minWidth: 100,
      editable: true,
    })),
  ];
  rowData.value = rows;
}

async function newSheetSelected(sheetName) {
  const api = data_store.gridApi
  const prev = sheetStore.activeSheet
  // Save current sheet before switching
  if (prev && api) {
    sheetStore.captureFromGrid(prev, api)
  }
  // Switch sheet
  sheetStore.setActiveSheet(sheetName)
  // Apply sheet data from store
  updateTableWithActiveSheet()
  await nextTick()
  sheetStore.toggleSheetDataUpdated()
}

function looksLikeExcelDateNumber(n) {
  return typeof n === "number" && n > 20000 && n < 80000;
}

function excelSerialToISO(n) {
  const ms = (n - 25569) * 86400 * 1000;
  return new Date(ms).toISOString();
}

const plotRows = computed(() => {
  return (rowData.value ?? []).map((r) => {
    // Remove __id (i.e. row number) while copying the rest of the fields
    const { __id, ...out } = r;

    for (const k of Object.keys(out)) {
      const v = out[k];
      if (looksLikeExcelDateNumber(v)) {
        out[k] = excelSerialToISO(v);
      }
    }

    return out;
  });
});

function getEditableFieldIds() {
  return columnDefs.value
    .filter(col => col.field && col.field !== "__id" && col.editable !== false)
    .map(col => col.field)
}

function clearCellValue(rowNode, field) {
  if (!rowNode || !field || field === "__id") return false

  // Use "" for blank spreadsheet-like values in CSV/JSON editing.
  // If you prefer AG Grid's default delete semantics, change this to null.
  rowNode.setDataValue(field, "")
  return true
}

function clearSelectedRows(api) {
  const editableFields = getEditableFieldIds()
  const selectedNodes = []

  api.forEachNodeAfterFilterAndSort((node) => {
    if (node.isSelected?.()) selectedNodes.push(node)
  })

  if (!selectedNodes.length) return false

  let changed = false

  for (const node of selectedNodes) {
    for (const field of editableFields) {
      changed = clearCellValue(node, field) || changed
    }
  }

  if (changed) markDirty()
  return changed
}


function clearFocusedCell(api) {
  const focused = api.getFocusedCell()
  if (!focused) return false

  const field = focused.column?.getColId?.()
  if (!field || field === "__id") return false

  const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex)
  const changed = clearCellValue(rowNode, field)

  if (changed) markDirty()
  return changed
}

function clearSelectionOrFocusedCell(api) {
  if (clearSelectedRows(api)) return true
  return clearFocusedCell(api)
}

/* Clears everything when selected project changes */
watch(() => settingStore.activeProjectIndex, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    clearRefs()
    activeView.value = "editor"
  }
})

watch(() => data_store.daata,
  async (newItems) => {
    if (!newItems || Object.keys(newItems).length === 0) {
      clearRefs()
      return
    }
    sheetStore.clearAllSheets()  // important!
    const fileType = newItems.filetype
    const fileData = newItems.data
    if (fileType === 'xlsx') {
      const sheetNames = Object.keys(fileData || {})
      sheetStore.setActiveSheet(sheetNames[0] || "")

      for (const s of sheetNames) {
        const raw = fileData[s]
        const rows = Array.isArray(raw) ? raw : (raw?.rows || [])
        const columns = Array.isArray(raw) ? raw : (raw?.columns || [])
        const meta = Array.isArray(raw) ? {} : (raw?.meta || {})
        sheetStore.upsertSheet(s, rows, columns, meta, false)
      }
      updateTableWithActiveSheet()
      await nextTick()
      sheetStore.toggleSheetDataUpdated()
    }
    else if (fileType === "csv") {
      updateTableFromCsv(fileData);
      await nextTick();
      // Don't set activeView here so that the UI stays in previous view. Plot view, when switching between csv files
    }
    else if (fileType === "json") {
      rowData.value = [];
      columnDefs.value = [];
      data_store.mdText = "";
      try {
        jsonEditText.value = JSON.stringify(fileData, null, 2);
      }
      catch {
        jsonEditText.value = String(fileData);
      }
      originalText.value = data_store.jsonEditText
      activeView.value = "editor";
    }
    else if (fileType === "md") {
      rowData.value = [];
      columnDefs.value = [];
      jsonEditText.value = "";
      mdText.value = fileData?.text ?? "";
      originalText.value = mdText.value
      activeView.value = "editor";
    }
    else {
      console.warn(`Unsupported fileType: ${fileType}`);
      clearRefs();
    }
  },
  { immediate: true }
);

watch(() => data_store.mdText, (editedText) => {
  if (data_store.daata?.filetype === "md" && editedText !== originalText.value) {
    data_store.mdDirty = true
    data_store.globalDirty = true
  }
});

watch(() => data_store.jsonEditText, (editedText) => {
  if (data_store.daata?.filetype === "json" && editedText !== originalText.value) {
    data_store.jsonDirty = true
    data_store.globalDirty = true
  }
});

async function onSaveClick() {
  await data_store.saveCurrentFile({ notify })
}

function handleFileSelect(event) {
  selectedFileForUpload.value = event.target.files[0];
}

async function uploadAndReplace() {
  if (!selectedFileForUpload.value) return;
  if (!data_store.fpath) return;
  const fpath = data_store.fpath
  const fname = data_store.fname
  if (selectedFileForUpload.value.name !== fname) {
    notify.show(`Uploaded file name must match the current file name (${fname})`, 5000, "error")
    return
  }
  const formData = new FormData();
  formData.append("file", selectedFileForUpload.value)
  formData.append("fpath", fpath)
  const success = await uploadFile(formData, notify)
  if (!success) {
    return
  }
  notify.show(`File ${fname} has been replaced`, 8000, "info")
  // Reload file (same as categoryToolbar.fetchFileContents()
  await fetchFileContents(fname, fpath)
}
</script>

<template>

  <div class="mb-3 text-lg font-semibold text-gray-800">Data Editor</div>
  <CategoryToolbar />

  <!-- View tabs, file name and save button -->
  <div class="flex items-center justify-between text-gray-600 my-2 mb-2">

    <div class="flex justify-start gap-2">
      <button
          class="px-3 py-1 rounded border cursor-pointer"
          :class="activeView === 'editor' ? 'bg-blue-600 text-white' : 'bg-white'"
          @click="activeView = 'editor'"
      >
        Editor
      </button>

      <button
          class="px-3 py-1 rounded border disabled:opacity-50 cursor-pointer"
          :class="activeView === 'plot' ? 'bg-blue-600 text-white' : 'bg-white'"
          @click="activeView = 'plot'"
          :disabled="!isTimeSeriesData"
          title="Requires a time/date column + numeric columns"
      >
        Plot
      </button>
    </div>

    <div class="flex justify-center flex-1 text-center">
      <div class="truncate">{{ data_store.fname }}
        <span v-if="data_store.daata?.filetype === 'md' && data_store.mdDirty">*</span>
        <span v-else-if="data_store.daata?.filetype === 'csv' && data_store.csvDirty">*</span>
        <span v-else-if="data_store.daata?.filetype === 'json' && data_store.jsonDirty">*</span>
        <span v-else-if="data_store.daata?.filetype === 'xlsx' && data_store.xlsxDirty">*</span>
      </div>
    </div>

    <div class="flex justify-end gap-5">
      <button
          v-if="['md','csv','json','xlsx'].includes(data_store.daata?.filetype)"
          class=" cursor-pointer px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          :disabled="
          (data_store.daata?.filetype === 'md' && !data_store.mdDirty) ||
          (data_store.daata?.filetype === 'csv' && !data_store.csvDirty) ||
          (data_store.daata?.filetype === 'json' && !data_store.jsonDirty) ||
          (data_store.daata?.filetype === 'xlsx' && !data_store.xlsxDirty) ||
          data_store.saving"
          @click="onSaveClick"
      >
        {{ data_store.saving ? "Saving..." : "Save" }}
      </button>

      <input
          v-if="data_store.fname"
          type="file"
          @change="handleFileSelect"
          class="block w-auto text-sm text-gray-800 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0
          file:bg-blue-600 file:text-white file:text-base hover:file:bg-blue-700 cursor-pointer"/>
      <button
          v-if="data_store.fname"
          :disabled="!selectedFileForUpload"
          class="cursor-pointer px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          @click="uploadAndReplace"
      >
        Replace
      </button>
    </div>
  </div>

  <div v-if="data_store.loading" class="w-full h-100 pt-10 flex flex-col">
    <Spinner message="Loading data..." class="col-auto" />
    </div>
  <div v-else>
    <!-- EDITOR VIEW -->
    <div v-if="activeView === 'editor'">
      <textarea
        v-if="data_store.daata?.filetype === 'md' && data_store.mdText"
        v-model="data_store.mdText"
        class="w-full h-100 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
      />

      <textarea
        v-else-if="data_store.daata?.filetype === 'json' && data_store.jsonEditText"
        v-model="data_store.jsonEditText"
        class="w-full h-100 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
      />

      <div v-else-if="columnDefs.length" class="w-full h-100 flex flex-col">
        <!-- Toolbar -->
        <div class="flex items-center gap-2 mt-2 shrink-0">
          <button
              class="px-3 py-1 rounded border border-b-0 border-gray-400 bg-white hover:bg-gray-100"
              @click="onAddRow"
              title="Add a new row at the end">
            + Add row
          </button>
          <button
              class="px-3 py-1 rounded border border-b-0 border-gray-400 bg-white hover:bg-gray-100 disabled:opacity-50"
              :disabled="!hasSelection"
              @click="onDeleteSelected"
              title="Delete selected rows">
            <i class="fa-regular fa-trash-can"></i> Delete selected rows
          </button>
          <span class="text-sm text-gray-500" v-if="selectedCount">
            {{ selectedCount }} selected
          </span>
        </div>

        <!-- Scrollable grid container -->
        <div class="flex-1 overflow-auto">
          <AgGridVue
              class="w-full h-full"
              :columnDefs="columnDefs"
              :defaultColDef="defaultColDef"
              :rowData="rowData"
              @grid-ready="onGridReady"
              @cell-value-changed="onCellValueChanged"
              :rowBuffer="10"
              :rowHeight="35"
              :animateRows="false"
              :rowSelection="rowSelectionOptions"
              :navigateCells="true"
              :suppressCellFocus="false"
              :singleClickEdit="false"
              :stopEditingWhenCellsLoseFocus="true"
              :suppressClickEdit="true"
              :enterNavigatesVertically="true"
              :enterNavigatesVerticallyAfterEdit="true"
              :undoRedoCellEditing="true"
              :undoRedoCellEditingLimit="100"
          />
        </div>
        <!-- Sheets -->
        <div v-if="data_store.daata?.filetype === 'xlsx'">
          <SelectSheetButtons @update:activeSheet="newSheetSelected($event)" />
        </div>

      </div>

      <div v-else class="p-4 text-gray-500">
        {{ hasWorkFolders ? "Select a category and file to view data." : "Create a new project to begin." }}
      </div>
    </div>

    <!-- PLOT VIEW -->
    <div v-else-if="activeView === 'plot'" class="border rounded p-2 bg-white">
      <div v-if="isTimeSeriesData">
        <TimeSeriesChart :data="plotRows" :fileName="data_store.fname" />
      </div>
      <div v-else class="text-gray-500 p-4">
        No time series data detected (needs time/date column + numeric columns).
      </div>
    </div>
  </div>
</template>
