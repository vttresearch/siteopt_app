import { nextTick } from "vue";
import {
  COLUMN_TYPES,
  resolveColumnSchema,
} from "./dataEditorSchema.js";

export const MAX_HISTORY = 100;

export function createHistoryState() {
  return {
    undoStack: [],
    redoStack: [],
    isApplying: false,
    nextRowId: 1,
  };
}

export function makeRowId(historyState) {
  return `row_${Date.now()}_${historyState.nextRowId++}`;
}

export function normalizeRow(row, historyState) {
  if (!row?.__id) {
    return { __id: makeRowId(historyState), ...row };
  }
  return row;
}

export function normalizeRows(rows, historyState) {
  return (rows ?? []).map((row) => normalizeRow(row, historyState));
}

export function createBlankRow(historyState) {
  return { __id: makeRowId(historyState) };
}

export function pushHistory(historyState, entry, maxHistory = MAX_HISTORY) {
  if (historyState.isApplying) return;

  historyState.undoStack.push(entry);

  if (historyState.undoStack.length > maxHistory) {
    historyState.undoStack.shift();
  }

  historyState.redoStack = [];
}

export function clearHistory(historyState) {
  historyState.undoStack = [];
  historyState.redoStack = [];
  historyState.isApplying = false;
}

export function getEditableFieldIds(columnDefs) {
  return (columnDefs ?? [])
    .filter((col) => col.field && col.field !== "__id" && col.editable !== false)
    .map((col) => col.field);
}

export function getCurrentRowsFromGrid(api) {
  if (!api) return [];

  const rows = [];
  api.forEachNodeAfterFilterAndSort((node) => {
    rows.push({ ...node.data });
  });
  return rows;
}

export function findRowIndexById(rows, rowId) {
  return (rows ?? []).findIndex((row) => row.__id === rowId);
}

export function applyHistoryEntry({
    entry,
    direction,
    rowDataRef,
    markDirty,
    historyState,
    }) {
    historyState.isApplying = true;

    let applied = false;

    try {
        switch (entry.type) {
        case "cell-edit": {
            const targetValue = direction === "undo" ? entry.oldValue : entry.newValue;
            const idx = findRowIndexById(rowDataRef.value, entry.rowId);
            if (idx === -1) break;

            const rows = [...rowDataRef.value];
            rows[idx] = { ...rows[idx], [entry.field]: targetValue };
            rowDataRef.value = rows;
            markDirty();
            applied = true;
            break;
        }

        case "batch-cell-edit": {
            const rows = [...rowDataRef.value];

            for (const change of entry.changes) {
            const idx = rows.findIndex((r) => r.__id === change.rowId);
            if (idx === -1) continue;

            rows[idx] = {
                ...rows[idx],
                [change.field]: direction === "undo" ? change.oldValue : change.newValue,
            };
            }

            rowDataRef.value = rows;
            markDirty();
            applied = true;
            break;
        }

        case "add-row": {
            if (direction === "undo") {
            rowDataRef.value = rowDataRef.value.filter((r) => r.__id !== entry.row.__id);
            } else {
            const rows = [...rowDataRef.value];
            const insertAt = Math.min(entry.index, rows.length);
            rows.splice(insertAt, 0, { ...entry.row });
            rowDataRef.value = rows;
            }

            markDirty();
            applied = true;
            break;
        }

        case "delete-rows": {
            if (direction === "undo") {
            const rows = [...rowDataRef.value];
            const sorted = [...entry.rows].sort((a, b) => a.index - b.index);

            for (const item of sorted) {
                const insertAt = Math.min(item.index, rows.length);
                rows.splice(insertAt, 0, { ...item.row });
            }

            rowDataRef.value = rows;
            } else {
            const idsToRemove = new Set(entry.rows.map((item) => item.row.__id));
            rowDataRef.value = rowDataRef.value.filter((r) => !idsToRemove.has(r.__id));
            }

            markDirty();
            applied = true;
            break;
        }

        default:
            applied = false;
        }

        return applied;
    } finally {
        nextTick(() => {
        historyState.isApplying = false;
        });
    }
    }

export function undoHistory({ historyState, rowDataRef, markDirty }) {
  const entry = historyState.undoStack.pop();
  if (!entry) return false;

  const applied = applyHistoryEntry({
    entry,
    direction: "undo",
    rowDataRef,
    markDirty,
    historyState,
  });

  if (applied) {
    historyState.redoStack.push(entry);
  }

  return applied;
}

export function redoHistory({ historyState, rowDataRef, markDirty }) {
  const entry = historyState.redoStack.pop();
  if (!entry) return false;

  const applied = applyHistoryEntry({
    entry,
    direction: "redo",
    rowDataRef,
    markDirty,
    historyState,
  });

  if (applied) {
    historyState.undoStack.push(entry);
  }

  return applied;
}

