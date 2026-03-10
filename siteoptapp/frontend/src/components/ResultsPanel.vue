<script setup>
import { computed, onMounted, watch, ref } from "vue"
import { useSettingStore } from "@/stores/settingstore.js"
import { useNotificationStore } from "@/stores/notificationstore.js"
import { postData, fetchWorkFolderFiles } from "@/utils/functions.js"

import DashboardPanel from "@/components/DashboardPanel.vue"
import ResultsTable from "@/components/ResultsTable.vue"
import ScenarioComparisonPanel from "@/components/ScenarioComparisonPanel.vue"

const settingStore = useSettingStore()
const notify = useNotificationStore()

const loadingResults = ref(false)

const columnDefs = ref([])
const rowData = ref([])

const scenarios = ref({})
const selectedScenario = ref(null)
const selectedRun = ref(null)
const resultsFullPath = ref("")

const activeRoot = computed(() => {
  const i = settingStore.activeProjectIndex ?? 0
  return settingStore.workFolderFiles?.[i] ?? null
})

const projectName = computed(() => activeRoot.value?.name ?? "")

async function fetchResultsList() {
  if (!projectName.value) return

  const r = await postData(
    "list_results",
    { project_name: projectName.value },
    notify
  )

  if (!r?.success) {
    scenarios.value = {}
    selectedScenario.value = null
    selectedRun.value = null
    resultsFullPath.value = ""
    return
  }

  scenarios.value = r.data || {}

  const firstScenario = Object.keys(scenarios.value)[0]

  if (!firstScenario) {
    selectedScenario.value = null
    selectedRun.value = null
    resultsFullPath.value = ""
    columnDefs.value = []
    rowData.value = []
    return
  }

  selectedScenario.value = firstScenario

  const runs = scenarios.value[firstScenario] || []
  if (runs.length > 0) {
    selectedRun.value = runs[0]
    resultsFullPath.value = runs[0].path
    await openResults()
  }
}

function updateTableFromCsv(csvData) {
  const cols = csvData?.columns ?? []
  const rows = csvData?.rows ?? []

  columnDefs.value = [
    {
      headerName: "#",
      valueGetter: "node.rowIndex + 1",
      width: 75,
      pinned: "left",
      editable: false,
      sortable: false,
      filter: false
    },
    ...cols.map((col) => ({
      headerName: col,
      field: col,
      minWidth: 120,
      editable: false,
      sortable: true,
      filter: true,
      resizable: true
    }))
  ]

  rowData.value = rows
}

function updateTableFromXlsx(sheetData) {
  const cols = sheetData?.columns ?? []
  const rows = sheetData?.rows ?? []

  updateTableFromCsv({
    columns: cols,
    rows
  })
}

async function openResults() {
  if (!resultsFullPath.value) return

  loadingResults.value = true

  const r = await postData(
    "fetch_data",
    { full_path: resultsFullPath.value },
    notify
  )

  if (!r?.success) {
    notify.show("Could not load result file.", 4000, "error")
    columnDefs.value = []
    rowData.value = []
    loadingResults.value = false
    return
  }

  const fileType = r.data?.filetype
  const fileData = r.data?.data

  if (fileType === "csv") {
    updateTableFromCsv(fileData)
  } else if (fileType === "xlsx") {
    const sheets = fileData && typeof fileData === "object" ? fileData : {}
    const firstSheetName = Object.keys(sheets)[0]
    const firstSheet = firstSheetName ? sheets[firstSheetName] : null

    if (firstSheet?.columns?.length) {
      updateTableFromXlsx(firstSheet)
    } else {
      notify.show("results.xlsx has no readable sheet data.", 4000, "error")
      columnDefs.value = []
      rowData.value = []
    }
  } else {
    notify.show(`Unsupported results file type: ${fileType}`, 4000, "error")
    columnDefs.value = []
    rowData.value = []
  }

  loadingResults.value = false
}

onMounted(async () => {
  await fetchWorkFolderFiles()
  await fetchResultsList()
})

watch(
  () => settingStore.activeProjectIndex,
  async () => {
    scenarios.value = {}
    selectedScenario.value = null
    selectedRun.value = null
    resultsFullPath.value = ""
    columnDefs.value = []
    rowData.value = []

    await fetchResultsList()
  }
)

watch(selectedScenario, async () => {
  const runs = scenarios.value[selectedScenario.value] || []

  if (runs.length > 0) {
    selectedRun.value = runs[0]
  } else {
    selectedRun.value = null
    resultsFullPath.value = ""
    columnDefs.value = []
    rowData.value = []
  }
})

watch(selectedRun, async () => {
  if (!selectedRun.value) return

  resultsFullPath.value = selectedRun.value.path
  await openResults()
})
</script>

<template>
  <div v-if="!activeRoot" class="p-4 text-gray-500">
    Select a project to view results.
  </div>

  <div v-else class="max-w-[1600px] mx-auto space-y-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800">Results Dashboard</h1>
        <p class="text-sm text-gray-500 mt-1">
          Browse model result files and compare scenario outputs.
        </p>
      </div>

      <div
        v-if="Object.keys(scenarios).length"
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Scenario
          </label>
          <select
            v-model="selectedScenario"
            class="w-full sm:w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option
              v-for="(runs, name) in scenarios"
              :key="name"
              :value="name"
            >
              {{ name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Run
          </label>
          <select
            v-model="selectedRun"
            class="w-full sm:w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option
              v-for="run in scenarios[selectedScenario] || []"
              :key="run.run"
              :value="run"
            >
              {{ run.run }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div
      v-if="loadingResults"
      class="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm"
    >
      Loading results...
    </div>

    <div
      v-else-if="!Object.keys(scenarios).length"
      class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500"
    >
      Run the model to generate result files.
    </div>

    <div v-else class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div class="xl:col-span-8">
        <DashboardPanel title="Scenario comparison">
          <ScenarioComparisonPanel
            :data="rowData"
            :fileName="projectName ? `${projectName} – results.xlsx` : 'results.xlsx'"
          />
        </DashboardPanel>
      </div>

      <div class="xl:col-span-4">
        <DashboardPanel title="Results table">
          <div class="h-[700px]">
            <ResultsTable
              :columnDefs="columnDefs"
              :rowData="rowData"
            />
          </div>
        </DashboardPanel>
      </div>
    </div>
  </div>
</template>