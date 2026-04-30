import assert from "node:assert/strict";

import { createPinia, setActivePinia } from "pinia";

import {
  createValidationSummary,
  useValidationStore,
} from "../../stores/validationstore.js";

function createValidationStoreHarness() {
  setActivePinia(createPinia());
  return useValidationStore();
}

export const validationStoreTests = [
  {
    name: "createValidationSummary normalizes empty values",
    run() {
      const summary = createValidationSummary();

      assert.equal(summary.invalidCount, 0);
      assert.equal(summary.filetype, null);
      assert.deepEqual(summary.sheets, {});
    },
  },
  {
    name: "validation store returns cached summaries for unopened files",
    run() {
      const store = createValidationStoreHarness();
      store.setCachedSummary("/tmp/project/current_input/nodes.xlsx", {
        invalidCount: 2,
        filetype: "xlsx",
        sheets: {
          Sheet1: { invalidCount: 2 },
        },
      });

      const summary = store.getValidationSummary("/tmp/project/current_input/nodes.xlsx");

      assert.equal(summary.invalidCount, 2);
      assert.equal(summary.filetype, "xlsx");
      assert.equal(summary.sheets.Sheet1.invalidCount, 2);
    },
  },
  {
    name: "validation store derives live workbook summary from scope issues",
    run() {
      const store = createValidationStoreHarness();
      store.setScopeIssues("/tmp/project/current_input/storages-input.xlsx", "xlsx", "Sheet1", {
        "row_1::capacity": { message: "capacity must be a number" },
      });
      store.setScopeIssues("/tmp/project/current_input/storages-input.xlsx", "xlsx", "Sheet2", {
        "row_2::type": { message: "type must be one of: elec, heat" },
        "row_3::type": { message: "type must be one of: elec, heat" },
      });

      const summary = store.getValidationSummary("/tmp/project/current_input/storages-input.xlsx");

      assert.equal(summary.invalidCount, 3);
      assert.equal(summary.sheets.Sheet1.invalidCount, 1);
      assert.equal(summary.sheets.Sheet2.invalidCount, 2);
      assert.equal(
        store.getScopeInvalidCount("/tmp/project/current_input/storages-input.xlsx", "Sheet2"),
        2,
      );
    },
  },
];
