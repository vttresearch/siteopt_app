import assert from "node:assert/strict";

import {
  parseCsvLine,
  validateTimeValueCsvText,
} from "../inputCsvUploadUtils.js";

export const inputCsvUploadTests = [
  {
    name: "parseCsvLine handles quoted commas",
    run() {
      assert.deepEqual(parseCsvLine('"2021-01-01, 00:00",24.35'), [
        "2021-01-01, 00:00",
        "24.35",
      ]);
    },
  },
  {
    name: "validateTimeValueCsvText accepts time value CSV",
    run() {
      const result = validateTimeValueCsvText(
        "time,value\n2021-01-01 00:00:00,24.35\n2021-01-01 01:00:00,25",
      );

      assert.equal(result.valid, true);
    },
  },
  {
    name: "validateTimeValueCsvText rejects wrong headers",
    run() {
      const result = validateTimeValueCsvText("timestamp,value\n2021-01-01,24.35");

      assert.equal(result.valid, false);
      assert.match(result.message, /time,value/);
    },
  },
  {
    name: "validateTimeValueCsvText rejects non-numeric values",
    run() {
      const result = validateTimeValueCsvText("time,value\n2021-01-01,abc");

      assert.equal(result.valid, false);
      assert.match(result.message, /numeric/);
    },
  },
];
