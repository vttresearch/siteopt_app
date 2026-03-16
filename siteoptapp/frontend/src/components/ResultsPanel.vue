<script setup>
import { computed, onMounted, watch, ref } from "vue"
import { useSettingStore } from "@/stores/settingstore.js"
import { useNotificationStore } from "@/stores/notificationstore.js"
import { postData } from "@/utils/functions.js"

import DashboardPanel from "@/components/DashboardPanel.vue"
import ResultsTable from "@/components/ResultsTable.vue"
import ScenarioComparisonPanel from "@/components/ScenarioComparisonPanel.vue"
import {
  getDashboardControlClass,
  getDashboardLoadingCardClass,
  getDashboardPageEmptyClass
} from "@/utils/chartStyleUtils.js"
import { mergeScenarioSheets } from "@/utils/chartUtils.js"

const settingStore = useSettingStore()
const notify = useNotificationStore()
const loadingResults = ref(false)
const columnDefs = ref([])
const rowData = ref([])
const runs = ref({})
const selectedRun = ref(null)
const selectedRunFiles = ref([])
const resultProjects = ref([])
const selectedProject = ref(null)
const activeTab = ref("plots")
const controlClass = computed(() => getDashboardControlClass())
const loadingCardClass = computed(() => getDashboardLoadingCardClass())
const pageEmptyClass = computed(() => getDashboardPageEmptyClass())

function getTabClass(tabName) {
  return activeTab.value === tabName
    ? "px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white shadow-sm"
    : "px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
}

async function fetchResultsList() {
  if (!selectedProject.value) return

  const r = await postData(
    "list_results",
    { project_name: selectedProject.value },
    notify
  )

  if (!r?.success) {
    runs.value = {}
    selectedRun.value = null
    selectedRunFiles.value = []
    columnDefs.value = []
    rowData.value = []
    return
  }

  runs.value = r.data || {}

  const firstRun = Object.keys(runs.value)[0]

  if (!firstRun) {
    selectedRun.value = null
    selectedRunFiles.value = []
    columnDefs.value = []
    rowData.value = []
    return
  }

  selectedRun.value = firstRun
}

async function fetchProjectsWithResults() {
  const r = await postData("list_projects_with_results", {}, notify)

  if (!r?.success) {
    resultProjects.value = []
    return
  }

  resultProjects.value = r.data || []

  if (resultProjects.value.length > 0) {
    selectedProject.value = resultProjects.value[0].name
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

async function openResultsForRun() {
  if (!selectedRunFiles.value?.length) {
    columnDefs.value = []
    rowData.value = []
    return
  }

  loadingResults.value = true

  try {
    const filesWithData = []

    for (const fileEntry of selectedRunFiles.value) {
      const r = await postData(
        "fetch_data",
        { full_path: fileEntry.path },
        notify
      )

      if (!r?.success) {
        continue
      }

      const fileType = r.data?.filetype
      const fileData = r.data?.data

      if (fileType === "xlsx") {
        const sheets = fileData && typeof fileData === "object" ? fileData : {}
        const firstSheetName = Object.keys(sheets)[0]
        const firstSheet = firstSheetName ? sheets[firstSheetName] : null

        if (firstSheet?.columns?.length) {
          filesWithData.push({
            scenario: fileEntry.scenario,
            sheetData: firstSheet
          })
        }
      } else if (fileType === "csv") {
        filesWithData.push({
          scenario: fileEntry.scenario,
          sheetData: fileData
        })
      }
    }

    if (!filesWithData.length) {
      notify.show("No readable result files found for this run.", 4000, "error")
      columnDefs.value = []
      rowData.value = []
      return
    }

    const merged = mergeScenarioSheets(filesWithData)
    updateTableFromCsv(merged)
  } finally {
    loadingResults.value = false
  }
}

onMounted(async () => {
  await fetchProjectsWithResults()
})

watch(
  () => settingStore.activeProjectIndex,
  async () => {
    runs.value = {}
    selectedRun.value = null
    selectedRunFiles.value = []
    columnDefs.value = []
    rowData.value = []
    activeTab.value = "plots"

    await fetchProjectsWithResults()
  }
)

watch(selectedProject, async () => {
  runs.value = {}
  selectedRun.value = null
  selectedRunFiles.value = []
  columnDefs.value = []
  rowData.value = []
  activeTab.value = "plots"

  await fetchResultsList()
})

watch(selectedRun, async () => {
  if (!selectedRun.value) {
    selectedRunFiles.value = []
    columnDefs.value = []
    rowData.value = []
    return
  }

  selectedRunFiles.value = runs.value[selectedRun.value] || []
  await openResultsForRun()
})

</script>

<template>
  <div v-if="!resultProjects.length" class="p-4 text-gray-500">
    No projects with results available.
  </div>

  <div v-else class="max-w-[1600px] mx-auto space-y-6">
    <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800">Results Dashboard</h1>
        <p class="text-sm text-gray-500 mt-1">
          Browse model result files and compare scenario outputs.
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Project
        </label>

        <select
          v-model="selectedProject"
          :class="controlClass"
        >
          <option
            v-for="p in resultProjects"
            :key="p.name"
            :value="p.name"
          >
            {{ p.name }}
          </option>
        </select>
      </div>
      <div
        v-if="Object.keys(runs).length"
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Run
          </label>
          <select
            v-model="selectedRun"
            :class="controlClass"
          >
            <option
              v-for="runName in Object.keys(runs)"
              :key="runName"
              :value="runName"
            >
              {{ runName }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        :class="getTabClass('plots')"
        @click="activeTab = 'plots'"
      >
        Plots
      </button>
      <button
        type="button"
        :class="getTabClass('table')"
        @click="activeTab = 'table'"
      >
        Results table
      </button>
    </div>

    <div
      v-if="loadingResults"
      :class="loadingCardClass"
    >
      Loading results...
    </div>

    <div
      v-else-if="!Object.keys(runs).length"
      :class="pageEmptyClass"
    >
      Run the model to generate result files.
    </div>

    <div v-else>
      <div v-if="activeTab === 'plots'">
        <DashboardPanel title="Scenario comparison">
          <ScenarioComparisonPanel
            :data="rowData"
            :fileName="selectedProject && selectedRun
            ? `${selectedProject} – ${selectedRun}`
            : 'results'"
          />
        </DashboardPanel>
      </div>

      <div v-else>
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