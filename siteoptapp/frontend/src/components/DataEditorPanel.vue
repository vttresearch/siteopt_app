<script setup>
import { ref, watch, computed, nextTick, shallowRef } from "vue";
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
import { postData } from "@/utils/functions.js";

const data_store = useTableDataStore();
const notify = useNotificationStore();
const settingStore = useSettingStore();
const sheetStore = useSheetStore();
const sheetNames = ref([]);
const fileData = ref({});
const rowData = ref([]);
const columnDefs = ref([]);
const mdText = ref("");
const jsonEditText = ref("");
const originalText = ref("");
const gridApi = shallowRef(null);
const saving = ref(false);
const mdDirty = ref(false);
const csvDirty = ref(false);
const jsonDirty = ref(false);
const xlsxDirty = ref(false);
const activeView = ref("editor"); // "editor" | "plot"
const selectedCount = ref(0);
const selected = ref(null);
const rowSelectionOptions = {
  mode: "multiRow",
  enableSelectionWithoutKeys: false,
  enableClickSelection: false,
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

function clearXlsxDirty(sheet) {
  Object.keys(sheetStore.sheetsByName).forEach((key) => sheetStore.markDirty(key, false))
  sheetStore.toggleSheetDataUpdated()
  xlsxDirty.value = false
}

const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(plotRows.value);
  return structure?.isTimeSeries ?? false;
});

function onGridReady(params) {
  gridApi.value = params.api

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
    // Delete key → delete selected
    if (e.event?.key === 'Delete') {
      onDeleteSelected()
    }
  })
}

function onCellValueChanged() {
  markDirty()
}

// Returns next cell if available
const getNextCellSameRow = (params) => {
  const api = params.api;
  const columns = api.getAllDisplayedColumns();
  const prev = params.previousCellPosition;
  const colIndex = columns.findIndex(c => c.getId() === prev.column.getId());
  const nextIndex = colIndex + 1;
  // If last column, stay on same cell
  if (nextIndex >= columns.length) {
    return {
      rowIndex: prev.rowIndex,
      column: prev.column
    };
  }
  return {
    rowIndex: prev.rowIndex,
    column: columns[nextIndex]
  };
};

// Called when pressing Tab
const tabToNextCell = (params) => {
  return getNextCellSameRow(params);
};

// On Enter, stop editing, on Tab, move to next cell and start editing
const onCellKeyDown = (params) => {
  const key = params.event.key;
  if (key === 'Enter') {
    params.api.stopEditing()
    return
  }
  if (key === 'Tab') {
    setTimeout(() => {
      const cell = params.api.getFocusedCell();
      if (!cell) return;

      params.api.startEditingCell({
        rowIndex: cell.rowIndex,
        colKey: cell.column.getId()
      });
    });
  }
};

function clearRefs() {
  sheetNames.value = [];
  fileData.value = {};
  rowData.value = [];
  columnDefs.value = [];
  mdText.value = "";
  jsonEditText.value = "";
  originalText.value = "";
  mdDirty.value = false;
  csvDirty.value = false;
  jsonDirty.value = false;
  xlsxDirty.value = false;
  activeView.value = "editor";
  // Clear these manually because data_store.clear() causes a circular watcher loop because it clears data_store.daata
  data_store.fname = ""
  data_store.fpath = ""
  data_store.dirty = false
}

// --- Add row ---
function createBlankRow(newIndex) {
  // Build a blank object that contains all data fields from columnDefs
  const row = {__id: String(newIndex)}
  return row
}

// Rebuilds rowData from currently displayed rows
function syncRowDataFromGrid() {
  const api = gridApi.value
  const count = api.getDisplayedRowCount()
  const rows = []
  for (let i = 0; i < count; i++) {
    rows.push(api.getDisplayedRowAtIndex(i).data)
  }
  rowData.value = rows
}

/* Adds a new row */
function onAddRow() {
  const api = gridApi.value
  if (!api) return
  let newIndexId = api.getDisplayedRowCount()
  const newRow = createBlankRow(newIndexId)
  api.applyTransaction({ add: [newRow] })
  syncRowDataFromGrid()
  markDirty()

  // One‑time listener for when AG Grid has finished updating DOM
  const listener = function () {
    api.removeEventListener('rowDataUpdated', listener)
    const lastIndex = api.getDisplayedRowCount() - 1
    if (lastIndex < 0) return
    api.ensureIndexVisible(lastIndex, 'bottom')
    const firstEditableField = columnDefs.value.find(
      c => c.field && c.field !== '__select__' && c.editable !== false
    )?.field
    if (firstEditableField) {
      api.startEditingCell({
        rowIndex: lastIndex,
        colKey: firstEditableField
      })
    }
  }
  api.addEventListener('rowDataUpdated', listener)
}

