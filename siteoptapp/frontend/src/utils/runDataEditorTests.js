import { dataEditorLogicTests } from "./__tests__/dataEditorLogic.spec.js";
import { dataEditorHistoryTests } from "./__tests__/dataEditorHistory.spec.js";
import { dataEditorDocumentTests } from "./__tests__/dataEditorDocument.spec.js";
import { fileDataStoreTests } from "./__tests__/fileDataStore.spec.js";
import { inputCsvUploadTests } from "./__tests__/inputCsvUpload.spec.js";
import { sheetStoreTests } from "./__tests__/sheetStore.spec.js";

const suites = [
  {
    name: "Data Editor Logic",
    tests: dataEditorLogicTests,
  },
  {
    name: "Data Editor History",
    tests: dataEditorHistoryTests,
  },
  {
    name: "Data Editor Document",
    tests: dataEditorDocumentTests,
  },
  {
    name: "File Data Store",
    tests: fileDataStoreTests,
  },
  {
    name: "Input CSV Upload",
    tests: inputCsvUploadTests,
  },
  {
    name: "Sheet Store Contract",
    tests: sheetStoreTests,
  },
];

let failures = 0;
let total = 0;

for (const suite of suites) {
  console.log(`\n${suite.name}`);

  for (const testCase of suite.tests) {
    total += 1;
    try {
      await testCase.run();
      console.log(`PASS ${testCase.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${testCase.name}`);
      console.error(error);
    }
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`\nAll ${total} Data Editor tests passed.`);
}
