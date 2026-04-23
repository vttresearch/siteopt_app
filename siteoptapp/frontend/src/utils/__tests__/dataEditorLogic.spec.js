import assert from "node:assert/strict";

import { COLUMN_TYPES } from "../dataEditorSchema.js";
import {
  detectColumnDataType,
  normalizeNumericInput,
  validateAndNormalizeCellValue,
  resolveColumnConfig,
  buildEditorColumnDef,
  getColumnValidationMeta,
  shouldBlockEditorKey,
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
      assert.deepEqual(config.options, ["X"]);
      assert.equal(config.source, "schema");
    },
  },
  {
    name: "buildEditorColumnDef creates popup select editor for select columns",
    run() {
      const colDef = buildEditorColumnDef({
        columnName: "grid",
        config: {
          type: COLUMN_TYPES.SELECT,
          options: ["elec", "heat"],
        },
      });

      assert.equal(colDef.cellEditor, "agSelectCellEditor");
      assert.equal(colDef.cellEditorPopup, true);
      assert.deepEqual(colDef.cellEditorParams, { values: ["elec", "heat"] });
      assert.deepEqual(getColumnValidationMeta(colDef), {
        type: COLUMN_TYPES.SELECT,
        options: ["elec", "heat"],
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
    name: "shouldBlockEditorKey blocks letters for integer fields",
    run() {
      assert.equal(
        shouldBlockEditorKey({
          key: "a",
          validationType: COLUMN_TYPES.INTEGER,
        }),
        true,
      );
    },
  },
  {
    name: "shouldBlockEditorKey allows comma for numeric fields",
    run() {
      assert.equal(
        shouldBlockEditorKey({
          key: ",",
          validationType: COLUMN_TYPES.NUMBER,
        }),
        false,
      );
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