export function buildClearSelectedRowsEdit({ api, columnDefs, currentRows }) {
  const editableFields = getEditableFieldIds(columnDefs);
  const selectedNodes = [];

  api.forEachNodeAfterFilterAndSort((node) => {
    if (node.isSelected?.()) selectedNodes.push(node);
  });

  if (!selectedNodes.length) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const rows = [...currentRows];
  const changes = [];

  for (const node of selectedNodes) {
    const rowId = node.data?.__id;
    const idx = rows.findIndex((r) => r.__id === rowId);
    if (idx === -1) continue;

    let updatedRow = { ...rows[idx] };

    for (const field of editableFields) {
      const oldValue = updatedRow[field] ?? "";
      const newValue = "";
      if (oldValue === newValue) continue;

      changes.push({ rowId, field, oldValue, newValue });
      updatedRow[field] = newValue;
    }

    rows[idx] = updatedRow;
  }

  if (!changes.length) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  return {
    changed: true,
    rows,
    historyEntry: {
      type: "batch-cell-edit",
      changes,
    },
  };
}

export function buildClearFocusedCellEdit({ api, currentRows }) {
  const focused = api.getFocusedCell();
  if (!focused) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const field = focused.column?.getColId?.();
  if (!field || field === "__id") {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex);
  const rowId = rowNode?.data?.__id;
  if (!rowId) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const idx = currentRows.findIndex((r) => r.__id === rowId);
  if (idx === -1) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const oldValue = currentRows[idx][field] ?? "";
  const newValue = "";
  if (oldValue === newValue) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const rows = [...currentRows];
  rows[idx] = { ...rows[idx], [field]: newValue };

  return {
    changed: true,
    rows,
    historyEntry: {
      type: "cell-edit",
      rowId,
      field,
      oldValue,
      newValue,
    },
  };
}

export function buildDeleteSelectedRowsEdit({ api, currentRows }) {
  const removed = [];

  api.forEachNodeAfterFilterAndSort((node) => {
    if (node.isSelected?.()) {
      removed.push({
        row: { ...node.data },
        index: node.rowIndex,
      });
    }
  });

  if (!removed.length) {
    return { changed: false, rows: currentRows, historyEntry: null };
  }

  const idsToRemove = new Set(removed.map((item) => item.row.__id));
  const rows = currentRows.filter((r) => !idsToRemove.has(r.__id));

  return {
    changed: true,
    rows,
    historyEntry: {
      type: "delete-rows",
      rows: removed,
    },
  };
}

export function buildAddRowEdit({ currentRows, historyState, insertIndex }) {
    const newRow = createBlankRow(historyState);
  
    const numericInsertIndex = Number(insertIndex);
  
    const safeIndex = Number.isFinite(numericInsertIndex)
      ? Math.max(0, Math.min(numericInsertIndex, currentRows.length))
      : currentRows.length;
  
    const rows = [...currentRows];
    rows.splice(safeIndex, 0, newRow);
  
    return {
      rows,
      row: newRow,
      historyEntry: {
        type: "add-row",
        row: { ...newRow },
        index: safeIndex,
      },
    };
}

export function detectColumnDataType(rows, col) {
  let allNumeric = true;
  let sawValue = false;

  for (const row of rows) {
    const value = row[col];
    if (value == null || value === "") continue;

    sawValue = true;
    if (typeof value === "number") continue;

    allNumeric = false;
    break;
  }

  if (!sawValue) return "text";
  return allNumeric ? "number" : "text";
}

export function isEmptyCellValue(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

export function normalizeNumericInput(value) {
  return String(value).trim().replace(",", ".");
}

export function isReferenceValue(value) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("ts:");
}

export function isAllowedNumericCharacter(char, type) {
  if (/^[0-9]$/.test(char)) return true;
  if (type === COLUMN_TYPES.NUMBER && (char === "." || char === ",")) return true;
  return false;
}

export function shouldBlockEditorKey({
  key,
  ctrlOrCmd = false,
  altKey = false,
  validationType,
}) {
  if (
    validationType !== COLUMN_TYPES.NUMBER &&
    validationType !== COLUMN_TYPES.INTEGER
  ) {
    return false;
  }

  if (ctrlOrCmd || altKey || typeof key !== "string" || key.length !== 1) {
    return false;
  }

  return !isAllowedNumericCharacter(key, validationType);
}

