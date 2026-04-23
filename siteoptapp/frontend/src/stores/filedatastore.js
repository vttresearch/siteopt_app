import { ref, shallowRef } from 'vue';
import { defineStore } from 'pinia'
import { useSheetStore } from "./sheetStore.js";
import { useConfirmPrompt } from "../composables/useConfirmPrompt.js";

async function defaultSavePostData(...args) {
  const { postData } = await import("../utils/functions.js");
  return postData(...args);
}

export function createTableDataStore({
  createConfirmPrompt = useConfirmPrompt,
  savePostData = defaultSavePostData,
} = {}) {
  return defineStore('tableData', () => {
  const daata = ref({});
  const fname = ref("");
  const fpath = ref("");
  const loading = ref(false);
  const globalDirty = ref(false);  // true if any file is dirty regardless of file type
  const saving = ref(false)
  const mdDirty = ref(false);
  const csvDirty = ref(false);
  const jsonDirty = ref(false);
  const xlsxDirty = ref(false);
  const mdText = ref("");
  const jsonEditText = ref("");
  // editor capability (NOT persisted data)
  const gridApi = shallowRef(null);
  const { confirm } = createConfirmPrompt()

  function reset() {
    daata.value = {}
    fname.value = ""
    fpath.value = ""
    loading.value = false
    globalDirty.value = false
    saving.value = false
    mdDirty.value = false
    csvDirty.value = false
    jsonDirty.value = false
    xlsxDirty.value = false
    mdText.value = ""
    jsonEditText.value = ""
  }

  function addData(name, path, data) {
    fname.value = name;
    fpath.value = path;
    daata.value = data;
    globalDirty.value = false;
  }

  function setLoading(v) {
    loading.value = v
  }

  function toggleLoading() {
    loading.value = !loading.value;
  }

  function clear() {
    fname.value = "";
    fpath.value = "";
    daata.value = {};
    loading.value = false;
    clearDirty();
  }

  function markDirty() {
    // .md editor does not use grid, so it's ignored here
    const t = daata.value?.filetype
    if (t === 'csv') csvDirty.value = true
    else if (t === 'json') jsonDirty.value = true
    else if (t === 'xlsx') markXlsxDirty();
    globalDirty.value = true
  }

  function markXlsxDirty() {
    const sheetStore = useSheetStore()
    sheetStore.markDirty(sheetStore.activeSheet, true)
    sheetStore.toggleSheetDataUpdated()
    xlsxDirty.value = true
  }

  function clearDirty() {
    mdDirty.value = false
    csvDirty.value = false
    jsonDirty.value = false
    clearXlsxDirty()
    globalDirty.value = false
  }

  function clearXlsxDirty(sheet) {
    const sheetStore = useSheetStore()
    Object.keys(sheetStore.sheetsByName).forEach((key) => sheetStore.markDirty(key, false))
    sheetStore.toggleSheetDataUpdated()
    xlsxDirty.value = false
  }


  async function saveCurrentFile({ notify }){
    if (!fpath.value) {
      notify.show("No file path available to save.", 3000, "error")
      return false
    }
    const filetype = daata.value?.filetype
    let configs

    const filterIdFromRows = rows =>
      rows.map(({ __id, ...rest }) => rest)

    if (filetype === "md") {
      configs = {
        path: fpath.value,
        filetype: "md",
        payloadData: { text: mdText.value },
        meta: {}
      }
    }
    else if (filetype === "json") {
      let parsed
      try {
        parsed = JSON.parse(jsonEditText.value)
      } catch (e) {
        notify.show(`Invalid JSON: ${e}`, 5000, "error")
        return false
      }
      configs = {
        path: fpath.value,
        filetype: "json",
        payloadData: parsed,
        meta: {}
      }
    }
    else if (filetype === "csv") {
      if (!gridApi.value) return notify.show("Grid not ready yet.", 3000, "error");
      gridApi.value.stopEditing();
      let rows = [];
      gridApi.value.forEachNode(node => rows.push(node.data));
      rows = filterIdFromRows(rows)
      configs = { path: fpath.value, filetype: "csv", payloadData: rows, meta: {} }
    }
    else if (filetype === "xlsx") {
      const sheetStore = useSheetStore()
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
      configs = { path: fpath.value, filetype: "xlsx", payloadData: workbook, meta: {} }
    }
    else {
      notify.show(`Save not implemented for ${filetype}`, 3000, "error");
      return
    }
    saving.value = true
    const response = await savePostData("save_file", configs, notify)
    saving.value = false
    if (!response.success) {
      console.error("save_file failed. configs:", configs)
      saving.value = false
      clearDirty()
      return
    }
    saving.value = false
    clearDirty()
    notify.show(`${fname.value} saved`, 4000, "info")
  }

  function registerGridApi(api) {
    gridApi.value = api
  }

  function unregisterGridApi(api) {
    // safety: only unregister if it's the same instance
    if (gridApi.value === api) {
      gridApi.value = null
    }
  }

  /* Opens a 'Save changes' prompt if the current file has unsaved changes. */
  async function askSaveChanges(notify) {
    if (globalDirty.value) {
      const ok = await confirm({
        title: "Save changes?",
        message: `File ${fname.value} has unsaved changes. ` +
            `Would you like to save or discard the changes?`,
        confirmText: "Save",
        cancelText: "Discard",
        variant: "info",
      })
      if (ok) {
        await saveCurrentFile({ notify })
      }
    }
  }

  return {
    daata,
    fname,
    fpath,
    loading,
    globalDirty,
    saving,
    mdDirty,
    csvDirty,
    jsonDirty,
    xlsxDirty,
    mdText,
    jsonEditText,
    gridApi,
    reset,
    addData,
    setLoading,
    toggleLoading,
    clear,
    markDirty,
    markXlsxDirty,
    clearDirty,
    clearXlsxDirty,
    saveCurrentFile,
    registerGridApi,
    unregisterGridApi,
    askSaveChanges,
  }
})
}

export const useTableDataStore = createTableDataStore();
