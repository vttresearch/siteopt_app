<script setup>
import { ref, watch, computed, nextTick } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import { useTableDataStore } from "@/stores/filedatastore.js";
import Spinner from "@/components/Spinner.vue";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postSaveFile } from "@/utils/functions.js";
import { useSettingStore } from "@/stores/settingstore.js";
import TimeSeriesChart from "@/components/TimeSeriesChart.vue";
import { detectTimeSeriesStructure } from "@/utils/chartUtils.js";

const data_store = useTableDataStore();
const notify = useNotificationStore();
const settingStore = useSettingStore();

const sheetNames = ref([]);
const selectedSheet = ref("");
const fileData = ref({});
const rowData = ref([]);
const columnDefs = ref([]);
const mdText = ref("");
const jsonEditText = ref("");
const gridApi = ref(null);

const saving = ref(false);
const mdDirty = ref(false);
const csvDirty = ref(false);
const jsonDirty = ref(false);
const xlsxDirtyBySheet = ref({});

const activeView = ref("editor"); // "editor" | "plot"

const currentXlsxDirty = computed(() => !!xlsxDirtyBySheet.value[selectedSheet.value]);

const hasWorkFolders = computed(() => Object.keys(settingStore.workFolders ?? {}).length > 0);

const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(plotRows.value);
  return structure?.isTimeSeries ?? false;
});

function onGridReady(params) {
  gridApi.value = params.api;
}

function onCellValueChanged() {
  const ft = data_store.daata?.filetype;
  if (ft === "csv") csvDirty.value = true;
  if (ft === "xlsx") markXlsxDirty();
}

function clearRefs() {
  sheetNames.value = [];
  selectedSheet.value = "";
  fileData.value = {};
  rowData.value = [];
  columnDefs.value = [];
  mdText.value = "";
  jsonEditText.value = "";
  mdDirty.value = false;
  csvDirty.value = false;
  jsonDirty.value = false;
  xlsxDirtyBySheet.value = {};
  activeView.value = "editor";
}

function markXlsxDirty() {
  const s = selectedSheet.value;
  if (!s) return;
  xlsxDirtyBySheet.value = { ...xlsxDirtyBySheet.value, [s]: true };
}

function clearXlsxDirty(sheet) {
  xlsxDirtyBySheet.value = { ...xlsxDirtyBySheet.value, [sheet]: false };
}

function updateTableFromExcel() {
  const sheetObj = fileData.value?.[selectedSheet.value];
  const cols = sheetObj?.columns ?? [];
  const rows = sheetObj?.rows ?? [];

  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      cellClass: "bg-gray-50 font-medium text-left",
      editable: false,
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

function updateTableFromCsv() {
  const cols = fileData.value?.columns ?? [];
  const rows = fileData.value?.rows ?? [];

  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      cellClass: "bg-gray-50 font-medium text-left",
      editable: false,
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
  selectedSheet.value = sheetName;
  updateTableFromExcel();
  await nextTick();

  if (activeView.value === "plot" && !isTimeSeriesData.value) {
    activeView.value = "editor";
  }
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
    const out = { ...r };
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (looksLikeExcelDateNumber(v)) out[k] = excelSerialToISO(v);
    }
    return out;
  });
});


watch(
  () => data_store.daata,
  async (newItems) => {
    if (!newItems || Object.keys(newItems).length === 0) {
      clearRefs();
      return;
    }

    const fileType = newItems.filetype;
    fileData.value = newItems.data;

    mdDirty.value = false;
    csvDirty.value = false;
    jsonDirty.value = false;

    if (fileType === "xlsx") {
      sheetNames.value = Object.keys(fileData.value ?? {});
      selectedSheet.value = sheetNames.value[0] ?? "";

      const init = {};
      for (const s of sheetNames.value) init[s] = false;
      xlsxDirtyBySheet.value = init;

      updateTableFromExcel();
      await nextTick();

      activeView.value = isTimeSeriesData.value ? "plot" : "editor";
    } else if (fileType === "csv") {
      sheetNames.value = [];
      selectedSheet.value = "";
      xlsxDirtyBySheet.value = {};

      updateTableFromCsv();
      await nextTick();

      activeView.value = isTimeSeriesData.value ? "plot" : "editor";
    } else if (fileType === "json") {
      sheetNames.value = [];
      selectedSheet.value = "";
      xlsxDirtyBySheet.value = {};
      rowData.value = [];
      columnDefs.value = [];
      mdText.value = "";

      try {
        jsonEditText.value = JSON.stringify(fileData.value, null, 2);
      } catch {
        jsonEditText.value = String(fileData.value);
      }

      activeView.value = "editor";
    } else if (fileType === "md") {
      sheetNames.value = [];
      selectedSheet.value = "";
      xlsxDirtyBySheet.value = {};
      rowData.value = [];
      columnDefs.value = [];
      jsonEditText.value = "";

      mdText.value = fileData.value?.text ?? "";
      activeView.value = "editor";
    } else {
      console.warn(`Unsupported fileType: ${fileType}`);
      clearRefs();
    }
  },
  { immediate: true }
);

