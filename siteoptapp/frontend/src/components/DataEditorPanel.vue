<script setup>
import { ref, computed, reactive } from "vue";
import { AgGridVue } from "ag-grid-vue3";

import CategoryToolbar from "@/components/CategoryToolbar.vue";
import SelectSheetButtons from "@/components/SelectSheetButtons.vue";
import Spinner from "@/components/Spinner.vue";
import TimeSeriesChart from "@/components/TimeSeriesChart.vue";
import { useDataEditorDocument } from "@/composables/useDataEditorDocument.js";
import { useDataEditorGrid } from "@/composables/useDataEditorGrid.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useSheetStore } from "@/stores/sheetStore";
import { detectTimeSeriesStructure } from "@/utils/chartUtils.js";
import {
  createHistoryState,
  clearHistory,
  normalizeRows,
} from "@/utils/dataEditorUtils.js";

const data_store = useTableDataStore();
const notify = useNotificationStore();
const settingStore = useSettingStore();
const sheetStore = useSheetStore();

const rowData = ref([]);
const columnDefs = ref([]);
const selectedCount = ref(0);
const historyState = reactive(createHistoryState());
const showEditorHelp = ref(false);

function getRowId(params) {
  return params.data.__id;
}

function updateTableWithActiveSheet() {
  // The store owns the active sheet contract; the component only turns it into grid rows and columns.
  const sheetRecord = sheetStore.getActiveSheetRecord();
  const rows = normalizeRows(sheetRecord.rows, historyState);

  updateGridColumns({
    rows,
    columns: sheetRecord.columns,
    validationsByColumn: sheetRecord.validationsByColumn,
    fileName: data_store.fname,
    sheetName: sheetStore.activeSheet,
  });

  rowData.value = rows;
}

let documentApi = null;

function markDirty(...args) {
  return documentApi?.markDirty(...args);
}

function onSaveClick(...args) {
  return documentApi?.onSaveClick(...args);
}

const {
  rowSelectionOptions,
  defaultColDef,
  hasSelection,
  updateGridColumns,
  onGridReady,
  onCellValueChanged,
  onCellClicked,
  onAddRow,
  onDeleteSelected,
} = useDataEditorGrid({
  dataStore: data_store,
  notify,
  sheetStore,
  rowData,
  columnDefs,
  historyState,
  selectedCount,
  markDirty,
  onSave: onSaveClick,
});

const {
  activeView,
  selectedFileForUpload,
  newSheetSelected,
  handleFileSelect,
  uploadAndReplace,
} = (documentApi = useDataEditorDocument({
  dataStore: data_store,
  notify,
  settingStore,
  sheetStore,
  rowData,
  columnDefs,
  historyState,
  clearHistory,
  updateTableWithActiveSheet,
}));

const hasWorkFolders = computed(() => Object.keys(settingStore.workFolders ?? {}).length > 0);

function looksLikeExcelDateNumber(n) {
  return typeof n === "number" && n > 20000 && n < 80000;
}

function excelSerialToISO(n) {
  const ms = (n - 25569) * 86400 * 1000;
  return new Date(ms).toISOString();
}

