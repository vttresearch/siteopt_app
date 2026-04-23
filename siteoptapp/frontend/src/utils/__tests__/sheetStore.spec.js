import assert from "node:assert/strict";

import {
  createSheetRecord,
  normalizeSheetPayload,
} from "../../stores/sheetStore.js";

export const sheetStoreTests = [
  {
    name: "createSheetRecord builds a full explicit sheet contract",
    run() {
      const record = createSheetRecord({
        rows: [{ a: 1 }],
        columns: ["a"],
        meta: { unit: "kWh" },
        validationsByColumn: { a: ["x", "y"] },
        dirty: true,
      });

      assert.deepEqual(record.rows, [{ a: 1 }]);
      assert.deepEqual(record.columns, ["a"]);
      assert.deepEqual(record.meta, { unit: "kWh" });
      assert.deepEqual(record.validationsByColumn, { a: ["x", "y"] });
      assert.equal(record.dirty, true);
    },
  },
  {
    name: "createSheetRecord normalizes invalid sheet fields to safe defaults",
    run() {
      const record = createSheetRecord({
        rows: null,
        columns: "not-an-array",
        meta: null,
        validationsByColumn: null,
        dirty: 0,
      });

      assert.deepEqual(record.rows, []);
      assert.deepEqual(record.columns, []);
      assert.deepEqual(record.meta, {});
      assert.deepEqual(record.validationsByColumn, {});
      assert.equal(record.dirty, false);
    },
  },
  {
    name: "normalizeSheetPayload converts legacy row-array payload into a full sheet record",
    run() {
      const record = normalizeSheetPayload([{ col1: "value" }]);

      assert.deepEqual(record.rows, [{ col1: "value" }]);
      assert.deepEqual(record.columns, []);
      assert.deepEqual(record.meta, {});
      assert.deepEqual(record.validationsByColumn, {});
      assert.equal(record.dirty, false);
    },
  },
  {
    name: "normalizeSheetPayload preserves workbook validationsByColumn payload",
    run() {
      const record = normalizeSheetPayload({
        rows: [{ type: "heat" }],
        columns: ["type"],
        meta: { source: "xlsx" },
        validationsByColumn: { type: ["heat", "elec"] },
      });

      assert.deepEqual(record.rows, [{ type: "heat" }]);
      assert.deepEqual(record.columns, ["type"]);
      assert.deepEqual(record.meta, { source: "xlsx" });
      assert.deepEqual(record.validationsByColumn, { type: ["heat", "elec"] });
      assert.equal(record.dirty, false);
    },
  },
];
