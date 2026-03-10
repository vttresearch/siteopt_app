<script setup>
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import { useTableDataStore } from "@/stores/filedatastore.js";
import Spinner from "@/components/Spinner.vue";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postData } from "@/utils/functions.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useAssistantPlotStore } from "@/stores/assistantplotstore.js";
import TimeSeriesChart from "@/components/TimeSeriesChart.vue";
import { detectTimeSeriesStructure } from "@/utils/chartUtils.js";

const data_store = useTableDataStore();
const notify = useNotificationStore();
const settingStore = useSettingStore();
const assistantPlotStore = useAssistantPlotStore();

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
const hasNewAssistantPlot = ref(false);

const currentXlsxDirty = computed(() => !!xlsxDirtyBySheet.value[selectedSheet.value]);

const hasWorkFolders = computed(() => Object.keys(settingStore.workFolders ?? {}).length > 0);

const activeContextDir = computed(() => {
  const idx = settingStore.activeProjectIndex || 0;
  const folderNames = Object.keys(settingStore.workFolders || {});
  const activeFolderName = folderNames[idx] || null;
  return activeFolderName ? settingStore.workFolders[activeFolderName] || null : null;
});

const assistantPlotPayload = computed(() => assistantPlotStore.getPlot(activeContextDir.value));

const hasAssistantPlot = computed(() => {
  const payload = assistantPlotPayload.value;
  return !!payload && payload.type === "timeseries" && Array.isArray(payload.rows) && payload.rows.length > 0;
});

const groupedAssistantPlots = computed(() => {
  if (!hasAssistantPlot.value) return [];
  const payload = assistantPlotPayload.value;
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const baseTitle = payload?.title || payload?.source_file || "Assistant Plot";
  const xColumn = payload?.x_column || "";
  const seriesColumns = payload?.series_columns || [];

  const hasSummaryColumn = rows.some((row) => row && row.summary !== undefined && row.summary !== null);
  if (!hasSummaryColumn) {
    return [{
      key: "all",
      summaryLabel: "All",
      rows,
      title: baseTitle,
      xColumn,
      seriesColumns,
    }];
  }

  const groups = new Map();
  for (const row of rows) {
    const label = String(row?.summary ?? "Unspecified").trim() || "Unspecified";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(row);
  }

  return Array.from(groups.entries()).map(([summaryLabel, groupedRows]) => ({
    key: summaryLabel,
    summaryLabel,
    rows: groupedRows,
    title: `${baseTitle} — ${summaryLabel}`,
    xColumn,
    seriesColumns,
  }));
});

function handleAssistantPlotReady(event) {
  const detail = event?.detail || {};
  const contextDir = detail.contextDir || null;
  if (!contextDir || contextDir !== activeContextDir.value) {
    return;
  }
  hasNewAssistantPlot.value = true;
  if (hasAssistantPlot.value) {
    activeView.value = "assistantPlot";
  }
}

const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(plotRows.value);
  return structure?.isTimeSeries ?? false;
});

const isPlottableData = computed(() => {
  const rows = plotRows.value || [];
  if (!rows.length) return false;

  const structure = detectTimeSeriesStructure(rows);
  if (structure?.isTimeSeries) return true;

  const columns = Object.keys(rows[0] || {});
  if (!columns.length) return false;
  const sample = rows.slice(0, Math.min(100, rows.length));
  const nonEmpty = (value) => value !== null && value !== undefined && String(value).trim() !== "";
  const numericColumns = columns.filter((column) => {
    const values = sample.map((row) => row[column]).filter(nonEmpty);
    if (!values.length) return false;
    const numericCount = values.filter((value) => !isNaN(parseFloat(value))).length;
    return numericCount / values.length >= 0.6;
  });

  return numericColumns.length > 0 && numericColumns.length < columns.length;
});