export function validateAndNormalizeCellValue({ value, columnName, type, options = [] }) {
  if (isEmptyCellValue(value)) {
    return { valid: true, normalizedValue: "" };
  }

  if (type === COLUMN_TYPES.SELECT) {
    const normalizedValue = String(value);
    if (options.includes(normalizedValue)) {
      return { valid: true, normalizedValue };
    }

    return {
      valid: false,
      message: `${columnName} must be one of: ${options.join(", ")}`,
    };
  }

  if (type === COLUMN_TYPES.INTEGER) {
    const numericValue =
      typeof value === "number" ? value : Number(normalizeNumericInput(value));

    if (Number.isInteger(numericValue)) {
      return { valid: true, normalizedValue: numericValue };
    }

    return {
      valid: false,
      message: `${columnName} must be an integer`,
    };
  }

  if (type === COLUMN_TYPES.NUMBER || type === "number") {
    const numericValue =
      typeof value === "number" ? value : Number(normalizeNumericInput(value));

    if (Number.isFinite(numericValue)) {
      return { valid: true, normalizedValue: numericValue };
    }

    return {
      valid: false,
      message: `${columnName} must be a number`,
    };
  }

  if (type === COLUMN_TYPES.NUMBER_OR_REFERENCE) {
    if (isReferenceValue(value)) {
      return { valid: true, normalizedValue: String(value).trim() };
    }

    const numericValue =
      typeof value === "number" ? value : Number(normalizeNumericInput(value));

    if (Number.isFinite(numericValue)) {
      return { valid: true, normalizedValue: numericValue };
    }

    return {
      valid: false,
      message: `${columnName} must be a number or ts: reference`,
    };
  }

  if (type === COLUMN_TYPES.REFERENCE) {
    if (isReferenceValue(value)) {
      return { valid: true, normalizedValue: String(value).trim() };
    }

    return {
      valid: false,
      message: `${columnName} must start with ts:`,
    };
  }

  return { valid: true, normalizedValue: value };
}

export function normalizeSelectOptions(options = []) {
  const normalized = Array.isArray(options) ? options : [];
  const uniqueOptions = [];
  const seen = new Set();

  for (const option of normalized) {
    const normalizedOption = option == null ? "" : String(option);
    if (seen.has(normalizedOption)) continue;
    seen.add(normalizedOption);
    uniqueOptions.push(normalizedOption);
  }

  return uniqueOptions.includes("")
    ? uniqueOptions
    : ["", ...uniqueOptions];
}

export function resolveColumnConfig({
  columnName,
  rows,
  validationOptions = [],
  fileName,
  sheetName,
}) {
  const schema = resolveColumnSchema({
    fileName,
    sheetName,
    columnName,
  });

  const normalizedValidationOptions = Array.isArray(validationOptions)
    ? validationOptions
    : [];

  if (schema) {
    const rawOptions =
      normalizedValidationOptions.length > 0
        ? normalizedValidationOptions
        : schema.options ?? [];
    const resolvedOptions = normalizeSelectOptions(rawOptions);

    const resolvedType =
      rawOptions.length > 0 && schema.type === COLUMN_TYPES.TEXT
        ? COLUMN_TYPES.SELECT
        : schema.type;

    return {
      type: resolvedType,
      options: resolvedOptions,
      source: "schema",
    };
  }

  if (normalizedValidationOptions.length > 0) {
    return {
      type: COLUMN_TYPES.SELECT,
      options: normalizeSelectOptions(normalizedValidationOptions),
      source: "excel-validation",
    };
  }

  return {
    type: detectColumnDataType(rows, columnName),
    options: [],
    source: "inferred",
  };
}

export function buildEditorColumnDef({ columnName, config }) {
  const isSelect = config.type === COLUMN_TYPES.SELECT;
  const isNumericLike =
    config.type === COLUMN_TYPES.NUMBER ||
    config.type === COLUMN_TYPES.INTEGER ||
    config.type === COLUMN_TYPES.NUMBER_OR_REFERENCE;

  return {
    headerName: columnName,
    field: columnName,
    context: {
      validation: {
        type: config.type,
        options: config.options ?? [],
        source: config.source,
      },
    },
    minWidth: isSelect ? 120 : 100,
    editable: true,
    cellEditor: isSelect
      ? "agSelectCellEditor"
      : isNumericLike
        ? "agTextCellEditor"
        : undefined,
    cellEditorPopup: isSelect || undefined,
    cellEditorParams: isSelect ? { values: config.options } : undefined,
    cellDataType: "text",
    cellClass: isSelect ? "bg-blue-50 ag-cell-dropdown" : undefined,
    headerClass: isSelect ? "ag-header-dropdown" : undefined,
    headerTooltip: isSelect ? "Select from predefined values" : undefined,
  };
}

export function getColumnValidationMeta(colDef) {
  return colDef?.context?.validation ?? {
    type: colDef?.validationType,
    options: colDef?.validationOptions ?? [],
  };
}

export function isSelectColumnDef(colDef) {
  const validationMeta = getColumnValidationMeta(colDef);

  return (
    colDef?.cellEditor === "agSelectCellEditor" ||
    validationMeta.type === COLUMN_TYPES.SELECT
  );
}
