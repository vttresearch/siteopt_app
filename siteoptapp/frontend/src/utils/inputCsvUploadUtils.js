export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function validateTimeValueCsvText(csvText) {
  const lines = String(csvText ?? "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    return {
      valid: false,
      message: "CSV must contain a header and at least one data row.",
    };
  }

  const header = parseCsvLine(lines[0]).map((column) => column.toLowerCase());
  if (header.length !== 2 || header[0] !== "time" || header[1] !== "value") {
    return {
      valid: false,
      message: "CSV header must be exactly: time,value",
    };
  }

  for (let i = 1; i < lines.length; i += 1) {
    const rowNumber = i + 1;
    const row = parseCsvLine(lines[i]);

    if (row.length !== 2) {
      return {
        valid: false,
        message: `CSV row ${rowNumber} must contain exactly time and value.`,
      };
    }

    if (!row[0]) {
      return {
        valid: false,
        message: `CSV row ${rowNumber} has empty time.`,
      };
    }

    if (!Number.isFinite(Number(row[1]))) {
      return {
        valid: false,
        message: `CSV row ${rowNumber} value must be numeric.`,
      };
    }
  }

  return { valid: true };
}