/* Deletes selected rows */
function onDeleteSelected() {
  if (!gridApi.value) return
  const selected = gridApi.value.getSelectedRows()
  if (!selected?.length) return
  // Remove from grid using a transaction
  gridApi.value.applyTransaction({ remove: selected })
  // Keep backing data in sync
  const rows = []
  gridApi.value.forEachNodeAfterFilterAndSort((node) => {
    rows.push(node.data)
  })
  rowData.value = rows
  markDirty()
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
      if (Array.isArray(validationOptions) && validationOptions.length > 0) {
        return {
          headerName: col,
          field: col,
          minWidth: 120,
          editable: true,
          cellEditor: "agSelectCellEditor",
          cellEditorParams: { values: validationOptions },
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
      }
    })
  ]
  // Update grid's reactive data source
  rowData.value = rows
}

function updateTableFromCsv() {
  const cols = fileData.value?.columns ?? [];
  let rows = fileData.value?.rows ?? [];
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
  const api = gridApi.value
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
  // Enable editor or plot view
  if (activeView.value === "plot" && !isTimeSeriesData.value) {
    activeView.value = "editor"
  }
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

/* Clears everything when selected project changes */
watch(() => settingStore.activeProjectIndex, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    clearRefs()
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
    fileData.value = newItems.data
    if (fileType === 'xlsx') {
      sheetNames.value = Object.keys(fileData.value || {})
      sheetStore.setActiveSheet(sheetNames.value[0] || "")  // Select first sheet
      // Load all sheets into the store
      for (const s of sheetNames.value) {
        const raw = fileData.value[s]
        const rows = Array.isArray(raw) ? raw : (raw?.rows || [])
        const columns = Array.isArray(raw) ? raw : (raw?.columns || [])
        const meta = Array.isArray(raw) ? {} : (raw?.meta || {})
        sheetStore.upsertSheet(s, rows, columns, meta, false)
      }
      updateTableWithActiveSheet()
      await nextTick()
      activeView.value = isTimeSeriesData.value ? "plot" : "editor"
      sheetStore.toggleSheetDataUpdated()
    }
    else if (fileType === "csv") {
      sheetNames.value = [];
      updateTableFromCsv();
      await nextTick();
      activeView.value = isTimeSeriesData.value ? "plot" : "editor";
    }
    else if (fileType === "json") {
      sheetNames.value = [];
      rowData.value = [];
      columnDefs.value = [];
      mdText.value = "";
      try {
        jsonEditText.value = JSON.stringify(fileData.value, null, 2);
      }
      catch {
        jsonEditText.value = String(fileData.value);
      }
      originalText.value = jsonEditText.value
      activeView.value = "editor";
    }
    else if (fileType === "md") {
      sheetNames.value = [];
      rowData.value = [];
      columnDefs.value = [];
      jsonEditText.value = "";
      mdText.value = fileData.value?.text ?? "";
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

watch(mdText, (editedText) => {
  if (editedText !== originalText.value) {
    if (data_store.daata?.filetype === "md") mdDirty.value = true;
    }
});

watch(jsonEditText, (editedText) => {
  if (editedText !== originalText.value) {
    if (data_store.daata?.filetype === "json") jsonDirty.value = true;
  }
});

async function saveCurrentFile() {
  if (!data_store.fpath) {
    notify.show("No file path available to save.", 3000, "error");
    return;
  }
  const filetype = data_store.daata?.filetype;

  function filterIdFromRows(rows) {
    /* Removes __id from all rows.
    rows is a list of objects eg.
    rows = [{ __id: 0 , scenario: Base }, { __id: 1, scenario: Myscen }]
    */
    let newRows = []
    for (let i=0; i < rows.length; i++) {
      if ("__id" in rows[i]) {
        const {__id, ...newRow} = rows[i]
        newRows[i] = newRow
      }
      else {
        newRows[i] = rows[i]
      }
    }
    return newRows
  }

  if (filetype === "md") {
    saving.value = true;
    const response = await postData("save_file", {
      path: data_store.fpath,
      filetype: "md",
      payloadData: { text: mdText.value },
      meta: {}
    }, notify)

    saving.value = false;
    if (response.success) mdDirty.value = false;
    notify.show("Saved", 2000, "info");
    return;
  }

  if (filetype === "csv") {
    if (!gridApi.value) return notify.show("Grid not ready yet.", 3000, "error");
    gridApi.value.stopEditing();

    let rows = [];
    gridApi.value.forEachNode(node => rows.push(node.data));
    rows = filterIdFromRows(rows)
    saving.value = true;
    const response = await postData("save_file", {
      path: data_store.fpath,
      filetype: "csv",
      payloadData: rows,
      meta: {}
    }, notify)

    saving.value = false;
    if (response.success) csvDirty.value = false;
    notify.show("Saved", 2000, "info");
    return;
  }

  if (filetype === "json") {
    let parsed;
    try { parsed = JSON.parse(jsonEditText.value); }
    catch (e) {
      return notify.show(`Invalid JSON: ${e}`, 5000, "error");
    }

    saving.value = true;
    const response = await postData("save_file", {
      path: data_store.fpath,
      filetype: "json",
      payloadData: parsed,
      meta: {}
    }, notify)

    saving.value = false;
    if (response.success) jsonDirty.value = false;
    notify.show("Saved", 2000, "info");
    return;
  }

  if (filetype === "xlsx") {
    const api = gridApi.value;
    if (!api) return notify.show("Grid not ready yet.", 3000, "error");
    // Stop edit mode
    api.stopEditing();
    // Capture current sheet into store
    sheetStore.captureFromGrid(sheetStore.activeSheet, api);
    // Build workbook payload (contains data from all sheets)
    const workbook = {};
    for (const [sheetName, sheetObj] of Object.entries(sheetStore.sheetsByName)) {
      let rows = filterIdFromRows(sheetObj.rows)
      workbook[sheetName] = {
        rows: rows,
        columns: sheetObj.columns,
        meta: sheetObj.meta
      };
    }
    saving.value = true;
    const response = await postData("save_file", {
      path: data_store.fpath,
      filetype: "xlsx",
      payloadData: workbook,
      meta: {}
    }, notify)
    saving.value = false;
    if (!response.success) return;
    // Clear dirty flags for all sheets
    clearXlsxDirty()
    notify.show("Saved all sheets", 2000, "info");
    return;
  }
  notify.show(`Save not implemented for ${filetype}`, 3000, "error");
}
</script>

<template>

  <div class="mb-3 text-lg font-semibold text-gray-800">Data Editor</div>
  <CategoryToolbar />

  <!-- View tabs -->
  <div class="flex gap-2 my-3">
    <button
      class="px-3 py-1 rounded border"
      :class="activeView === 'editor' ? 'bg-blue-600 text-white' : 'bg-white'"
      @click="activeView = 'editor'"
    >
      Editor
    </button>

    <button
      class="px-3 py-1 rounded border disabled:opacity-50"
      :class="activeView === 'plot' ? 'bg-blue-600 text-white' : 'bg-white'"
      @click="activeView = 'plot'"
      :disabled="!isTimeSeriesData"
      title="Requires a time/date column + numeric columns"
    >
      Plot
    </button>
  </div>

  <Spinner v-if="data_store.loading" message="Loading data..." class="col-auto" />

  <div v-else>

    <!-- Header row -->
    <div class="flex items-center justify-between text-gray-600 my-2 mb-2">
      <div class="truncate">{{ data_store.fname }}
        <span v-if="data_store.daata?.filetype === 'md' && mdDirty">*</span>
        <span v-else-if="data_store.daata?.filetype === 'csv' && csvDirty">*</span>
        <span v-else-if="data_store.daata?.filetype === 'json' && jsonDirty">*</span>
        <span v-else-if="data_store.daata?.filetype === 'xlsx' && xlsxDirty">*</span>
      </div>

      <button
        v-if="['md','csv','json','xlsx'].includes(data_store.daata?.filetype)"
        class="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
        :disabled="
          (data_store.daata?.filetype === 'md' && !mdDirty) ||
          (data_store.daata?.filetype === 'csv' && !csvDirty) ||
          (data_store.daata?.filetype === 'json' && !jsonDirty) ||
          (data_store.daata?.filetype === 'xlsx' && !xlsxDirty) ||
          saving
        "
        @click="saveCurrentFile"
      >
        {{ saving ? "Saving..." : "Save" }}
      </button>
    </div>

    <!-- EDITOR VIEW -->
    <div v-if="activeView === 'editor'">
      <textarea
        v-if="data_store.daata?.filetype === 'md' && mdText"
        v-model="mdText"
        class="w-full h-80 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
      />

      <textarea
        v-else-if="data_store.daata?.filetype === 'json' && jsonEditText"
        v-model="jsonEditText"
        class="w-full h-80 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
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
            <i class="fa-regular fa-trash-can"></i> Delete selected
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
              :rowData="rowData"
              @grid-ready="onGridReady"
              @cell-value-changed="onCellValueChanged"
              @cell-key-down="onCellKeyDown"
              :rowBuffer="10"
              :rowHeight="35"
              :animateRows="false"
              :rowSelection="rowSelectionOptions"
              :navigateCells="true"
              :suppressCellFocus="false"
              :singleClickEdit="true"
              :stopEditingWhenCellsLoseFocus="true"
              :tabToNextCell="tabToNextCell"
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