const plotRows = computed(() => {
  return (rowData.value ?? []).map((r) => {
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

const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(plotRows.value);
  return structure?.isTimeSeries ?? false;
});
</script>

<template>
  <div class="mb-3 flex items-center justify-between">
    <div class="text-lg font-semibold text-gray-800">Data Editor</div>
    <button
      class="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-100"
      title="Data editor help"
      aria-label="Open data editor help"
      @click="showEditorHelp = true"
    >
      ?
    </button>
  </div>
  <CategoryToolbar />

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
        v-if="['md', 'csv', 'json', 'xlsx'].includes(data_store.daata?.filetype)"
        class=" cursor-pointer px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
        :disabled="
          (data_store.daata?.filetype === 'md' && !data_store.mdDirty) ||
          (data_store.daata?.filetype === 'csv' && !data_store.csvDirty) ||
          (data_store.daata?.filetype === 'json' && !data_store.jsonDirty) ||
          (data_store.daata?.filetype === 'xlsx' && !data_store.xlsxDirty) ||
          data_store.saving
        "
        @click="onSaveClick"
      >
        {{ data_store.saving ? "Saving..." : "Save" }}
      </button>

      <input
        v-if="data_store.fname"
        type="file"
        @change="handleFileSelect"
        class="block w-auto text-sm text-gray-800 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0
        file:bg-blue-600 file:text-white file:text-base hover:file:bg-blue-700 cursor-pointer"
      />
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
        <div class="flex items-center gap-2 mt-2 shrink-0">
          <button
            class="px-3 py-1 rounded border border-b-0 border-gray-400 bg-white hover:bg-gray-100"
            @click="onAddRow({ mode: 'below-selection' })"
            title="Add a new row at the end"
          >
            + Add row
          </button>
          <button
            class="px-3 py-1 rounded border border-b-0 border-gray-400 bg-white hover:bg-gray-100 disabled:opacity-50"
            :disabled="!hasSelection"
            @click="onDeleteSelected"
            title="Delete selected rows"
          >
            <i class="fa-regular fa-trash-can"></i> Delete selected rows
          </button>
          <span v-if="selectedCount" class="text-sm text-gray-500">
            {{ selectedCount }} selected
          </span>
        </div>

        <div class="flex-1 overflow-auto">
          <AgGridVue
            class="w-full h-full"
            :columnDefs="columnDefs"
            :defaultColDef="defaultColDef"
            :rowData="rowData"
            @grid-ready="onGridReady"
            @cell-clicked="onCellClicked"
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
            :getRowId="getRowId"
          />
        </div>
        <div v-if="data_store.daata?.filetype === 'xlsx'">
          <SelectSheetButtons @update:activeSheet="newSheetSelected($event)" />
        </div>
      </div>

      <div v-else class="p-4 text-gray-500">
        {{ hasWorkFolders ? "Select a category and file to view data." : "Create a new project to begin." }}
      </div>
    </div>

    <div v-else-if="activeView === 'plot'" class="border rounded p-2 bg-white">
      <div v-if="isTimeSeriesData">
        <TimeSeriesChart :data="plotRows" :fileName="data_store.fname" />
      </div>
      <div v-else class="text-gray-500 p-4">
        No time series data detected (needs time/date column + numeric columns).
      </div>
    </div>
  </div>

  <div
    v-if="showEditorHelp"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="data-editor-help-title"
    @click.self="showEditorHelp = false"
  >
    <div class="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-2xl">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 id="data-editor-help-title" class="text-lg font-semibold text-gray-900">
            Data Editor Help
          </h3>
          <p class="mt-1 text-sm text-gray-500">
            Shortcuts and key behaviors for editing tables in the data editor.
          </p>
        </div>
        <button
          class="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close data editor help"
          @click="showEditorHelp = false"
        >
          Close
        </button>
      </div>

      <div class="space-y-5 text-sm text-gray-700">
        <section>
          <div class="mb-2 font-semibold text-gray-900">Basics</div>
          <ul class="space-y-1">
            <li>Edit text cells by clicking or starting to type.</li>
            <li>Validated dropdown cells open from a click and can be cleared back to empty with Delete.</li>
            <li>Numeric fields block invalid characters while typing and accept comma decimals by converting them to dots.</li>
            <li>A star next to the file name means the current file has unsaved changes.</li>
          </ul>
        </section>

        <section>
          <div class="mb-2 font-semibold text-gray-900">Navigation And Editing</div>
          <ul class="space-y-1">
            <li><span class="font-medium">Enter</span>: move down in the grid.</li>
            <li><span class="font-medium">Arrow keys</span>: move between cells.</li>
            <li><span class="font-medium">Delete</span>: clear the focused cell or all editable cells in the selected row or rows.</li>
            <li><span class="font-medium">Esc</span>: leave edit mode without keeping the current cell edit.</li>
          </ul>
        </section>

        <section>
          <div class="mb-2 font-semibold text-gray-900">Rows</div>
          <ul class="space-y-1">
            <li><span class="font-medium">Ctrl+Enter</span>: add a row below the current row or selection.</li>
            <li><span class="font-medium">Ctrl+Shift+Enter</span>: add a row at the bottom of the sheet.</li>
            <li><span class="font-medium">Add row button</span>: adds a row below the selection or to the end when nothing is selected.</li>
            <li><span class="font-medium">Delete selected rows button</span>: removes the selected rows completely.</li>
          </ul>
        </section>

        <section>
          <div class="mb-2 font-semibold text-gray-900">Clipboard And History</div>
          <ul class="space-y-1">
            <li><span class="font-medium">Ctrl+C</span>: copy the focused editable cell.</li>
            <li><span class="font-medium">Ctrl+V</span>: paste into the focused editable cell using the same validation rules as manual edits.</li>
            <li><span class="font-medium">Ctrl+Z</span>: undo.</li>
            <li><span class="font-medium">Ctrl+Shift+Z</span> or <span class="font-medium">Ctrl+Y</span>: redo.</li>
            <li><span class="font-medium">Ctrl+S</span>: save the current file.</li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
