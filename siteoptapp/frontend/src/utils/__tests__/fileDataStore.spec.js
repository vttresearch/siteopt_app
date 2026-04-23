import assert from "node:assert/strict";

import { createPinia, setActivePinia } from "pinia";

import { useSheetStore } from "../../stores/sheetStore.js";
import { createTableDataStore } from "../../stores/filedatastore.js";

function createNotifySpy() {
  const calls = [];

  return {
    calls,
    notify: {
      show(message, duration, variant) {
        calls.push({ message, duration, variant });
      },
    },
  };
}

function createStoreHarness({
  confirmResult = false,
  postDataResult = { success: true },
} = {}) {
  setActivePinia(createPinia());

  const confirmCalls = [];
  const postDataCalls = [];

  const useTestTableDataStore = createTableDataStore({
    createConfirmPrompt: () => ({
      confirm: async (options) => {
        confirmCalls.push(options);
        return confirmResult;
      },
    }),
    savePostData: async (action, configs) => {
      postDataCalls.push({ action, configs });
      return postDataResult;
    },
  });

  return {
    sheetStore: useSheetStore(),
    tableStore: useTestTableDataStore(),
    confirmCalls,
    postDataCalls,
  };
}

export const fileDataStoreTests = [
  {
    name: "markDirty marks xlsx store and active sheet as dirty",
    async run() {
      const { sheetStore, tableStore } = createStoreHarness();

      sheetStore.upsertSheet("Sheet1", [], ["value"]);
      sheetStore.setActiveSheet("Sheet1");
      tableStore.daata = { filetype: "xlsx", data: {} };

      tableStore.markDirty();

      assert.equal(tableStore.xlsxDirty, true);
      assert.equal(tableStore.globalDirty, true);
      assert.equal(sheetStore.sheetsByName.Sheet1.dirty, true);
    },
  },
  {
    name: "saveCurrentFile saves CSV rows without internal row ids and clears dirty flags",
    async run() {
      const { tableStore, postDataCalls } = createStoreHarness();
      const { calls, notify } = createNotifySpy();

      tableStore.fname = "input.csv";
      tableStore.fpath = "/tmp/input.csv";
      tableStore.daata = { filetype: "csv", data: {} };
      tableStore.csvDirty = true;
      tableStore.globalDirty = true;
      tableStore.registerGridApi({
        stopEditing() {},
        forEachNode(callback) {
          callback({ data: { __id: "row_1", a: 1, b: 2 } });
          callback({ data: { __id: "row_2", a: 3, b: 4 } });
        },
      });

      await tableStore.saveCurrentFile({ notify });

      assert.equal(postDataCalls.length, 1);
      assert.equal(postDataCalls[0].action, "save_file");
      assert.deepEqual(postDataCalls[0].configs.payloadData, [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ]);
      assert.equal(tableStore.csvDirty, false);
      assert.equal(tableStore.globalDirty, false);
      assert.ok(calls.some((call) => call.message === "input.csv saved"));
    },
  },
  {
    name: "askSaveChanges opens unsaved prompt and saves when confirmed",
    async run() {
      const { tableStore, confirmCalls, postDataCalls } = createStoreHarness({
        confirmResult: true,
      });
      const { notify } = createNotifySpy();

      tableStore.fname = "notes.md";
      tableStore.fpath = "/tmp/notes.md";
      tableStore.daata = { filetype: "md", data: {} };
      tableStore.mdText = "# Updated";
      tableStore.mdDirty = true;
      tableStore.globalDirty = true;

      await tableStore.askSaveChanges(notify);

      assert.equal(confirmCalls.length, 1);
      assert.match(confirmCalls[0].message, /notes\.md has unsaved changes/);
      assert.equal(postDataCalls.length, 1);
      assert.deepEqual(postDataCalls[0].configs.payloadData, { text: "# Updated" });
    },
  },
  {
    name: "askSaveChanges does not save when unsaved changes are discarded",
    async run() {
      const { tableStore, confirmCalls, postDataCalls } = createStoreHarness({
        confirmResult: false,
      });
      const { notify } = createNotifySpy();

      tableStore.fname = "notes.md";
      tableStore.fpath = "/tmp/notes.md";
      tableStore.daata = { filetype: "md", data: {} };
      tableStore.globalDirty = true;

      await tableStore.askSaveChanges(notify);

      assert.equal(confirmCalls.length, 1);
      assert.equal(postDataCalls.length, 0);
    },
  },
];
