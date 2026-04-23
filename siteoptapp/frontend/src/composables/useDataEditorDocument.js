import { ref, watch, nextTick } from "vue";

import { normalizeRows } from "../utils/dataEditorUtils.js";

async function defaultUploadFile(...args) {
  const { uploadFile } = await import("../utils/functions.js");
  return uploadFile(...args);
}

async function defaultFetchFileContents(...args) {
  const { fetchFileContents } = await import("../utils/functions.js");
  return fetchFileContents(...args);
}

export function useDataEditorDocument({
  dataStore,
  notify,
  settingStore,
  sheetStore,
  rowData,
  columnDefs,
  historyState,
  clearHistory,
  updateTableWithActiveSheet,
  uploadFileFn = defaultUploadFile,
  fetchFileContentsFn = defaultFetchFileContents,
}) {
  const originalText = ref("");
  const activeView = ref("editor");
  const selectedFileForUpload = ref(null);

  function markXlsxDirty() {
    sheetStore.markDirty(sheetStore.activeSheet, true);
    sheetStore.toggleSheetDataUpdated();
    dataStore.xlsxDirty = true;
    dataStore.globalDirty = true;
  }

  function markDirty() {
    const t = dataStore.daata?.filetype;

    if (t === "csv") dataStore.csvDirty = true;
    else if (t === "json") dataStore.jsonDirty = true;
    else if (t === "xlsx") markXlsxDirty();

    dataStore.globalDirty = true;
  }

  function clearXlsxDirty() {
    Object.keys(sheetStore.sheetsByName).forEach((key) => sheetStore.markDirty(key, false));
    sheetStore.toggleSheetDataUpdated();
    dataStore.xlsxDirty = false;
  }

  function clearRefs() {
    rowData.value = [];
    columnDefs.value = [];
    originalText.value = "";
    clearHistory(historyState);
    dataStore.fname = "";
    dataStore.fpath = "";
    dataStore.mdDirty = false;
    dataStore.csvDirty = false;
    dataStore.jsonDirty = false;
    dataStore.xlsxDirty = false;
    dataStore.globalDirty = false;
    dataStore.mdText = "";
    dataStore.jsonEditText = "";
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
    const api = dataStore.gridApi;
    const prev = sheetStore.activeSheet;
    if (prev && api) {
      // Persist the current grid state before switching sheets so unsaved edits stay attached to the workbook state.
      sheetStore.captureFromGrid(prev, api);
    }
    sheetStore.setActiveSheet(sheetName);
    updateTableWithActiveSheet();
    clearHistory(historyState);

    await nextTick();
    sheetStore.toggleSheetDataUpdated();
  }

  async function onSaveClick() {
    await dataStore.saveCurrentFile({ notify });
  }

  function handleFileSelect(event) {
    selectedFileForUpload.value = event.target.files[0];
  }

  async function uploadAndReplace() {
    if (!selectedFileForUpload.value) return;
    if (!dataStore.fpath) return;
    const fpath = dataStore.fpath;
    const fname = dataStore.fname;
    if (selectedFileForUpload.value.name !== fname) {
      notify.show(`Uploaded file name must match the current file name (${fname})`, 5000, "error");
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFileForUpload.value);
    formData.append("fpath", fpath);
    const success = await uploadFileFn(formData, notify);
    if (!success) {
      return;
    }
    notify.show(`File ${fname} has been replaced`, 8000, "info");
    await fetchFileContentsFn(fname, fpath);
  }

  watch(() => settingStore.activeProjectIndex, (newVal, oldVal) => {
    if (newVal !== oldVal) {
      clearRefs();
      activeView.value = "editor";
    }
  });

  watch(() => dataStore.daata,
    async (newItems) => {
      if (!newItems || Object.keys(newItems).length === 0) {
        clearRefs();
        return;
      }
      const fileType = newItems.filetype;
      const fileData = newItems.data;
      if (fileType === "xlsx") {
        const sheetNames = Object.keys(fileData || {});
        sheetStore.setWorkbookData(fileData);
        sheetStore.setActiveSheet(sheetNames[0] || "");
        updateTableWithActiveSheet();
        await nextTick();
        sheetStore.toggleSheetDataUpdated();
      }
      else if (fileType === "csv") {
        updateTableFromCsv(fileData);
        await nextTick();
        // Preserve the current view when switching between CSV files.
      }
      else if (fileType === "json") {
        rowData.value = [];
        columnDefs.value = [];
        dataStore.mdText = "";
        try {
          dataStore.jsonEditText = JSON.stringify(fileData, null, 2);
        }
        catch {
          dataStore.jsonEditText = String(fileData);
        }
        originalText.value = dataStore.jsonEditText;
        activeView.value = "editor";
      }
      else if (fileType === "md") {
        rowData.value = [];
        columnDefs.value = [];
        dataStore.jsonEditText = "";
        dataStore.mdText = fileData?.text ?? "";
        originalText.value = dataStore.mdText;
        activeView.value = "editor";
      }
      else {
        console.warn(`Unsupported fileType: ${fileType}`);
        clearRefs();
      }
    },
    { immediate: true },
  );

  watch(() => dataStore.mdText, (editedText) => {
    if (dataStore.daata?.filetype === "md" && editedText !== originalText.value) {
      dataStore.mdDirty = true;
      dataStore.globalDirty = true;
    }
  });

  watch(() => dataStore.jsonEditText, (editedText) => {
    if (dataStore.daata?.filetype === "json" && editedText !== originalText.value) {
      dataStore.jsonDirty = true;
      dataStore.globalDirty = true;
    }
  });

  return {
    originalText,
    activeView,
    selectedFileForUpload,
    markDirty,
    markXlsxDirty,
    clearXlsxDirty,
    clearRefs,
    updateTableFromCsv,
    newSheetSelected,
    onSaveClick,
    handleFileSelect,
    uploadAndReplace,
  };
}
