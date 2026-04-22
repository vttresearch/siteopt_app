<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted, reactive } from "vue";
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
import {
  COLUMN_TYPES,
  resolveColumnSchema,
  buildColumnDefFromSchema,
} from "@/utils/dataEditorSchema.js";
import {
  createHistoryState,
  clearHistory,
  normalizeRows,
  pushHistory,
  undoHistory,
  redoHistory,
  buildAddRowEdit,
  buildDeleteSelectedRowsEdit,
  buildClearSelectedRowsEdit,
  buildClearFocusedCellEdit,
} from "@/utils/dataeditorutils.js";

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
const historyState = reactive(createHistoryState());

const rowSelectionOptions = {
  mode: "multiRow",
  enableSelectionWithoutKeys: false,
  enableClickSelection: false,
}

const defaultColDef = {
  editable: true,
  resizable: true,
  suppressKeyboardEvent: (params) => {
    const key = params.event?.key?.toLowerCase?.();
    const ctrlOrCmd = params.event?.ctrlKey || params.event?.metaKey;
    const validationType = params.colDef?.validationType;

    if (key === "delete") return true;
    if (key === "enter" && ctrlOrCmd) return true;
    if (
      (validationType === COLUMN_TYPES.NUMBER || validationType === COLUMN_TYPES.INTEGER) &&
      !ctrlOrCmd &&
      !params.event?.altKey &&
      typeof params.event?.key === "string" &&
      params.event.key.length === 1 &&
      !isAllowedNumericCharacter(params.event.key, validationType)
    ) {
      notify.show(
        `${params.colDef?.headerName ?? params.colDef?.field ?? "This field"} accepts only ${validationType === COLUMN_TYPES.INTEGER ? "integer" : "numeric"} characters`,
        2500,
        "error"
      );
      params.event.preventDefault?.();
      return true;
    }

    return false;
  }
}

const hasSelection = computed(() => selectedCount.value > 0);
const hasWorkFolders = computed(() => Object.keys(settingStore.workFolders ?? {}).length > 0);

function markDirty() {
  const t = data_store.daata?.filetype;

  if (t === "csv") data_store.csvDirty = true;
  else if (t === "json") data_store.jsonDirty = true;
  else if (t === "xlsx") markXlsxDirty();

  data_store.globalDirty = true;
}

function markXlsxDirty() {
  sheetStore.markDirty(sheetStore.activeSheet, true);
  sheetStore.toggleSheetDataUpdated();
  data_store.xlsxDirty = true;
  data_store.globalDirty = true;
}

function clearXlsxDirty() {
  Object.keys(sheetStore.sheetsByName).forEach((key) => sheetStore.markDirty(key, false));
  sheetStore.toggleSheetDataUpdated();
  data_store.xlsxDirty = false;
}

const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(plotRows.value);
  return structure?.isTimeSeries ?? false;
});

function onGridReady(params) {
  data_store.registerGridApi(params.api)

  params.api.addEventListener('selectionChanged', () => {
    selectedCount.value = params.api.getSelectedRows().length
  })

  params.api.addEventListener('cellKeyDown', (e) => {
    const key = e.event?.key?.toLowerCase?.();

    if ((e.event?.ctrlKey || e.event?.metaKey) && e.event?.key === 'Enter') {
      e.event.preventDefault();
      e.event.stopPropagation();

      if (e.event?.shiftKey) {
        onAddRow({ mode: "bottom" });
      } else {
        const rowIndexFromEvent =
          typeof e.rowIndex === "number"
            ? e.rowIndex
            : typeof e.node?.rowIndex === "number"
              ? e.node.rowIndex
              : null;

        onAddRow({
          mode: "below-selection",
          insertIndex:
            typeof rowIndexFromEvent === "number"
              ? rowIndexFromEvent + 1
              : null,
        });
      }
      return;
    }

    if (e.event?.key === 'Delete') {
      if (e.api.getEditingCells?.().length) return;

      const cleared = clearSelectionOrFocusedCell(e.api);
      if (cleared) {
        e.event.preventDefault();
        e.event.stopPropagation();
      }
    }
  })
}

function onCellValueChanged(params) {
  if (historyState.isApplying) return;

  const rowId = params.data?.__id;
  const field = params.colDef?.field;

  if (!rowId || !field || field === "__id") return;
  if (params.oldValue === params.newValue) return;

  pushHistory(historyState, {
    type: "cell-edit",
    rowId,
    field,
    oldValue: params.oldValue ?? "",
    newValue: params.newValue ?? "",
  });

  markDirty();
}

