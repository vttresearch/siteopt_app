import assert from "node:assert/strict";

import { nextTick } from "vue";

import {
  createHistoryState,
  pushHistory,
  undoHistory,
  redoHistory,
  buildAddRowEdit,
  buildDeleteSelectedRowsEdit,
  buildClearSelectedRowsEdit,
  buildClearFocusedCellEdit,
  applyHistoryEntry,
  getRowDisplayNumber,
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
  {
    name: "applyHistoryEntry undo restores cleared selected row values",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const currentRows = [
        { __id: "row_1", name: "Storage", capacity: 10 },
      ];
      const api = {
        forEachNodeAfterFilterAndSort(callback) {
          callback({
            data: currentRows[0],
            isSelected: () => true,
          });
        },
      };

      const result = buildClearSelectedRowsEdit({
        api,
        columnDefs: [
          { field: "name", editable: true },
          { field: "capacity", editable: true },
        ],
        currentRows,
      });

      const rowDataRef = { value: result.rows };
      const applied = applyHistoryEntry({
        entry: result.historyEntry,
        direction: "undo",
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
        historyState,
      });

      assert.equal(result.changed, true);
      assert.deepEqual(result.rows[0], { __id: "row_1", name: "", capacity: "" });
      assert.equal(applied, true);
      assert.deepEqual(rowDataRef.value[0], currentRows[0]);
      assert.equal(markDirtyCalls.length, 1);
    },
  },
  {
    name: "buildClearSelectedRowsEdit clears validated dropdown cells to empty string",
    run() {
      const currentRows = [
        { __id: "row_1", type: "heat", capacity: 10 },
      ];
      const api = {
        forEachNodeAfterFilterAndSort(callback) {
          callback({
            data: currentRows[0],
            isSelected: () => true,
          });
        },
      };

      const result = buildClearSelectedRowsEdit({
        api,
        columnDefs: [
          {
            field: "type",
            editable: true,
            cellEditor: "agSelectCellEditor",
            context: {
              validation: {
                type: "select",
                options: ["", "elec", "heat"],
              },
            },
          },
          { field: "capacity", editable: true },
        ],
        currentRows,
      });

      assert.equal(result.changed, true);
      assert.deepEqual(result.rows[0], {
        __id: "row_1",
        type: "",
        capacity: "",
      });
      assert.deepEqual(result.historyEntry.changes, [
        {
          rowId: "row_1",
          field: "type",
          oldValue: "heat",
          newValue: "",
        },
        {
          rowId: "row_1",
          field: "capacity",
          oldValue: 10,
          newValue: "",
        },
      ]);
    },
  },
  {
    name: "undoHistory and redoHistory move a cell edit backward and forward",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const rowDataRef = {
        value: [{ __id: "row_1", name: "new" }],
      };

      pushHistory(historyState, {
        type: "cell-edit",
        rowId: "row_1",
        field: "name",
        oldValue: "old",
        newValue: "new",
      });

      assert.equal(undoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.equal(rowDataRef.value[0].name, "old");

      assert.equal(redoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.equal(rowDataRef.value[0].name, "new");
      assert.equal(markDirtyCalls.length, 2);
    },
  },
  {
    name: "undoHistory and redoHistory restore and remove deleted selected rows",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const currentRows = [
        { __id: "row_1", name: "first" },
        { __id: "row_2", name: "second" },
      ];
      const api = {
        forEachNodeAfterFilterAndSort(callback) {
          currentRows.forEach((row, rowIndex) => callback({
            data: row,
            rowIndex,
            isSelected: () => row.__id === "row_1",
          }));
        },
      };

      const result = buildDeleteSelectedRowsEdit({
        api,
        currentRows,
      });
      const rowDataRef = { value: result.rows };
      pushHistory(historyState, result.historyEntry);

      assert.deepEqual(rowDataRef.value, [{ __id: "row_2", name: "second" }]);

      assert.equal(undoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.deepEqual(rowDataRef.value, currentRows);

      assert.equal(redoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.deepEqual(rowDataRef.value, [{ __id: "row_2", name: "second" }]);
      assert.equal(markDirtyCalls.length, 2);
    },
  },
  {
    name: "getRowDisplayNumber follows rowData order after delete and undo",
    run() {
      const currentRows = [
        { __id: "row_1", name: "first" },
        { __id: "row_2", name: "second" },
        { __id: "row_3", name: "third" },
      ];
      const deletedRows = [
        { __id: "row_1", name: "first" },
        { __id: "row_3", name: "third" },
      ];

      assert.equal(getRowDisplayNumber(currentRows, "row_1"), 1);
      assert.equal(getRowDisplayNumber(currentRows, "row_2"), 2);
      assert.equal(getRowDisplayNumber(currentRows, "row_3"), 3);

      assert.equal(getRowDisplayNumber(deletedRows, "row_1"), 1);
      assert.equal(getRowDisplayNumber(deletedRows, "row_3"), 2);

      assert.equal(getRowDisplayNumber(currentRows, "row_3"), 3);
    },
  },
  {
    name: "buildDeleteSelectedRowsEdit removes multiple selected rows and keeps their original indexes for undo",
    run() {
      const currentRows = [
        { __id: "row_1", name: "first" },
        { __id: "row_2", name: "second" },
        { __id: "row_3", name: "third" },
        { __id: "row_4", name: "fourth" },
      ];
      const api = {
        forEachNodeAfterFilterAndSort(callback) {
          currentRows.forEach((row, rowIndex) => callback({
            data: row,
            rowIndex,
            isSelected: () => row.__id === "row_2" || row.__id === "row_4",
          }));
        },
      };

      const result = buildDeleteSelectedRowsEdit({
        api,
        currentRows,
      });

      assert.equal(result.changed, true);
      assert.deepEqual(result.rows, [
        { __id: "row_1", name: "first" },
        { __id: "row_3", name: "third" },
      ]);
      assert.deepEqual(result.historyEntry, {
        type: "delete-rows",
        rows: [
          {
            row: { __id: "row_2", name: "second" },
            index: 1,
          },
          {
            row: { __id: "row_4", name: "fourth" },
            index: 3,
          },
        ],
      });
    },
  },
  {
    name: "Ctrl+Z-equivalent undo restores rows after deleting multiple selected rows",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const currentRows = [
        { __id: "row_1", name: "first" },
        { __id: "row_2", name: "second" },
        { __id: "row_3", name: "third" },
        { __id: "row_4", name: "fourth" },
      ];
      const api = {
        forEachNodeAfterFilterAndSort(callback) {
          currentRows.forEach((row, rowIndex) => callback({
            data: row,
            rowIndex,
            isSelected: () => row.__id === "row_2" || row.__id === "row_4",
          }));
        },
      };

      const result = buildDeleteSelectedRowsEdit({
        api,
        currentRows,
      });
      const rowDataRef = { value: result.rows };
      pushHistory(historyState, result.historyEntry);

      assert.deepEqual(rowDataRef.value, [
        { __id: "row_1", name: "first" },
        { __id: "row_3", name: "third" },
      ]);

      assert.equal(undoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.deepEqual(rowDataRef.value, currentRows);

      assert.equal(redoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.deepEqual(rowDataRef.value, [
        { __id: "row_1", name: "first" },
        { __id: "row_3", name: "third" },
      ]);
      assert.equal(markDirtyCalls.length, 2);
    },
  },
  {
    name: "redoHistory restores an undone added row at its original index",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const currentRows = [{ __id: "row_1", name: "first" }];
      const result = buildAddRowEdit({
        currentRows,
        historyState,
        insertIndex: 0,
      });
      const rowDataRef = { value: result.rows };

      pushHistory(historyState, result.historyEntry);
      undoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      });
      assert.deepEqual(rowDataRef.value, currentRows);

      assert.equal(redoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), true);
      assert.equal(rowDataRef.value[0].__id, result.row.__id);
      assert.equal(rowDataRef.value[1].__id, "row_1");
      assert.equal(markDirtyCalls.length, 2);
    },
  },
  {
    name: "pushHistory clears redo stack after a new edit",
    async run() {
      const historyState = createHistoryState();
      const rowDataRef = {
        value: [{ __id: "row_1", value: "second" }],
      };

      pushHistory(historyState, {
        type: "cell-edit",
        rowId: "row_1",
        field: "value",
        oldValue: "first",
        newValue: "second",
      });
      undoHistory({
        historyState,
        rowDataRef,
        markDirty: () => {},
      });

      assert.equal(historyState.redoStack.length, 1);

      await nextTick();

      pushHistory(historyState, {
        type: "cell-edit",
        rowId: "row_1",
        field: "value",
        oldValue: "first",
        newValue: "third",
      });

      assert.equal(historyState.redoStack.length, 0);
    },
  },
  {
    name: "undoHistory and redoHistory are safe with empty stacks",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const rowDataRef = {
        value: [{ __id: "row_1", value: "unchanged" }],
      };

      assert.equal(undoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), false);
      assert.equal(redoHistory({
        historyState,
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
      }), false);
      assert.deepEqual(rowDataRef.value, [{ __id: "row_1", value: "unchanged" }]);
      assert.equal(markDirtyCalls.length, 0);
    },
  },
  {
    name: "applyHistoryEntry undo restores a cleared focused cell",
    run() {
      const historyState = createHistoryState();
      const markDirtyCalls = [];
      const currentRows = [
        { __id: "row_1", name: "Storage", capacity: 10 },
      ];
      const api = {
        getFocusedCell() {
          return {
            rowIndex: 0,
            column: {
              getColId: () => "capacity",
            },
          };
        },
        getDisplayedRowAtIndex() {
          return {
            data: currentRows[0],
          };
        },
      };

      const result = buildClearFocusedCellEdit({
        api,
        currentRows,
      });

      const rowDataRef = { value: result.rows };
      const applied = applyHistoryEntry({
        entry: result.historyEntry,
        direction: "undo",
        rowDataRef,
        markDirty: () => markDirtyCalls.push("dirty"),
        historyState,
      });

      assert.equal(result.changed, true);
      assert.deepEqual(result.rows[0], { __id: "row_1", name: "Storage", capacity: "" });
      assert.equal(applied, true);
      assert.deepEqual(rowDataRef.value[0], currentRows[0]);
      assert.equal(markDirtyCalls.length, 1);
    },
  },
  {
    name: "buildClearFocusedCellEdit clears validated dropdown cell to empty string",
    run() {
      const currentRows = [
        { __id: "row_1", type: "heat", capacity: 10 },
      ];
      const api = {
        getFocusedCell() {
          return {
            rowIndex: 0,
            column: {
              getColId: () => "type",
            },
          };
        },
        getDisplayedRowAtIndex() {
          return {
            data: currentRows[0],
          };
        },
      };

      const result = buildClearFocusedCellEdit({
        api,
        currentRows,
      });

      assert.equal(result.changed, true);
      assert.deepEqual(result.rows[0], {
        __id: "row_1",
        type: "",
        capacity: 10,
      });
      assert.deepEqual(result.historyEntry, {
        type: "cell-edit",
        rowId: "row_1",
        field: "type",
        oldValue: "heat",
        newValue: "",
      });
    },
  },
];
