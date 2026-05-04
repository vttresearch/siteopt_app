import { computed, nextTick, onMounted, onUnmounted } from "vue";

import { COLUMN_TYPES } from "@/utils/dataEditorSchema.js";
import { useValidationStore } from "@/stores/validationstore.js";
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
  buildValidationIssue,
  resolveColumnConfig,
  buildEditorColumnDef,
  getColumnValidationMeta,
  countValidationIssues,
  isSelectColumnDef,
  getRowDisplayNumber,
} from "@/utils/dataEditorUtils.js";

export function useDataEditorGrid({
  dataStore,
  notify,
  sheetStore,
  gridShellRef,
  rowData,
  columnDefs,
  historyState,
  selectedCount,
  markDirty,
  onSave,
}) {
  const validationStore = useValidationStore();
  const rowSelectionOptions = {
    mode: "multiRow",
    enableSelectionWithoutKeys: false,
    enableClickSelection: false,
  };

  const hasSelection = computed(() => selectedCount.value > 0);
  const activeValidationPath = computed(() => dataStore.fpath || "");
  const activeValidationScope = computed(() => (
    dataStore.daata?.filetype === "xlsx"
      ? (sheetStore.activeSheet || "__workbook__")
      : "__file__"
  ));
  const currentValidationIssues = computed(
    () => validationStore.getScopeIssues(activeValidationPath.value, activeValidationScope.value),
  );
  const currentValidationIssueCount = computed(
    () => countValidationIssues(currentValidationIssues.value),
  );
  const hasValidationIssues = computed(() => currentValidationIssueCount.value > 0);
  const currentFileValidationSummary = computed(() => {
    return validationStore.getValidationSummary(
      activeValidationPath.value,
      dataStore.daata?.filetype,
    );
  });

  const defaultColDef = {
    editable: true,
    resizable: true,
    suppressKeyboardEvent: (params) => {
      const key = params.event?.key?.toLowerCase?.();
      const ctrlOrCmd = params.event?.ctrlKey || params.event?.metaKey;
      const validationMeta = getColumnValidationMeta(params.colDef);
      const validationType = validationMeta.type;

      if (key === "delete" && params.editing && validationType === COLUMN_TYPES.SELECT) {
        params.event.preventDefault?.();
        params.node?.setDataValue?.(params.colDef?.field, "");
        params.api?.stopEditing?.();
        return true;
      }

      if (key === "delete") return true;
      if (key === "enter" && ctrlOrCmd) return true;

      return false;
    },
  };

  function getValidationScopeName(sheetName = sheetStore.activeSheet) {
    if (dataStore.daata?.filetype === "xlsx") {
      return sheetName || "__workbook__";
    }
    return "__file__";
  }

  function setScopeValidationIssues(scopeName, validationIssues = {}) {
    validationStore.setScopeIssues(
      activeValidationPath.value,
      dataStore.daata?.filetype,
      scopeName,
      validationIssues,
    );
  }

  function clearValidationIssues() {
    validationStore.clearFileIssues(activeValidationPath.value);
  }

  function getScopeValidationIssueCount(scopeName) {
    return validationStore.getScopeInvalidCount(activeValidationPath.value, scopeName);
  }

  function getCellValidationIssue(rowId, field, scopeName = activeValidationScope.value) {
    return validationStore.getScopeIssues(activeValidationPath.value, scopeName)?.[`${rowId}::${field}`] ?? null;
  }

  function hasCellValidationIssue(rowId, field, scopeName = activeValidationScope.value) {
    return Boolean(getCellValidationIssue(rowId, field, scopeName));
  }

  function validateCellValue({
    rowId,
    field,
    value,
    columnName,
    type,
    options = [],
  }) {
    return buildValidationIssue({
      rowId,
      field,
      value,
      columnName,
      type,
      options,
    });
  }

  function validateRowsForScope({
    rows,
    columns,
    validationsByColumn,
    fileName,
    sheetName,
  }) {
    const validationIssues = {};

    for (const row of rows ?? []) {
      const rowId = row?.__id;
      if (!rowId) continue;

      for (const columnName of columns ?? []) {
        const config = resolveColumnConfig({
          columnName,
          rows,
          validationOptions: validationsByColumn?.[columnName],
          fileName,
          sheetName,
        });
        const validation = validateCellValue({
          rowId,
          field: columnName,
          value: row?.[columnName] ?? "",
          columnName,
          type: config.type,
          options: config.options,
        });

        if (!validation.valid) {
          validationIssues[validation.issue.key] = validation.issue;
        }
      }
    }

    validationStore.setScopeIssues(
      activeValidationPath.value,
      dataStore.daata?.filetype,
      getValidationScopeName(sheetName),
      validationIssues,
    );
  }

  function validateWorkbookScopes(workbookData = {}, fileName = dataStore.fname) {
    clearValidationIssues();

    for (const [sheetName, sheetRecord] of Object.entries(workbookData ?? {})) {
      validateRowsForScope({
        rows: sheetRecord?.rows ?? [],
        columns: sheetRecord?.columns ?? [],
        validationsByColumn: sheetRecord?.validationsByColumn ?? {},
        fileName,
        sheetName,
      });
    }
  }

  function refreshCurrentValidationScope() {
    const sheetRecord = dataStore.daata?.filetype === "xlsx"
      ? sheetStore.getActiveSheetRecord()
      : null;

    validateRowsForScope({
      rows: rowData.value,
      columns:
        dataStore.daata?.filetype === "xlsx"
          ? (sheetRecord?.columns ?? [])
          : columnDefs.value
            .filter((column) => column.field && column.field !== "__id")
            .map((column) => column.field),
      validationsByColumn: sheetRecord?.validationsByColumn ?? {},
      fileName: dataStore.fname,
      sheetName: sheetStore.activeSheet,
    });
  }

  function upsertCellValidationIssue(issue, scopeName = activeValidationScope.value) {
    const currentScopeIssues = validationStore.getScopeIssues(activeValidationPath.value, scopeName);
    validationStore.setScopeIssues(
      activeValidationPath.value,
      dataStore.daata?.filetype,
      scopeName,
      {
        ...currentScopeIssues,
        [issue.key]: issue,
      },
    );
  }

  function clearCellValidationIssue(rowId, field, scopeName = activeValidationScope.value) {
    const currentScopeIssues = validationStore.getScopeIssues(activeValidationPath.value, scopeName);
    const nextScopeIssues = { ...currentScopeIssues };
    delete nextScopeIssues[`${rowId}::${field}`];
    validationStore.setScopeIssues(
      activeValidationPath.value,
      dataStore.daata?.filetype,
      scopeName,
      nextScopeIssues,
    );
  }

  function withValidatedValueSetter(columnDef, { type, options = [] } = {}) {
    if (!columnDef?.field || columnDef.field === "__id") return columnDef;

    const baseCellClass = columnDef.cellClass;
    const baseCellStyle = columnDef.cellStyle;

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
        const result = validateCellValue({
          rowId: params.data?.__id,
          field: params.colDef.field,
          value: params.newValue,
          columnName: params.colDef?.headerName ?? params.colDef?.field ?? "Value",
          type,
          options,
        });

        if (result.valid) {
          clearCellValidationIssue(params.data?.__id, params.colDef.field);
          params.data[params.colDef.field] = result.normalizedValue;
        } else {
          upsertCellValidationIssue(result.issue);
          params.data[params.colDef.field] = params.newValue ?? "";
        }

        params.api?.refreshCells?.({
          rowNodes: params.node ? [params.node] : undefined,
          columns: params.colDef?.field ? [params.colDef.field] : undefined,
          force: true,
        });
        nextTick(() => {
          params.api?.refreshCells?.({
            rowNodes: params.node ? [params.node] : undefined,
            columns: params.colDef?.field ? [params.colDef.field] : undefined,
            force: true,
          });
          params.api?.redrawRows?.({
            rowNodes: params.node ? [params.node] : undefined,
          });
        });

        return true;
      },
      tooltipValueGetter: (params) => {
        const issue = getCellValidationIssue(params.data?.__id, params.colDef?.field);
        return issue?.message ?? null;
      },
      cellClass: (params) => {
        const baseClasses =
          typeof baseCellClass === "function"
            ? baseCellClass(params)
            : baseCellClass;
        const classes = [];

        if (Array.isArray(baseClasses)) classes.push(...baseClasses.filter(Boolean));
        else if (typeof baseClasses === "string" && baseClasses) classes.push(baseClasses);

        if (hasCellValidationIssue(params.data?.__id, params.colDef?.field)) {
          classes.push("data-editor-invalid-cell");
        }

        return classes;
      },
      cellStyle: (params) => {
        const baseStyle =
          typeof baseCellStyle === "function"
            ? baseCellStyle(params)
            : (baseCellStyle ?? null);

        if (!hasCellValidationIssue(params.data?.__id, params.colDef?.field)) {
          return baseStyle;
        }

        return {
          ...(baseStyle ?? {}),
          backgroundColor: "#fef2f2",
          color: "#991b1b",
          boxShadow: "inset 0 0 0 1px #fca5a5",
        };
      },
    };
  }

  function updateGridColumns({ rows, columns, validationsByColumn, fileName, sheetName }) {
    validateRowsForScope({
      rows,
      columns,
      validationsByColumn,
      fileName,
      sheetName,
    });

    columnDefs.value = [
      {
        headerName: "#",
        valueGetter: (params) => getRowDisplayNumber(rowData.value, params.data?.__id),
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
    refreshCurrentValidationScope();

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
    refreshCurrentValidationScope();
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
    refreshCurrentValidationScope();
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
    refreshCurrentValidationScope();
    return true;
  }

  function clearSelectionOrFocusedCell(api) {
    if (clearSelectedRows(api)) return true;
    return clearFocusedCell(api);
  }

  function clearRowSelection(api = dataStore.gridApi) {
    if (!api || selectedCount.value <= 0) return false;
    api.deselectAll?.();
    return true;
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
    refreshCurrentValidationScope();
    params.api?.refreshCells?.({
      rowNodes: params.node ? [params.node] : undefined,
      columns: field ? [field] : undefined,
      force: true,
    });
    nextTick(() => {
      params.api?.refreshCells?.({
        rowNodes: params.node ? [params.node] : undefined,
        columns: field ? [field] : undefined,
        force: true,
      });
      params.api?.redrawRows?.({
        rowNodes: params.node ? [params.node] : undefined,
      });
    });

    if (dataStore.daata?.filetype === "xlsx") {
      sheetStore.toggleSheetDataUpdated();
    }
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

  function refreshGridValidationStyles() {
    const api = dataStore.gridApi;
    if (!api) return;

    api.refreshCells({ force: true });
    nextTick(() => {
      api.refreshCells({ force: true });
      api.redrawRows?.();
    });
  }

  function undo() {
    const changed = undoHistory({
      historyState,
      rowDataRef: rowData,
      markDirty,
    });
    if (changed) {
      refreshCurrentValidationScope();
      refreshGridValidationStyles();
    }
  }

  function redo() {
    const changed = redoHistory({
      historyState,
      rowDataRef: rowData,
      markDirty,
    });
    if (changed) {
      refreshCurrentValidationScope();
      refreshGridValidationStyles();
    }
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
      const validatedCell = validateCellValue({
        rowId: cell.rowId,
        field: cell.field,
        value: text ?? "",
        columnName: cell.field,
        type: cell.validationType,
        options: cell.validationOptions,
      });
      const newValue = validatedCell.normalizedValue;

      if (oldValue === newValue) return false;

      const rows = [...rowData.value];
      rows[cell.rowIndex] = {
        ...rows[cell.rowIndex],
        [cell.field]: newValue,
      };
      rowData.value = rows;

      if (validatedCell.valid) {
        clearCellValidationIssue(cell.rowId, cell.field);
      } else {
        upsertCellValidationIssue(validatedCell.issue);
      }

      pushHistory(historyState, {
        type: "cell-edit",
        rowId: cell.rowId,
        field: cell.field,
        oldValue,
        newValue,
      });

      markDirty();
      refreshCurrentValidationScope();
      if (dataStore.daata?.filetype === "xlsx") {
        sheetStore.toggleSheetDataUpdated();
      }
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
    const api = dataStore.gridApi;

    if (key === "escape" && api?.getEditingCells?.().length === 0) {
      if (clearRowSelection(api)) {
        e.preventDefault();
      }
      return;
    }

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

  function handleDocumentMouseDown(e) {
    const api = dataStore.gridApi;
    const gridShellEl = gridShellRef?.value;

    if (!api || !gridShellEl || selectedCount.value <= 0) return;
    if (gridShellEl.contains(e.target)) return;

    clearRowSelection(api);
  }

  onMounted(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("mousedown", handleDocumentMouseDown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleGlobalKeydown);
    document.removeEventListener("mousedown", handleDocumentMouseDown);
    dataStore.unregisterGridApi(dataStore.gridApi);
  });

  return {
    rowSelectionOptions,
    defaultColDef,
    hasSelection,
    hasValidationIssues,
    currentValidationIssueCount,
    currentFileValidationSummary,
    clearValidationIssues,
    getScopeValidationIssueCount,
    validateWorkbookScopes,
    refreshCurrentValidationScope,
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