function clearRefs() {
  rowData.value = [];
  columnDefs.value = [];
  originalText.value = "";
  clearHistory(historyState);
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

/* Adds a new row */
function onAddRow({ mode = "bottom", insertIndex = null } = {}) {
  const api = data_store.gridApi;
  if (!api) return;

  const hasExplicitInsertIndex =
    insertIndex !== null && insertIndex !== undefined && insertIndex !== "";
  const numericInsertIndex = hasExplicitInsertIndex ? Number(insertIndex) : NaN;

  const resolvedInsertIndex =
    Number.isFinite(numericInsertIndex)
      ? numericInsertIndex
      : mode === "below-selection"
        ? getInsertIndexBelowSelection(api)
        : rowData.value.length;

  const result = buildAddRowEdit({
    currentRows: rowData.value,
    historyState,
    insertIndex: resolvedInsertIndex,
  });

  rowData.value = result.rows;
  pushHistory(historyState, result.historyEntry);
  markDirty();

  nextTick(() => {
    const firstEditableField = columnDefs.value.find(
      c => c.field && c.field !== "__id" && c.editable !== false
    )?.field;

    if (!firstEditableField) return;

    const displayedCount = api.getDisplayedRowCount();
    if (displayedCount <= 0) return;

    const focusIndex = Math.min(resolvedInsertIndex, displayedCount - 1);

    api.ensureIndexVisible(focusIndex, "middle");
    api.setFocusedCell(focusIndex, firstEditableField);
  });
}

/* Deletes selected rows */
function onDeleteSelected() {
  const api = data_store.gridApi;
  if (!api) return;

  const result = buildDeleteSelectedRowsEdit({
    api,
    currentRows: rowData.value,
  });

  if (!result.changed) return;

  rowData.value = result.rows;
  pushHistory(historyState, result.historyEntry);
  markDirty();
}

/* Custom data type detector for Excel data.
* If any row contains a string -> all cells in the column are strings.
* Only actual numeric cells should make the column numeric; numeric-looking
* text values such as "1" are treated as text identifiers.
* */
function detectColumnDataType(rows, col) {
  let allNumeric = true
  let sawValue = false
  for (const row of rows) {
    const value = row[col]
    // Skip null or empty cells
    if (value == null || value === "") continue
    sawValue = true
    // Check if numeric
    if (typeof value === "number") continue
    // If we reach here → value is string-like
    allNumeric = false
    break
  }
  if (!sawValue) return "text"
  return allNumeric ? "number" : "text"
}

function isEmptyCellValue(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function normalizeNumericInput(value) {
  return String(value).trim().replace(",", ".");
}

function isReferenceValue(value) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("ts:");
}

function isAllowedNumericCharacter(char, type) {
  if (/^[0-9]$/.test(char)) return true;
  if (type === COLUMN_TYPES.NUMBER && (char === "." || char === ",")) return true;
  return false;
}

function validateAndNormalizeCellValue({ value, columnName, type, options = [] }) {
  if (isEmptyCellValue(value)) {
    return { valid: true, normalizedValue: "" };
  }

  if (type === COLUMN_TYPES.SELECT) {
    const normalizedValue = String(value);
    if (options.includes(normalizedValue)) {
      return { valid: true, normalizedValue };
    }

    return {
      valid: false,
      message: `${columnName} must be one of: ${options.join(", ")}`,
    };
  }

  if (type === COLUMN_TYPES.INTEGER) {
    const numericValue =
      typeof value === "number" ? value : Number(normalizeNumericInput(value));

    if (Number.isInteger(numericValue)) {
      return { valid: true, normalizedValue: numericValue };
    }

    return {
      valid: false,
      message: `${columnName} must be an integer`,
    };
  }

  if (type === COLUMN_TYPES.NUMBER || type === "number") {
    const numericValue =
      typeof value === "number" ? value : Number(normalizeNumericInput(value));

    if (Number.isFinite(numericValue)) {
      return { valid: true, normalizedValue: numericValue };
    }

    return {
      valid: false,
      message: `${columnName} must be a number`,
    };
  }

  if (type === COLUMN_TYPES.NUMBER_OR_REFERENCE) {
    if (isReferenceValue(value)) {
      return { valid: true, normalizedValue: String(value).trim() };
    }

    const numericValue =
      typeof value === "number" ? value : Number(normalizeNumericInput(value));

    if (Number.isFinite(numericValue)) {
      return { valid: true, normalizedValue: numericValue };
    }

    return {
      valid: false,
      message: `${columnName} must be a number or ts: reference`,
    };
  }

  if (type === COLUMN_TYPES.REFERENCE) {
    if (isReferenceValue(value)) {
      return { valid: true, normalizedValue: String(value).trim() };
    }

    return {
      valid: false,
      message: `${columnName} must start with ts:`,
    };
  }

  return { valid: true, normalizedValue: value };
}

function withValidatedValueSetter(columnDef, { type, options = [] } = {}) {
  if (!columnDef?.field || columnDef.field === "__id") return columnDef;

  return {
    ...columnDef,
    validationType: type,
    validationOptions: options,
    valueParser: (params) => {
      if (type === COLUMN_TYPES.INTEGER || type === COLUMN_TYPES.NUMBER || type === "number") {
        return normalizeNumericInput(params.newValue ?? "");
      }

      if (type === COLUMN_TYPES.NUMBER_OR_REFERENCE) {
        return isReferenceValue(params.newValue ?? "")
          ? String(params.newValue).trim()
          : normalizeNumericInput(params.newValue ?? "");
      }

      return params.newValue;
    },
    valueSetter: (params) => {
      const result = validateAndNormalizeCellValue({
        value: params.newValue,
        columnName: params.colDef?.headerName ?? params.colDef?.field ?? "Value",
        type,
        options,
      });

      if (!result.valid) {
        notify.show(result.message, 4000, "error");
        return false;
      }

      params.data[params.colDef.field] = result.normalizedValue;
      return true;
    },
  };
}

function updateTableWithActiveSheet() {
  const sheetObj = sheetStore.sheetsByName[sheetStore.activeSheet] || {}
  const cols = sheetObj.columns ?? []  // Columns
  const validationsByColumn = sheetObj.columns?.validationsByColumn || {}
  let rows = sheetObj.rows || []
  // Add row numbers
  rows = normalizeRows(rows, historyState);
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
      const schema = resolveColumnSchema({
        fileName: data_store.fname,
        sheetName: sheetStore.activeSheet,
        columnName: col,
      })
      const schemaColumnDef = buildColumnDefFromSchema({
        columnName: col,
        schema,
        fallbackOptions: validationOptions ?? [],
      })
      if (schemaColumnDef) {
        return withValidatedValueSetter(schemaColumnDef, {
          type: schema.type,
          options: schema.options ?? validationOptions ?? [],
        })
      }
      // Detect data type from all rows
      const dataType = detectColumnDataType(rows, col)
      if (Array.isArray(validationOptions) && validationOptions.length > 0) {
        return withValidatedValueSetter({
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
        }, {
          type: COLUMN_TYPES.SELECT,
          options: validationOptions,
        })
      }
      return withValidatedValueSetter({
        headerName: col,
        field: col,
        minWidth: 100,
        editable: true,
        cellEditor: dataType === "number" ? "agTextCellEditor" : undefined,
        cellDataType: dataType === "number" ? "text" : dataType,
      }, {
        type: dataType,
      })
    })
  ]
  // Update grid's reactive data source
  rowData.value = rows
}

