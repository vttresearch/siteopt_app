export const COLUMN_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  INTEGER: "integer",
  SELECT: "select",
  NUMBER_OR_REFERENCE: "number_or_reference",
  REFERENCE: "reference",
};

const FILE_SCHEMAS = {
  "connections-input.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          node1: { type: COLUMN_TYPES.TEXT, required: true },
          node2: { type: COLUMN_TYPES.TEXT, required: true },
          grid: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: ["elec", "heat", "cool"],
          },
          alternative_name: { type: COLUMN_TYPES.TEXT },
          connection_flow_cost: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          "connection_flow_cost.mul": { type: COLUMN_TYPES.NUMBER },
          connection_flow_cost_reverse: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          "connection_flow_cost_reverse.mul": { type: COLUMN_TYPES.NUMBER },
          connection_capacity: { type: COLUMN_TYPES.NUMBER },
          connection_investment_cost: { type: COLUMN_TYPES.NUMBER },
          efficiency: { type: COLUMN_TYPES.NUMBER },
          candidate_connections: { type: COLUMN_TYPES.INTEGER },
          fix_ratio_out_in_connection_flow: { type: COLUMN_TYPES.NUMBER },
          connection_investment_variable_type: {
            type: COLUMN_TYPES.SELECT,
            options: [
              "connection_investment_variable_type_continuous",
              "connection_investment_variable_type_integer",
              "connection_investment_variable_type_binary",
            ],
          },
        },
      },
    },
  },
  "hp-input.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          block_identifier: { type: COLUMN_TYPES.TEXT, required: true },
          alternative_name: { type: COLUMN_TYPES.TEXT, required: true },
          type: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: ["heat", "cool"],
          },
          unit_capacity: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          unit_investment_cost: { type: COLUMN_TYPES.NUMBER },
          cop_profile: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          candidate_units: { type: COLUMN_TYPES.INTEGER },
          emissionnode: { type: COLUMN_TYPES.TEXT },
          investment_emission: { type: COLUMN_TYPES.NUMBER },
          emission_cost: { type: COLUMN_TYPES.NUMBER },
        },
      },
    },
  },
  "pv-input.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          block_identifier: { type: COLUMN_TYPES.TEXT, required: true },
          grid: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: ["elec", "heat"],
          },
          name: { type: COLUMN_TYPES.TEXT, required: true },
          alternative_name: { type: COLUMN_TYPES.TEXT, required: true },
          unit_capacity: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          unit_investment_cost: { type: COLUMN_TYPES.NUMBER },
          candidate_units: { type: COLUMN_TYPES.INTEGER },
          emissionnode: { type: COLUMN_TYPES.TEXT },
          investment_emission: { type: COLUMN_TYPES.NUMBER },
          emission_cost: { type: COLUMN_TYPES.NUMBER },
          representative_unit: { type: COLUMN_TYPES.TEXT },
        },
      },
    },
  },
  "nodes.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          node: { type: COLUMN_TYPES.TEXT, required: true },
          grid: {
            type: COLUMN_TYPES.SELECT,
            options: ["elec", "heat", "cool"],
          },
          alternative_name: { type: COLUMN_TYPES.TEXT },
          balance_type: { type: COLUMN_TYPES.TEXT },
          free_node: { type: COLUMN_TYPES.TEXT },
          demand: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          representative_node: { type: COLUMN_TYPES.TEXT },
        },
      },
    },
  },
  "storages-input.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          block_identifier: { type: COLUMN_TYPES.TEXT, required: true },
          type: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: ["", "elec", "heat"],
          },
          alternative_name: { type: COLUMN_TYPES.TEXT, required: true },
          node_state_cap: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          capacity: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          max_charging: { type: COLUMN_TYPES.NUMBER },
          max_discharging: { type: COLUMN_TYPES.NUMBER },
          demand: { type: COLUMN_TYPES.NUMBER_OR_REFERENCE },
          unit_investment_cost: { type: COLUMN_TYPES.NUMBER },
          storage_investment_cost: { type: COLUMN_TYPES.NUMBER },
          candidate_units: { type: COLUMN_TYPES.INTEGER },
          candidate_storages: { type: COLUMN_TYPES.INTEGER },
          storage_investment_variable_type: {
            type: COLUMN_TYPES.SELECT,
            required: true,
            options: [
              "storage_investment_variable_type_continuous",
              "storage_investment_variable_type_integer",
              "storage_investment_variable_type_binary",
            ],
          },
          emissionnode: { type: COLUMN_TYPES.TEXT },
          investment_emission: { type: COLUMN_TYPES.NUMBER },
          emission_cost: { type: COLUMN_TYPES.NUMBER },
        },
      },
    },
  },
  "divertingunits.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          name: { type: COLUMN_TYPES.TEXT, required: true },
          inputnode: { type: COLUMN_TYPES.TEXT, required: true },
          outputnode: { type: COLUMN_TYPES.TEXT, required: true },
          divertingnode: { type: COLUMN_TYPES.TEXT, required: true },
          alternative_name: { type: COLUMN_TYPES.TEXT },
          diversionfactor: { type: COLUMN_TYPES.NUMBER },
          vom_cost: { type: COLUMN_TYPES.NUMBER },
        },
      },
    },
  },
  "group_potential.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          block_identifier: { type: COLUMN_TYPES.TEXT, required: true },
          grid: {
            type: COLUMN_TYPES.SELECT,
            options: ["elec", "heat", "cool"],
          },
          name: { type: COLUMN_TYPES.TEXT, required: true },
          alternative_name: { type: COLUMN_TYPES.TEXT },
          group: { type: COLUMN_TYPES.TEXT },
          candidate_units: { type: COLUMN_TYPES.INTEGER },
        },
      },
    },
  },
  "modelspec.xlsx": {
    sheets: {
      objects: {
        columns: {
          objectclass: { type: COLUMN_TYPES.TEXT, required: true },
          object: { type: COLUMN_TYPES.TEXT, required: true },
        },
      },
      relationships: {
        columns: {
          relationshipclass: { type: COLUMN_TYPES.TEXT, required: true },
          "Objectclass 1": { type: COLUMN_TYPES.TEXT, required: true },
          "Objectclass 2": { type: COLUMN_TYPES.TEXT, required: true },
          "Object 1": { type: COLUMN_TYPES.TEXT, required: true },
          "Object 2": { type: COLUMN_TYPES.TEXT, required: true },
        },
      },
      params_1d_datetimes: {
        columns: {
          objectclass: { type: COLUMN_TYPES.TEXT, required: true },
          object: { type: COLUMN_TYPES.TEXT, required: true },
          parameter_name: { type: COLUMN_TYPES.TEXT, required: true },
          alternative_name: { type: COLUMN_TYPES.TEXT },
          parameter_value: { type: COLUMN_TYPES.TEXT },
        },
      },
      params_1d_durations: {
        columns: {
          objectclass: { type: COLUMN_TYPES.TEXT, required: true },
          object: { type: COLUMN_TYPES.TEXT, required: true },
          "parameter name": { type: COLUMN_TYPES.TEXT, required: true },
          "alternative name": { type: COLUMN_TYPES.TEXT },
          "parameter value": { type: COLUMN_TYPES.TEXT },
        },
      },
      params_1d_strings: {
        columns: {
          objectclass: { type: COLUMN_TYPES.TEXT, required: true },
          object: { type: COLUMN_TYPES.TEXT, required: true },
          "parameter name": { type: COLUMN_TYPES.TEXT, required: true },
          "alternative name": { type: COLUMN_TYPES.TEXT },
          "parameter value": { type: COLUMN_TYPES.TEXT },
        },
      },
    },
  },
  "scenarios.xlsx": {
    sheets: {
      scenario: {
        columns: {
          scenario: { type: COLUMN_TYPES.TEXT, required: true },
        },
      },
      alternative: {
        columns: {
          alternative: { type: COLUMN_TYPES.TEXT, required: true },
        },
      },
      scenario_alternative: {
        columns: {
          scenario: { type: COLUMN_TYPES.TEXT, required: true },
          lower_alternative: { type: COLUMN_TYPES.TEXT, required: true },
          higher_alternative: { type: COLUMN_TYPES.TEXT, required: true },
        },
      },
    },
  },
  "results.xlsx": {
    sheets: {
      Sheet1: {
        columns: {
          summary: { type: COLUMN_TYPES.TEXT },
          item: { type: COLUMN_TYPES.TEXT },
          scenario: { type: COLUMN_TYPES.TEXT },
          value: { type: COLUMN_TYPES.NUMBER },
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
      cellEditorPopup: true,
      cellEditorParams: { values: schema.options ?? fallbackOptions },
      cellDataType: "text",
      cellClass: "bg-blue-50 ag-cell-dropdown",
      headerClass: "ag-header-dropdown",
      headerTooltip: "Select from predefined values",
    };
  }

  if (
    schema.type === COLUMN_TYPES.NUMBER ||
    schema.type === COLUMN_TYPES.INTEGER ||
    schema.type === COLUMN_TYPES.NUMBER_OR_REFERENCE
  ) {
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
