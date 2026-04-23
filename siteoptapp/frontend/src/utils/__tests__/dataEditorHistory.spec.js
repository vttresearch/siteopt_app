import assert from "node:assert/strict";

import {
  createHistoryState,
  buildAddRowEdit,
  applyHistoryEntry,
} from "../dataEditorUtils.js";

export const dataEditorHistoryTests = [
  {
    name: "buildAddRowEdit inserts first row into an empty sheet at index 0",
    run() {
      const historyState = createHistoryState();
      const result = buildAddRowEdit({
        currentRows: [],
        historyState,
        insertIndex: 0,
      });

      assert.equal(result.rows.length, 1);
      assert.equal(result.historyEntry.index, 0);
      assert.equal(result.rows[0].__id, result.row.__id);
    },
  },
  {
    name: "buildAddRowEdit appends when insert index is beyond the row count",
    run() {
      const historyState = createHistoryState();
      const currentRows = [{ __id: "row_1", value: "a" }];

      const result = buildAddRowEdit({
        currentRows,
        historyState,
        insertIndex: 999,
      });

      assert.equal(result.rows.length, 2);
      assert.equal(result.historyEntry.index, 1);
      assert.equal(result.rows[1].__id, result.row.__id);
    },
  },
  {
    name: "applyHistoryEntry undo removes an added row",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const addResult = buildAddRowEdit({
        currentRows: [],
        historyState,
        insertIndex: 0,
      });

      const rowDataRef = { value: addResult.rows };
      const applied = applyHistoryEntry({
        entry: addResult.historyEntry,
        direction: "undo",
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
        historyState,
      });

      assert.equal(applied, true);
      assert.equal(rowDataRef.value.length, 0);
      assert.equal(markDirtyCalls.length, 1);
    },
  },
];