function undo() {
  undoHistory({
    historyState,
    rowDataRef: rowData,
    markDirty,
  });
}

function redo() {
  redoHistory({
    historyState,
    rowDataRef: rowData,
    markDirty,
  });
}

function updateTableFromCsv(fileData) {
  const cols = fileData?.columns ?? [];
  let rows = fileData?.rows ?? [];
  rows = normalizeRows(rows, historyState);
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
  if (prev && api) {
    sheetStore.captureFromGrid(prev, api)
  }
  sheetStore.setActiveSheet(sheetName)
  updateTableWithActiveSheet()
  clearHistory(historyState);

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

function clearSelectedRows(api) {
  const result = buildClearSelectedRowsEdit({
    api,
    columnDefs: columnDefs.value,
    currentRows: rowData.value,
  });

  if (!result.changed) return false;

  rowData.value = result.rows;
  pushHistory(historyState, result.historyEntry);
  markDirty();
  return true;
}


function clearFocusedCell(api) {
  const result = buildClearFocusedCellEdit({
    api,
    currentRows: rowData.value,
  });

  if (!result.changed) return false;

  rowData.value = result.rows;
  pushHistory(historyState, result.historyEntry);
  markDirty();
  return true;
}

function clearSelectionOrFocusedCell(api) {
  if (clearSelectedRows(api)) return true;
  return clearFocusedCell(api);
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

function handleGlobalKeydown(e) {
  const key = e.key?.toLowerCase?.();
  const ctrlOrCmd = e.ctrlKey || e.metaKey;

  if (ctrlOrCmd && key === "s") {
    e.preventDefault();
    onSaveClick();
    return;
  }

  const tag = e.target?.tagName?.toLowerCase?.();
  const isTextInput =
    tag === "textarea" ||
    tag === "input" ||
    e.target?.isContentEditable;

  if (isTextInput) return;

  if (ctrlOrCmd && key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }

  if (ctrlOrCmd && (key === "y" || (key === "z" && e.shiftKey))) {
    e.preventDefault();
    redo();
  }

  if (ctrlOrCmd && key === "c") {
    e.preventDefault();
    copyFocusedCell();
    return;
  }

  if (ctrlOrCmd && key === "v") {
    e.preventDefault();
    pasteIntoFocusedCell();
  }
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

function getFocusedEditableCell(api = data_store.gridApi) {
  if (!api) return null;

  const focused = api.getFocusedCell();
  if (!focused) return null;

  const field = focused.column?.getColId?.();
  if (!field || field === "__id") return null;

  const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex);
  const rowId = rowNode?.data?.__id;
  if (!rowId) return null;

  const rowIndex = rowData.value.findIndex((r) => r.__id === rowId);
  if (rowIndex === -1) return null;

  const colDef = columnDefs.value.find((c) => c.field === field);
  if (colDef?.editable === false) return null;

  return {
    rowId,
    rowIndex,
    field,
    value: rowData.value[rowIndex][field] ?? "",
    validationType: colDef?.validationType,
    validationOptions: colDef?.validationOptions ?? [],
  };
}

async function copyFocusedCell() {
  const cell = getFocusedEditableCell();
  if (!cell) return false;

  try {
    await navigator.clipboard.writeText(String(cell.value ?? ""));
    return true;
  } catch (err) {
    console.error("Copy failed:", err);
    notify.show("Copy failed", 3000, "error");
    return false;
  }
}

async function pasteIntoFocusedCell() {
  const cell = getFocusedEditableCell();
  if (!cell) return false;

  try {
    const text = await navigator.clipboard.readText();
    const oldValue = cell.value ?? "";
    const validationResult = validateAndNormalizeCellValue({
      value: text ?? "",
      columnName: cell.field,
      type: cell.validationType,
      options: cell.validationOptions,
    });

    if (!validationResult.valid) {
      notify.show(validationResult.message, 4000, "error");
      return false;
    }

    const newValue = validationResult.normalizedValue;

    if (oldValue === newValue) return false;

    const rows = [...rowData.value];
    rows[cell.rowIndex] = {
      ...rows[cell.rowIndex],
      [cell.field]: newValue,
    };
    rowData.value = rows;

    pushHistory(historyState, {
      type: "cell-edit",
      rowId: cell.rowId,
      field: cell.field,
      oldValue,
      newValue,
    });

    markDirty();
    return true;
  } catch (err) {
    console.error("Paste failed:", err);
    notify.show("Paste failed", 3000, "error");
    return false;
  }
}

function getInsertIndexBelowSelection(api = data_store.gridApi) {
  if (!api) return rowData.value.length;

  const selectedNodes = [];
  api.forEachNodeAfterFilterAndSort((node) => {
    if (node.isSelected?.()) selectedNodes.push(node);
  });

  if (selectedNodes.length > 0) {
    const lastSelectedRowIndex = Math.max(...selectedNodes.map(node => node.rowIndex));
    return lastSelectedRowIndex + 1;
  }

  return rowData.value.length;
}

function getRowId(params) {
  return params.data.__id;
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
  data_store.unregisterGridApi(data_store.gridApi);
});

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
              @click="onAddRow({ mode: 'below-selection' })"
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
              :getRowId="getRowId"
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
