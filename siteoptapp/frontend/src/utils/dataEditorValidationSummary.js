import { resolveColumnConfig, validateAndNormalizeCellValue } from "./dataEditorUtils.js";

export function summarizeTabularValidation({
  columns = [],
  rows = [],
  validationsByColumn = {},
  fileName,
  sheetName,
}) {
  let invalidCount = 0;

  for (const row of rows ?? []) {
    for (const columnName of columns ?? []) {
      const config = resolveColumnConfig({
        columnName,
        rows,
        validationOptions: validationsByColumn?.[columnName],
        fileName,
        sheetName,
      });

      const result = validateAndNormalizeCellValue({
        value: row?.[columnName] ?? "",
        columnName,
        type: config.type,
        options: config.options,
      });

      if (!result.valid) {
        invalidCount += 1;
      }
    }
  }

  return { invalidCount };
}

export function summarizeEditorFileValidation({ fileName, fileData }) {
  if (!fileData?.filetype) {
    return { invalidCount: 0, filetype: null };
  }

  if (fileData.filetype === "xlsx") {
    const sheets = {};
    let invalidCount = 0;

    for (const [sheetName, sheetData] of Object.entries(fileData.data ?? {})) {
      const summary = summarizeTabularValidation({
        columns: sheetData?.columns ?? [],
        rows: sheetData?.rows ?? [],
        validationsByColumn: sheetData?.validationsByColumn ?? {},
        fileName,
        sheetName,
      });
      sheets[sheetName] = summary;
      invalidCount += summary.invalidCount;
    }

    return {
      filetype: "xlsx",
      invalidCount,
      sheets,
    };
  }

  if (fileData.filetype === "csv") {
    const summary = summarizeTabularValidation({
      columns: fileData.data?.columns ?? [],
      rows: fileData.data?.rows ?? [],
      validationsByColumn: {},
      fileName,
      sheetName: "__csv__",
    });

    return {
      filetype: "csv",
      invalidCount: summary.invalidCount,
      sheets: {},
    };
  }

  return {
    filetype: fileData.filetype,
    invalidCount: 0,
    sheets: {},
  };
}
