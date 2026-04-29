import assert from "node:assert/strict";

import { COLUMN_TYPES } from "../dataEditorSchema.js";
import {
  detectColumnDataType,
  normalizeNumericInput,
  validateAndNormalizeCellValue,
  buildValidationIssue,
  countValidationIssues,
  resolveColumnConfig,
  buildEditorColumnDef,
  getColumnValidationMeta,
  isSelectColumnDef,
} from "../dataEditorUtils.js";

export const dataEditorLogicTests = [
  {
    name: "detectColumnDataType defaults empty columns to text",
    run() {
      const rows = [{ a: "" }, { a: null }, { a: undefined }];
      assert.equal(detectColumnDataType(rows, "a"), "text");
    },
  },
  {
    name: "normalizeNumericInput converts comma decimal to dot",
    run() {
      assert.equal(normalizeNumericInput("678,9"), "678.9");
    },
  },
  {
    name: "numeric validation accepts comma decimals",
    run() {
      const result = validateAndNormalizeCellValue({
        value: "456,7",
        columnName: "emission_cost",
        type: COLUMN_TYPES.NUMBER,
      });

      assert.equal(result.valid, true);
      assert.equal(result.normalizedValue, 456.7);
    },
  },
  {
    name: "number_or_reference accepts ts references",
    run() {
      const result = validateAndNormalizeCellValue({
        value: "ts:cop_profile",
        columnName: "cop_profile",
        type: COLUMN_TYPES.NUMBER_OR_REFERENCE,
      });

      assert.equal(result.valid, true);
      assert.equal(result.normalizedValue, "ts:cop_profile");
    },
  },
  {
    name: "numeric validation rejects plain strings",
    run() {
      const result = validateAndNormalizeCellValue({
        value: "abc",
        columnName: "candidate_units",
        type: COLUMN_TYPES.NUMBER,
      });

      assert.equal(result.valid, false);
      assert.match(result.message, /must be a number/);
    },
  },
  {
    name: "buildValidationIssue keeps invalid numeric text visible and returns issue metadata",
    run() {
      const result = buildValidationIssue({
        rowId: "row_1",
        field: "capacity",
        value: "abc",
        columnName: "capacity",
        type: COLUMN_TYPES.NUMBER,
      });

      assert.equal(result.valid, false);
      assert.equal(result.normalizedValue, "abc");
      assert.equal(result.issue?.rowId, "row_1");
      assert.equal(result.issue?.field, "capacity");
      assert.match(result.issue?.message, /must be a number/);
    },
  },
  {
    name: "countValidationIssues returns the number of tracked invalid cells",
    run() {
      assert.equal(countValidationIssues({
        "row_1::a": { message: "A must be a number" },
        "row_2::b": { message: "B must be an integer" },
      }), 2);
    },
  },
  {
    name: "resolveColumnConfig uses schema select options for storages type",
    run() {
      const config = resolveColumnConfig({
        columnName: "type",
        rows: [],
        fileName: "storages-input.xlsx",
        sheetName: "Sheet1",
      });

      assert.equal(config.type, COLUMN_TYPES.SELECT);
      assert.deepEqual(config.options, ["", "elec", "heat"]);
      assert.equal(config.source, "schema");
    },
  },
  {
    name: "resolveColumnConfig upgrades schema text column to select when Excel validation exists",
    run() {
      const config = resolveColumnConfig({
        columnName: "representative_node",
        rows: [],
        validationOptions: ["X"],
        fileName: "nodes.xlsx",
        sheetName: "Sheet1",
      });

      assert.equal(config.type, COLUMN_TYPES.SELECT);
      assert.deepEqual(config.options, ["", "X"]);
      assert.equal(config.source, "schema");
    },
  },
  {
    name: "resolveColumnConfig prepends empty option for schema select columns",
    run() {
      const config = resolveColumnConfig({
        columnName: "grid",
        rows: [],
        fileName: "connections-input.xlsx",
        sheetName: "Sheet1",
      });

      assert.equal(config.type, COLUMN_TYPES.SELECT);
      assert.deepEqual(config.options, ["", "elec", "heat"]);
    },
  },
  {
    name: "buildEditorColumnDef creates popup select editor for select columns",
    run() {
      const colDef = buildEditorColumnDef({
        columnName: "grid",
        config: {
          type: COLUMN_TYPES.SELECT,
          options: ["", "elec", "heat"],
        },
      });

      assert.equal(colDef.cellEditor, "agSelectCellEditor");
      assert.equal(colDef.cellEditorPopup, true);
      assert.deepEqual(colDef.cellEditorParams, { values: ["", "elec", "heat"] });
      assert.deepEqual(getColumnValidationMeta(colDef), {
        type: COLUMN_TYPES.SELECT,
        options: ["", "elec", "heat"],
        source: undefined,
      });
    },
  },
  {
    name: "buildEditorColumnDef creates text editor for numeric-like columns",
    run() {
      const colDef = buildEditorColumnDef({
        columnName: "value",
        config: {
          type: COLUMN_TYPES.NUMBER_OR_REFERENCE,
          options: [],
        },
      });

      assert.equal(colDef.cellEditor, "agTextCellEditor");
      assert.equal(colDef.cellDataType, "text");
    },
  },
  {
    name: "isSelectColumnDef recognizes schema select columns",
    run() {
      assert.equal(
        isSelectColumnDef({
          validationType: COLUMN_TYPES.SELECT,
        }),
        true,
      );
    },
  },
];