const groupedPlotRows = computed(() => {
  const rows = plotRows.value || [];
  if (!rows.length) return [];

  const hasSummaryColumn = rows.some((row) => row && row.summary !== undefined && row.summary !== null);
  if (!hasSummaryColumn) {
    return [{
      key: 'all',
      summaryLabel: 'All',
      rows,
      title: data_store.fname || 'Data Plot',
    }];
  }

  const groups = new Map();
  for (const row of rows) {
    const label = String(row?.summary ?? 'Unspecified').trim() || 'Unspecified';
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(row);
  }

  return Array.from(groups.entries()).map(([summaryLabel, groupedRows]) => ({
    key: summaryLabel,
    summaryLabel,
    rows: groupedRows,
    title: `${data_store.fname || 'Data Plot'} — ${summaryLabel}`,
  }));
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
  const sheetObj = fileData.value?.[selectedSheet.value] ?? {};
  const cols = sheetObj.columns ?? [];
  const rows = sheetObj.rows ?? [];
  const validationsByColumn = sheetObj.validationsByColumn ?? {};

  columnDefs.value = [
    // Row index column
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      cellClass: "bg-gray-50 font-medium text-left",
      editable: false,
    },

    // Data columns
    ...cols.map((col) => {
      const validationOptions = validationsByColumn[col];

      // Excel dropdown → AG Grid select editor
      if (Array.isArray(validationOptions) && validationOptions.length > 0) {
        return {
          headerName: col,
          field: col,
          minWidth: 120,
          editable: true,
          cellEditor: "agSelectCellEditor",
          cellEditorParams: {
            values: validationOptions,
          },
          cellClass: "bg-blue-50 ag-cell-dropdown",
          headerClass: "ag-header-dropdown",
          headerTooltip: "Select from predefined values",
        };
      }

      // Normal editable cell
      return {
        headerName: col,
        field: col,
        minWidth: 100,
        editable: true,
      };
    }),
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

  if (activeView.value === "plot" && !isPlottableData.value) {
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

      activeView.value = isPlottableData.value ? "plot" : "editor";
    } else if (fileType === "csv") {
      sheetNames.value = [];
      selectedSheet.value = "";
      xlsxDirtyBySheet.value = {};

      updateTableFromCsv();
      await nextTick();

      activeView.value = isPlottableData.value ? "plot" : "editor";
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

onMounted(() => {
  window.addEventListener("assistant-plot-ready", handleAssistantPlotReady);
});

onBeforeUnmount(() => {
  window.removeEventListener("assistant-plot-ready", handleAssistantPlotReady);
});

watch(mdText, () => {
  if (data_store.daata?.filetype === "md") mdDirty.value = true;
});

watch(jsonEditText, () => {
  if (data_store.daata?.filetype === "json") jsonDirty.value = true;
});

watch(activeView, (view) => {
  if (view === "assistantPlot") {
    hasNewAssistantPlot.value = false;
  }
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
    const configs = { path: data_store.fpath, filetype: payloadType, payloadData: payloadData, meta: { sheet: selectedSheet.value, columns: cols } }
    const response = await postData("save_file", configs, notify)
    saving.value = false;
    if (!response.success) {
      return
    }
    clearXlsxDirty(selectedSheet.value);
    notify.show("Saved", 2000, "info");
    return
  } else {
    notify.show(`Save not implemented for ${filetype}`, 3000, "error");
    return
  }

  saving.value = true;
  const configs = { path: data_store.fpath, filetype: payloadType, payloadData: payloadData, meta: {} }
  const response = await postData("save_file", configs, notify)
  saving.value = false;
  if (!response.success) {
    return
  }
  if (dirtyRef) dirtyRef.value = false;
  notify.show("Saved", 2000, "info");
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
        :disabled="!isPlottableData"
        title="Requires one category/time column and numeric columns"
      >
        Plot
      </button>

      <button
        class="px-3 py-1 rounded border"
        :class="activeView === 'assistantPlot' ? 'bg-blue-600 text-white' : 'bg-white'"
        @click="activeView = 'assistantPlot'"
        title="Assistant-generated visualization for active project"
      >
        <span>Assistant Plot</span>
        <span
          v-if="hasNewAssistantPlot && activeView !== 'assistantPlot'"
          class="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
        >
          New
        </span>
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
          :singleClickEdit="true"
          :stopEditingWhenCellsLoseFocus="true"
        />
      </div>

      <div v-else class="p-4 text-gray-500">
        {{ hasWorkFolders ? "Select a file to view data." : "Create a new project to begin." }}
      </div>
    </div>

    <!-- PLOT VIEW -->
    <div v-else-if="activeView === 'plot'" class="border rounded p-2 bg-white">
      <div v-if="isPlottableData">
        <div v-if="groupedPlotRows.length === 1">
          <TimeSeriesChart :data="groupedPlotRows[0].rows" :fileName="groupedPlotRows[0].title" />
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="group in groupedPlotRows"
            :key="group.key"
            class="border rounded p-2 bg-white"
          >
            <div class="mb-2 text-sm font-medium text-gray-700">{{ group.summaryLabel }}</div>
            <TimeSeriesChart :data="group.rows" :fileName="group.title" />
          </div>
        </div>
      </div>
      <div v-else class="text-gray-500 p-4">
        No plottable data detected (needs at least one category/time column and numeric columns).
      </div>
    </div>

    <!-- ASSISTANT PLOT VIEW -->
    <div v-else-if="activeView === 'assistantPlot'" class="border rounded p-2 bg-white">
      <div v-if="hasAssistantPlot">
        <div v-if="groupedAssistantPlots.length === 1">
          <TimeSeriesChart
            :data="groupedAssistantPlots[0].rows"
            :fileName="groupedAssistantPlots[0].title"
            :xColumn="groupedAssistantPlots[0].xColumn"
            :seriesColumns="groupedAssistantPlots[0].seriesColumns"
          />
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="group in groupedAssistantPlots"
            :key="group.key"
            class="border rounded p-2 bg-white"
          >
            <div class="mb-2 text-sm font-medium text-gray-700">{{ group.summaryLabel }}</div>
            <TimeSeriesChart
              :data="group.rows"
              :fileName="group.title"
              :xColumn="group.xColumn"
              :seriesColumns="group.seriesColumns"
            />
          </div>
        </div>
      </div>
      <div v-else class="text-gray-500 p-4">
        No assistant-generated plot for the active project yet. Ask Assistant for a visualization first.
      </div>
    </div>
  </div>
</template>
