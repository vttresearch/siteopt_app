<script setup>
import { computed, onMounted, watch, ref } from "vue";
import { AgGridVue } from "ag-grid-vue3";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postData, fetchWorkFolderFiles } from "@/utils/functions.js";
import ScenarioComparisonChart from "@/components/ScenarioComparisonChart.vue";

const settingStore = useSettingStore();
const notify = useNotificationStore();

const loadingResults = ref(false);
const gridApi = ref(null);
const columnDefs = ref([]);
const rowData = ref([]);

// Each element in workFolderFiles is the root tree node { name, path, children }
const activeRoot = computed(() => {
  const i = settingStore.activeProjectIndex ?? 0;
  return settingStore.workFolderFiles?.[i] ?? null;
});

const basePath = computed(() => activeRoot.value?.path ?? "");
const projectName = computed(() => activeRoot.value?.name ?? "");

const resultsFullPath = computed(() => {
  if (!basePath.value || !projectName.value) return "";
  return `${basePath.value}/${projectName.value}/results.xlsx`;
});

function updateTableFromCsv(csvData) {
  const cols = csvData?.columns ?? [];
  const rows = csvData?.rows ?? [];

  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      cellClass: "bg-gray-50 font-medium text-left",
      editable: false,
    },
    ...cols.map((col) => ({
      headerName: col,
      field: col,
      minWidth: 100,
      editable: false,
    })),
  ];

  rowData.value = rows;
}

function updateTableFromXlsx(sheetData) {
  const cols = sheetData?.columns ?? [];
  const rows = sheetData?.rows ?? [];
  updateTableFromCsv({ columns: cols, rows });
}

async function openResults() {
  if (!resultsFullPath.value) return;

  loadingResults.value = true;

  const r = await postData(
    "fetch_data",
    { full_path: resultsFullPath.value },
    notify
  );

  if (r?.success) {
    const fileType = r.data?.filetype;
    const fileData = r.data?.data;

    if (fileType === "csv") {
      updateTableFromCsv(fileData);
    } else if (fileType === "xlsx") {
      const sheets = fileData && typeof fileData === "object" ? fileData : {};
      const firstSheetName = Object.keys(sheets)[0];
      const firstSheet = firstSheetName ? sheets[firstSheetName] : null;
      if (firstSheet?.columns?.length) {
        updateTableFromXlsx(firstSheet);
      } else {
        notify.show("results.xlsx has no sheet data.", 4000, "error");
      }
    } else {
      notify.show("results.xlsx could not be read.", 4000, "error");
    }
  } else {
    notify.show("Could not load results.xlsx", 4000, "error");
  }

  loadingResults.value = false;
}

onMounted(async () => {
  await fetchWorkFolderFiles();
  if (resultsFullPath.value) await openResults();
});

watch(
  () => [settingStore.activeProjectIndex, resultsFullPath.value],
  async () => {
    if (!resultsFullPath.value) {
      columnDefs.value = [];
      rowData.value = [];
      return;
    }
    await openResults();
  }
);
</script>

<template>
  <div v-if="!activeRoot" class="text-gray-500 p-4">
    Select a project to view results.
  </div>

  <div v-else-if="!loadingResults && !columnDefs.length" class="text-gray-500 p-4">
    Run the model to generate <span class="font-mono">results.xlsx</span>.
  </div>

  <div v-else>
    <div class="mb-3 text-lg font-semibold text-gray-800">
      Results (results.xlsx)
    </div>

    <div v-if="loadingResults" class="p-4 text-gray-500">
      Loading results...
    </div>

    <div v-else-if="columnDefs.length" class="space-y-6">
      <div class="w-full h-80 overflow-auto">
        <AgGridVue
          class="w-full h-full"
          :domLayout="'normal'"
          :columnDefs="columnDefs"
          :rowData="rowData"
          @grid-ready="(params) => (gridApi = params.api)"
          :rowBuffer="10"
          :rowHeight="40"
          :animateRows="true"
          :rowSelection.enableClickSelection="false"
          :suppressColumnVirtualization="false"
          :suppressCellFocus="true"
          :suppressAnimationFrame="true"
          :enableCellTextSelection="false"
        />
      </div>

      <div class="mt-6 border-t pt-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Scenario comparison</h3>
        <ScenarioComparisonChart
          :data="rowData"
          :fileName="projectName ? `${projectName} – results.xlsx` : 'results.xlsx'"
        />
      </div>
    </div>

    <div v-else class="p-4 text-gray-500">
      No data found in results.xlsx.
    </div>
  </div>
</template>