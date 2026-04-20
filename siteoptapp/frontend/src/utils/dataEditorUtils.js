import { nextTick } from "vue";

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

export function buildAddRowEdit({ currentRows, historyState }) {
  const newRow = createBlankRow(historyState);
  const index = currentRows.length;
  const rows = [...currentRows, newRow];

  return {
    rows,
    row: newRow,
    historyEntry: {
      type: "add-row",
      row: { ...newRow },
      index,
    },
  };
}