watch(mdText, () => {
  if (data_store.daata?.filetype === "md") mdDirty.value = true;
});

watch(jsonEditText, () => {
  if (data_store.daata?.filetype === "json") jsonDirty.value = true;
});

async function saveCurrentFile() {
  if (!data_store.fpath) {
    notify.show("No file path available to save.", 3000, "error");
    return;
  }

  const filetype = data_store.daata?.filetype;

  let payloadType = null;
  let payloadData = null;
  let dirtyRef = null;

  if (filetype === "md") {
    payloadType = "md";
    payloadData = { text: mdText.value };
    dirtyRef = mdDirty;
  } else if (filetype === "csv") {
    payloadType = "csv";
    if (!gridApi.value) {
      notify.show("Grid not ready yet.", 3000, "error");
      return;
    }
    gridApi.value.stopEditing();

    const rows = [];
    gridApi.value.forEachNode((node) => rows.push(node.data));
    payloadData = rows;
    dirtyRef = csvDirty;
  } else if (filetype === "json") {
    payloadType = "json";
    let parsed;
    try {
      parsed = JSON.parse(jsonEditText.value);
    } catch (e) {
      notify.show(`Invalid JSON: ${e}`, 5000, "error");
      return;
    }
    payloadData = parsed;
    dirtyRef = jsonDirty;
  } else if (filetype === "xlsx") {
    payloadType = "xlsx";
    if (!gridApi.value) {
      notify.show("Grid not ready yet.", 3000, "error");
      return;
    }
    gridApi.value.stopEditing();

    const rows = [];
    gridApi.value.forEachNode((node) => rows.push(node.data));
    payloadData = rows;

    const sheetObj = fileData.value?.[selectedSheet.value];
    const cols = sheetObj?.columns ?? [];

    saving.value = true;
    const r = await postSaveFile(
      data_store.fpath,
      payloadType,
      payloadData,
      { sheet: selectedSheet.value, columns: cols },
      notify
    );
    saving.value = false;

    if (r?.success) {
      clearXlsxDirty(selectedSheet.value);
      notify.show("Saved", 2000, "info");
    }
    return;
  } else {
    notify.show(`Save not implemented for ${filetype}`, 3000, "error");
    return;
  }

  const meta = {};
  saving.value = true;
  const r = await postSaveFile(data_store.fpath, payloadType, payloadData, meta, notify);
  saving.value = false;

  if (r?.success) {
    if (dirtyRef) dirtyRef.value = false;
    notify.show("Saved", 2000, "info");
  }
}
</script>

<template>
  <Spinner v-if="data_store.loading" message="Loading data..." class="col-auto" />

  <div v-else>
    <div class="mb-3 text-lg font-semibold text-gray-800">Data Editor</div>

    <!-- View tabs -->
    <div class="flex gap-2 mb-3">
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

    <!-- Header row -->
    <div class="flex items-center justify-between text-gray-600 my-2 mb-4">
      <div class="truncate">{{ data_store.fname }}</div>

      <button
        v-if="['md','csv','json','xlsx'].includes(data_store.daata?.filetype)"
        class="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
        :disabled="
          (data_store.daata?.filetype === 'md' && !mdDirty) ||
          (data_store.daata?.filetype === 'csv' && !csvDirty) ||
          (data_store.daata?.filetype === 'json' && !jsonDirty) ||
          (data_store.daata?.filetype === 'xlsx' && !currentXlsxDirty) ||
          saving
        "
        @click="saveCurrentFile"
      >
        {{ saving ? "Saving..." : "Save" }}
      </button>
    </div>

    <!-- Dirty indicators -->
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

    <!-- EDITOR VIEW -->
    <div v-if="activeView === 'editor'">
      <SelectSheetButtons
        v-if="selectedSheet"
        :sheets="sheetNames"
        :activeIndex="0"
        :activeSheet="selectedSheet"
        @update:activeSheet="newSheetSelected($event)"
      />

      <textarea
        v-if="data_store.daata?.filetype === 'md'"
        v-model="mdText"
        class="w-full h-80 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
      />

      <textarea
        v-else-if="data_store.daata?.filetype === 'json'"
        v-model="jsonEditText"
        class="w-full h-80 overflow-auto bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap"
      />

      <div v-else-if="columnDefs.length" class="w-full h-80 overflow-auto">
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
