import assert from "node:assert/strict";

import { summarizeEditorFileValidation } from "../dataEditorValidationSummary.js";

export const dataEditorValidationSummaryTests = [
  {
    name: "summarizeEditorFileValidation counts invalid xlsx cells across sheets",
    run() {
      const summary = summarizeEditorFileValidation({
        fileName: "storages-input.xlsx",
        fileData: {
          filetype: "xlsx",
          data: {
            Sheet1: {
              columns: ["type", "max_charging"],
              rows: [
                { type: "elec", max_charging: "abc" },
                { type: "heat", max_charging: 5 },
              ],
              validationsByColumn: {},
            },
          },
        },
      });

      assert.equal(summary.invalidCount, 1);
      assert.equal(summary.sheets.Sheet1.invalidCount, 1);
    },
  },
  {
    name: "summarizeEditorFileValidation returns zero for valid select and numeric values",
    run() {
      const summary = summarizeEditorFileValidation({
        fileName: "connections-input.xlsx",
        fileData: {
          filetype: "xlsx",
          data: {
            Sheet1: {
              columns: ["grid", "connection_capacity"],
              rows: [
                { grid: "elec", connection_capacity: "4,5" },
              ],
              validationsByColumn: {},
            },
          },
        },
      });

      assert.equal(summary.invalidCount, 0);
      assert.equal(summary.sheets.Sheet1.invalidCount, 0);
    },
  },
];
