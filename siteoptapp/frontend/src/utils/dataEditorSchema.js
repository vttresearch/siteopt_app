export const COLUMN_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  INTEGER: "integer",
  SELECT: "select",
};

const FILE_SCHEMAS = {
  "storages-input.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          block_identifier: {
            type: COLUMN_TYPES.TEXT,
            required: true,
          },
          type: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: ["heat", "elec"],
          },
          alternative_name: {
            type: COLUMN_TYPES.TEXT,
            required: true,
          },
          node_state_cap: {
            type: COLUMN_TYPES.NUMBER,
          },
          max_charging: {
            type: COLUMN_TYPES.NUMBER,
          },
          max_discharging: {
            type: COLUMN_TYPES.NUMBER,
          },
          demand: {
            type: COLUMN_TYPES.NUMBER,
          },
          unit_investment_cost: {
            type: COLUMN_TYPES.NUMBER,
          },
          storage_investment_cost: {
            type: COLUMN_TYPES.NUMBER,
          },
          candidate_units: {
            type: COLUMN_TYPES.INTEGER,
          },
          candidate_storages: {
            type: COLUMN_TYPES.INTEGER,
          },
          storage_investment_variable_type: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: [
              "storage_investment_variable_type_continuous",
              "storage_investment_variable_type_integer",
              "storage_investment_variable_type_binary",
            ],
          },
          emissionnode: {
            type: COLUMN_TYPES.TEXT,
          },
          investment_emission: {
            type: COLUMN_TYPES.NUMBER,
          },
          emission_cost: {
            type: COLUMN_TYPES.NUMBER,
          },
        },
      },
    },
  },
  "connections-input.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          node1: {
            type: COLUMN_TYPES.TEXT,
            required: true,
          },
          node2: {
            type: COLUMN_TYPES.TEXT,
            required: true,
          },
        },
      },
    },
  },
};

export function resolveColumnSchema({ fileName, sheetName, columnName }) {
  return FILE_SCHEMAS[fileName]?.sheets?.[sheetName]?.columns?.[columnName] ?? null;
}

export function buildColumnDefFromSchema({
  columnName,
  schema,
  fallbackOptions = [],
}) {
  if (!schema) return null;

  const baseDef = {
    headerName: columnName,
    field: columnName,
    minWidth: 100,
    editable: true,
  };

  if (schema.type === COLUMN_TYPES.SELECT) {
    return {
      ...baseDef,
      minWidth: 120,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: schema.options ?? fallbackOptions },
      cellDataType: "text",
      cellClass: "bg-blue-50 ag-cell-dropdown",
      headerClass: "ag-header-dropdown",
      headerTooltip: "Select from predefined values",
    };
  }

  if (schema.type === COLUMN_TYPES.NUMBER || schema.type === COLUMN_TYPES.INTEGER) {
    return {
      ...baseDef,
      cellEditor: "agTextCellEditor",
      cellDataType: "text",
    };
  }

  return {
    ...baseDef,
    cellDataType: "text",
  };
}
