import { computed, nextTick, onMounted, onUnmounted } from "vue";

import { COLUMN_TYPES } from "@/utils/dataEditorSchema.js";
import {
  pushHistory,
  undoHistory,
  redoHistory,
  buildAddRowEdit,
  buildDeleteSelectedRowsEdit,
  buildClearSelectedRowsEdit,
  buildClearFocusedCellEdit,
  normalizeNumericInput,
  isReferenceValue,
  validateAndNormalizeCellValue,
  resolveColumnConfig,
  buildEditorColumnDef,
  getColumnValidationMeta,
  shouldBlockEditorKey,
  isSelectColumnDef,
} from "@/utils/dataEditorUtils.js";

export function useDataEditorGrid({
  dataStore,
  notify,
  sheetStore,
  rowData,
  columnDefs,
  historyState,
  selectedCount,
  markDirty,
  onSave,
}) {
  const rowSelectionOptions = {
    mode: "multiRow",
    enableSelectionWithoutKeys: false,
    enableClickSelection: false,
  };

  const hasSelection = computed(() => selectedCount.value > 0);

  const defaultColDef = {
    editable: true,
    resizable: true,
    suppressKeyboardEvent: (params) => {
      const key = params.event?.key?.toLowerCase?.();
      const ctrlOrCmd = params.event?.ctrlKey || params.event?.metaKey;
      const validationType = getColumnValidationMeta(params.colDef).type;

      if (key === "delete") return true;
      if (key === "enter" && ctrlOrCmd) return true;
      if (shouldBlockEditorKey({
        key: params.event?.key,
        ctrlOrCmd,
        altKey: params.event?.altKey,
        validationType,
      })) {
        notify.show(
          `${params.colDef?.headerName ?? params.colDef?.field ?? "This field"} accepts only ${validationType === COLUMN_TYPES.INTEGER ? "integer" : "numeric"} characters`,
          2500,
          "error",
        );
        params.event.preventDefault?.();
        return true;
      }

      return false;
    },
  };

  function withValidatedValueSetter(columnDef, { type, options = [] } = {}) {
    if (!columnDef?.field || columnDef.field === "__id") return columnDef;

    return {
      ...columnDef,
      context: {
        ...(columnDef.context ?? {}),
        validation: {
          ...(columnDef.context?.validation ?? {}),
          type,
          options,
        },
      },
      // Keep parsing and validation on the column definition so grid edits and paste handling share the same rules.
      valueParser: (params) => {
        if (type === COLUMN_TYPES.INTEGER || type === COLUMN_TYPES.NUMBER || type === "number") {
          return normalizeNumericInput(params.newValue ?? "");
        }

        if (type === COLUMN_TYPES.NUMBER_OR_REFERENCE) {
          return isReferenceValue(params.newValue ?? "")
            ? String(params.newValue).trim()
            : normalizeNumericInput(params.newValue ?? "");
        }

        return params.newValue;
      },
      valueSetter: (params) => {
        const result = validateAndNormalizeCellValue({
          value: params.newValue,
          columnName: params.colDef?.headerName ?? params.colDef?.field ?? "Value",
          type,
          options,
        });

        if (!result.valid) {
          notify.show(result.message, 4000, "error");
          return false;
        }

        params.data[params.colDef.field] = result.normalizedValue;
        return true;
      },
    };
  }

  function updateGridColumns({ rows, columns, validationsByColumn, fileName, sheetName }) {
    columnDefs.value = [
      {
        headerName: "#",
        valueGetter: "node.rowIndex + 1",
        width: 60,
        pinned: "left",
        editable: false,
        sortable: false,
        filter: false,
        cellClass: "bg-blue-50 font-light text-xs text-left",
      },
      ...columns.map((col) => {
        const config = resolveColumnConfig({
          columnName: col,
          rows,
          validationOptions: validationsByColumn[col],
          fileName,
          sheetName,
        });

        return withValidatedValueSetter(buildEditorColumnDef({
          columnName: col,
          config,
        }), {
          type: config.type,
          options: config.options,
        });
      }),
    ];
  }

  function getInsertIndexBelowSelection(api = dataStore.gridApi) {
    if (!api) return rowData.value.length;

    const selectedNodes = [];
    api.forEachNodeAfterFilterAndSort((node) => {
      if (node.isSelected?.()) selectedNodes.push(node);
    });

    if (selectedNodes.length > 0) {
      const lastSelectedRowIndex = Math.max(...selectedNodes.map((node) => node.rowIndex));
      return lastSelectedRowIndex + 1;
    }

    return rowData.value.length;
  }

  function onAddRow({ mode = "bottom", insertIndex = null } = {}) {
    const api = dataStore.gridApi;
    if (!api) return;

    const hasExplicitInsertIndex =
      insertIndex !== null && insertIndex !== undefined && insertIndex !== "";
    const numericInsertIndex = hasExplicitInsertIndex ? Number(insertIndex) : NaN;

    const resolvedInsertIndex =
      Number.isFinite(numericInsertIndex)
        ? numericInsertIndex
        : mode === "below-selection"
          ? getInsertIndexBelowSelection(api)
          : rowData.value.length;

    const result = buildAddRowEdit({
      currentRows: rowData.value,
      historyState,
      insertIndex: resolvedInsertIndex,
    });

    rowData.value = result.rows;
    pushHistory(historyState, result.historyEntry);
    markDirty();

    nextTick(() => {
      const firstEditableField = columnDefs.value.find(
        (c) => c.field && c.field !== "__id" && c.editable !== false,
      )?.field;

      if (!firstEditableField) return;

      const displayedCount = api.getDisplayedRowCount();
      if (displayedCount <= 0) return;

      const focusIndex = Math.min(resolvedInsertIndex, displayedCount - 1);

      api.ensureIndexVisible(focusIndex, "middle");
      api.setFocusedCell(focusIndex, firstEditableField);
    });
  }

  function onDeleteSelected() {
    const api = dataStore.gridApi;
    if (!api) return;

    const result = buildDeleteSelectedRowsEdit({
      api,
      currentRows: rowData.value,
    });

    if (!result.changed) return;

    rowData.value = result.rows;
    pushHistory(historyState, result.historyEntry);
    markDirty();
  }

  function clearSelectedRows(api) {
    const result = buildClearSelectedRowsEdit({
      api,
      columnDefs: columnDefs.value,
      currentRows: rowData.value,
    });

    if (!result.changed) return false;

    rowData.value = result.rows;
    pushHistory(historyState, result.historyEntry);
    markDirty();
    return true;
  }

  function clearFocusedCell(api) {
    const result = buildClearFocusedCellEdit({
      api,
      currentRows: rowData.value,
    });

    if (!result.changed) return false;

    rowData.value = result.rows;
    pushHistory(historyState, result.historyEntry);
    markDirty();
    return true;
  }

  function clearSelectionOrFocusedCell(api) {
    if (clearSelectedRows(api)) return true;
    return clearFocusedCell(api);
  }

  function onCellValueChanged(params) {
    if (historyState.isApplying) return;

    const rowId = params.data?.__id;
    const field = params.colDef?.field;

    if (!rowId || !field || field === "__id") return;
    if (params.oldValue === params.newValue) return;

    pushHistory(historyState, {
      type: "cell-edit",
      rowId,
      field,
      oldValue: params.oldValue ?? "",
      newValue: params.newValue ?? "",
    });

    markDirty();
  }

  function onCellClicked(params) {
    const colDef = params.colDef;
    if (!colDef?.editable) return;

    if (!isSelectColumnDef(colDef)) return;
    if (typeof params.rowIndex !== "number") return;

    // Defer popup editor startup until after the click completes, or AG Grid closes it immediately.
    window.setTimeout(() => {
      params.api.startEditingCell({
        rowIndex: params.rowIndex,
        colKey: colDef.field,
      });
      window.setTimeout(() => {
        const popupEditors = document.querySelectorAll(".ag-popup-editor");
        const latestPopup = popupEditors[popupEditors.length - 1];
        const columnWidth = params.column?.getActualWidth?.();

        if (!latestPopup || !columnWidth) return;

        latestPopup.style.minWidth = `${columnWidth}px`;
        latestPopup.style.width = `${columnWidth}px`;

        const selectEl = latestPopup.querySelector("select");
        if (selectEl) {
          selectEl.style.minWidth = "100%";
          selectEl.style.width = "100%";
        }
      }, 0);
    }, 0);
  }

  function onGridReady(params) {
    dataStore.registerGridApi(params.api);

    params.api.addEventListener("selectionChanged", () => {
      selectedCount.value = params.api.getSelectedRows().length;
    });

    params.api.addEventListener("cellKeyDown", (e) => {
      if (handleUndoRedoShortcut(e.event)) return;

      if ((e.event?.ctrlKey || e.event?.metaKey) && e.event?.key === "Enter") {
        e.event.preventDefault();
        e.event.stopPropagation();

        if (e.event?.shiftKey) {
          onAddRow({ mode: "bottom" });
        } else {
          const rowIndexFromEvent =
            typeof e.rowIndex === "number"
              ? e.rowIndex
              : typeof e.node?.rowIndex === "number"
                ? e.node.rowIndex
                : null;

          onAddRow({
            mode: "below-selection",
            insertIndex:
              typeof rowIndexFromEvent === "number"
                ? rowIndexFromEvent + 1
                : null,
          });
        }
        return;
      }

      if (e.event?.key === "Delete") {
        if (e.api.getEditingCells?.().length) return;

        const cleared = clearSelectionOrFocusedCell(e.api);
        if (cleared) {
          e.event.preventDefault();
          e.event.stopPropagation();
        }
      }
    });
  }

  function undo() {
    undoHistory({
      historyState,
      rowDataRef: rowData,
      markDirty,
    });
  }

  function redo() {
    redoHistory({
      historyState,
      rowDataRef: rowData,
      markDirty,
    });
  }

  function handleUndoRedoShortcut(event) {
    const key = event?.key?.toLowerCase?.();
    const ctrlOrCmd = event?.ctrlKey || event?.metaKey;

    if (!ctrlOrCmd) return false;

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      undo();
      return true;
    }

    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      redo();
      return true;
    }

    return false;
  }

  function getFocusedEditableCell(api = dataStore.gridApi) {
    if (!api) return null;

    const focused = api.getFocusedCell();
    if (!focused) return null;

    const field = focused.column?.getColId?.();
    if (!field || field === "__id") return null;

    const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex);
    const rowId = rowNode?.data?.__id;
    if (!rowId) return null;

    const rowIndex = rowData.value.findIndex((r) => r.__id === rowId);
    if (rowIndex === -1) return null;

    const colDef = columnDefs.value.find((c) => c.field === field);
    if (colDef?.editable === false) return null;
    const validationMeta = getColumnValidationMeta(colDef);

    return {
      rowId,
      rowIndex,
      field,
      value: rowData.value[rowIndex][field] ?? "",
      validationType: validationMeta.type,
      validationOptions: validationMeta.options ?? [],
    };
  }

  async function copyFocusedCell() {
    const cell = getFocusedEditableCell();
    if (!cell) return false;

    try {
      await navigator.clipboard.writeText(String(cell.value ?? ""));
      return true;
    } catch (err) {
      console.error("Copy failed:", err);
      notify.show("Copy failed", 3000, "error");
      return false;
    }
  }

  async function pasteIntoFocusedCell() {
    const cell = getFocusedEditableCell();
    if (!cell) return false;

    try {
      const text = await navigator.clipboard.readText();
      const oldValue = cell.value ?? "";
      // Reuse cell validation here so paste follows the same schema rules as manual edits.
      const validationResult = validateAndNormalizeCellValue({
        value: text ?? "",
        columnName: cell.field,
        type: cell.validationType,
        options: cell.validationOptions,
      });

      if (!validationResult.valid) {
        notify.show(validationResult.message, 4000, "error");
        return false;
      }

      const newValue = validationResult.normalizedValue;

      if (oldValue === newValue) return false;

      const rows = [...rowData.value];
      rows[cell.rowIndex] = {
        ...rows[cell.rowIndex],
        [cell.field]: newValue,
      };
      rowData.value = rows;

      pushHistory(historyState, {
        type: "cell-edit",
        rowId: cell.rowId,
        field: cell.field,
        oldValue,
        newValue,
      });

      markDirty();
      return true;
    } catch (err) {
      console.error("Paste failed:", err);
      notify.show("Paste failed", 3000, "error");
      return false;
    }
  }

  function handleGlobalKeydown(e) {
    const key = e.key?.toLowerCase?.();
    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    if (ctrlOrCmd && key === "s") {
      e.preventDefault();
      onSave?.();
      return;
    }

    const tag = e.target?.tagName?.toLowerCase?.();
    const isTextInput =
      tag === "textarea" ||
      tag === "input" ||
      e.target?.isContentEditable;

    if (isTextInput) return;

    if (handleUndoRedoShortcut(e)) return;

    if (ctrlOrCmd && key === "c") {
      e.preventDefault();
      copyFocusedCell();
      return;
    }

    if (ctrlOrCmd && key === "v") {
      e.preventDefault();
      pasteIntoFocusedCell();
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleGlobalKeydown);
    dataStore.unregisterGridApi(dataStore.gridApi);
  });

  return {
    rowSelectionOptions,
    defaultColDef,
    hasSelection,
    updateGridColumns,
    onGridReady,
    onCellValueChanged,
    onCellClicked,
    onAddRow,
    onDeleteSelected,
    undo,
    redo,
    copyFocusedCell,
    pasteIntoFocusedCell,
    getInsertIndexBelowSelection,
  };
}
