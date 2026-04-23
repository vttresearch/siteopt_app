import assert from "node:assert/strict";

import { effectScope, nextTick, reactive, ref } from "vue";

import { useDataEditorDocument } from "../../composables/useDataEditorDocument.js";
import { createHistoryState } from "../dataEditorUtils.js";

function createDocumentHarness() {
  const rowData = ref([]);
  const columnDefs = ref([]);
  const historyState = reactive(createHistoryState());
  const clearHistoryCalls = [];
  const updateTableCalls = [];
  const sheetActions = [];

  const dataStore = reactive({
    daata: {},
    fname: "",
    fpath: "",
    mdDirty: false,
    csvDirty: false,
    jsonDirty: false,
    xlsxDirty: false,
    globalDirty: false,
    mdText: "",
    jsonEditText: "",
    gridApi: {
      id: "grid-api",
    },
    markDirty() {
      const t = this.daata?.filetype;
      if (t === "csv") this.csvDirty = true;
      else if (t === "json") this.jsonDirty = true;
      else if (t === "xlsx") {
        sheetStore.markDirty(sheetStore.activeSheet, true);
        sheetStore.toggleSheetDataUpdated();
        this.xlsxDirty = true;
      }
      this.globalDirty = true;
    },
    clearDirty() {
      this.mdDirty = false;
      this.csvDirty = false;
      this.jsonDirty = false;
      this.xlsxDirty = false;
      this.globalDirty = false;
    },
    saveCurrentFile: async () => true,
  });

  const notify = {
    show() {},
  };

  const settingStore = reactive({
    activeProjectIndex: 0,
  });

  const sheetStore = reactive({
    activeSheet: "SheetA",
    sheetsByName: {},
    markDirty(sheetName, value) {
      sheetActions.push({ type: "markDirty", sheetName, value });
      if (this.sheetsByName[sheetName]) {
        this.sheetsByName[sheetName].dirty = value;
      }
    },
    toggleSheetDataUpdated() {
      sheetActions.push({ type: "toggleSheetDataUpdated" });
    },
    captureFromGrid(sheetName, api) {
      sheetActions.push({ type: "captureFromGrid", sheetName, api });
    },
    setActiveSheet(sheetName) {
      sheetActions.push({ type: "setActiveSheet", sheetName });
      this.activeSheet = sheetName;
    },
    setWorkbookData(workbookData) {
      sheetActions.push({ type: "setWorkbookData", workbookData });
      this.sheetsByName = Object.fromEntries(
        Object.entries(workbookData).map(([name, payload]) => [name, payload]),
      );
    },
  });

  const scope = effectScope();
  let api;

  scope.run(() => {
    api = useDataEditorDocument({
      dataStore,
      notify,
      settingStore,
      sheetStore,
      rowData,
      columnDefs,
      historyState,
      clearHistory: (state) => clearHistoryCalls.push(state),
      updateTableWithActiveSheet: () => updateTableCalls.push(sheetStore.activeSheet),
    });
  });

  return {
    api,
    dataStore,
    rowData,
    columnDefs,
    settingStore,
    sheetStore,
    historyState,
    clearHistoryCalls,
    updateTableCalls,
    sheetActions,
    stop: () => scope.stop(),
  };
}

export const dataEditorDocumentTests = [
  {
    name: "markDirty sets CSV and global dirty flags",
    async run() {
      const harness = createDocumentHarness();

      try {
        harness.dataStore.daata = { filetype: "csv", data: {} };
        harness.api.markDirty();

        assert.equal(harness.dataStore.csvDirty, true);
        assert.equal(harness.dataStore.globalDirty, true);
      } finally {
        harness.stop();
      }
    },
  },
  {
    name: "markdown edits set unsaved flags after original content loads",
    async run() {
      const harness = createDocumentHarness();

      try {
        harness.dataStore.daata = {
          filetype: "md",
          data: { text: "original text" },
        };

        await nextTick();
        await nextTick();

        assert.equal(harness.dataStore.mdText, "original text");
        assert.equal(harness.dataStore.mdDirty, false);

        harness.dataStore.mdText = "changed text";
        await nextTick();

        assert.equal(harness.dataStore.mdDirty, true);
        assert.equal(harness.dataStore.globalDirty, true);
      } finally {
        harness.stop();
      }
    },
  },
  {
    name: "xlsx load updates workbook state and activates first sheet",
    async run() {
      const harness = createDocumentHarness();

      try {
        harness.dataStore.daata = {
          filetype: "xlsx",
          data: {
            Sheet1: { rows: [{ value: 1 }], columns: ["value"], meta: {} },
            Sheet2: { rows: [{ value: 2 }], columns: ["value"], meta: {} },
          },
        };

        await nextTick();
        await nextTick();

        assert.equal(harness.sheetStore.activeSheet, "Sheet1");
        assert.deepEqual(harness.updateTableCalls, ["Sheet1"]);
        assert.ok(
          harness.sheetActions.some((action) => action.type === "setWorkbookData"),
        );
      } finally {
        harness.stop();
      }
    },
  },
  {
    name: "newSheetSelected preserves current sheet edits before switching",
    async run() {
      const harness = createDocumentHarness();

      try {
        harness.sheetStore.activeSheet = "Input";

        await harness.api.newSheetSelected("Output");

        assert.deepEqual(harness.updateTableCalls, ["Output"]);
        assert.ok(
          harness.sheetActions.some((action) =>
            action.type === "captureFromGrid" &&
            action.sheetName === "Input" &&
            action.api === harness.dataStore.gridApi,
          ),
        );
        assert.ok(
          harness.sheetActions.some((action) =>
            action.type === "setActiveSheet" && action.sheetName === "Output",
          ),
        );
        assert.ok(harness.clearHistoryCalls.length >= 1);
      } finally {
        harness.stop();
      }
    },
  },
];
