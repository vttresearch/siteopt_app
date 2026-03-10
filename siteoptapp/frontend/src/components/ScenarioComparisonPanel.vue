<script setup>
import { ref, computed, watch } from "vue"
import ScenarioComparisonChart from "@/components/ScenarioComparisonChart.vue"
import {
  CHART_THEME,
  detectScenarioStructure,
  processScenarioComparisonData,
  processCategorySummedData
} from "@/utils/chartUtils.js"

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  fileName: {
    type: String,
    default: "Results"
  }
})

const chartHeight = ref(400)
const showScenarioSumChart = ref(true)
const selectedCategories = ref([])
const expandedSummaries = ref([])
const scenarioStructure = ref(null)

const categoryTotalsOption = ref({})
const defaultItemsOption = ref({})
const categoryItemsChartOptions = ref({})

const customPlotModalOpen = ref(false)
const customPlotSelectedItems = ref([])
const customPlotSelectedScenarios = ref([])
const customPlotChartOption = ref({})
const showCustomPlot = ref(false)
const customPlotHideZeroValues = ref(false)
const customPlotOrientation = ref("vertical")

const DEFAULT_CHART_SETTINGS = () => ({
  yAxisScale: "linear",
  topNValues: 10,
  useMinBarHeight: true,
  hideZeroValues: false,
  orientation: "vertical"
})

const categoryTotalsSettings = ref(DEFAULT_CHART_SETTINGS())
const defaultItemsSettings = ref({
  ...DEFAULT_CHART_SETTINGS(),
  hideZeroValues: true
})
const categoryItemsSettings = ref({})
const customPlotSettings = ref({ ...DEFAULT_CHART_SETTINGS() })

const settingsModalOpen = ref(false)
const settingsModalTarget = ref(null)
const modalSettings = ref({ ...DEFAULT_CHART_SETTINGS() })

const availableScenarios = computed(() => scenarioStructure.value?.scenarios || [])
const availableItems = computed(() => scenarioStructure.value?.items || [])
const hasSummaries = computed(() => scenarioStructure.value?.hasSummaries || false)
const availableSummaries = computed(() => scenarioStructure.value?.summaries || [])

function normalizeString(value) {
  return String(value || "").trim()
}

function applyTopNFilter(chartConfig, topN) {
  if (!chartConfig || !chartConfig.series || topN <= 0) {
    return chartConfig
  }

  const isHorizontal = chartConfig.yAxis && chartConfig.yAxis.data
  const categories = isHorizontal
    ? (chartConfig.yAxis.data || [])
    : (chartConfig.xAxis?.data || [])

  if (!categories.length || categories.length <= topN) {
    return chartConfig
  }

  const getBarValue = (d) => {
    if (d == null) return 0
    if (typeof d === "object" && "value" in d) return Number(d.value) || 0
    return Number(d) || 0
  }

  const totals = {}
  categories.forEach((cat, catIndex) => {
    let total = 0
    for (const serie of chartConfig.series || []) {
      if (serie.data?.[catIndex] !== undefined) {
        total += Math.abs(getBarValue(serie.data[catIndex]))
      }
    }
    totals[cat] = total
  })

  const sorted = categories
    .map((name) => ({ name, total: totals[name] || 0 }))
    .sort((a, b) => b.total - a.total)

  const topCategories = sorted.slice(0, topN).map((x) => x.name)
  const otherCategories = sorted.slice(topN).map((x) => x.name)

  const newCategories = [...topCategories]
  let otherIndex = -1

  if (otherCategories.length > 0) {
    newCategories.push("Other")
    otherIndex = newCategories.length - 1
  }

  const categoryMap = {}
  categories.forEach((cat, origIndex) => {
    const topIndex = topCategories.indexOf(cat)
    if (topIndex >= 0) {
      categoryMap[origIndex] = topIndex
    } else if (otherCategories.includes(cat)) {
      categoryMap[origIndex] = otherIndex
    } else {
      categoryMap[origIndex] = -1
    }
  })

  const newSeries = (chartConfig.series || []).map((serie) => {
    const newData = new Array(newCategories.length).fill(0)

    ;(serie.data || []).forEach((value, origIndex) => {
      const newIndex = categoryMap[origIndex]
      if (newIndex >= 0) {
        newData[newIndex] = (newData[newIndex] || 0) + getBarValue(value)
      }
    })

    return {
      ...serie,
      data: newData
    }
  })

  const newConfig = {
    ...chartConfig,
    series: newSeries
  }

  if (isHorizontal) {
    newConfig.yAxis = {
      ...chartConfig.yAxis,
      data: newCategories
    }
  } else {
    newConfig.xAxis = {
      ...chartConfig.xAxis,
      data: newCategories
    }
  }

  return newConfig
}

function getItemsForSummary(summary) {
  const items = scenarioStructure.value?.summaryItemMap?.[summary] || []
  return items.map((i) => normalizeString(i))
}

function isSummaryExpanded(summary) {
  return expandedSummaries.value.includes(summary)
}

function toggleSummaryExpanded(summary) {
  const index = expandedSummaries.value.indexOf(summary)
  if (index > -1) {
    expandedSummaries.value.splice(index, 1)
  } else {
    expandedSummaries.value.push(summary)
  }
}

function isCategorySelected(category) {
  const norm = normalizeString(category)
  return selectedCategories.value.some((c) => normalizeString(c) === norm)
}

function toggleCategory(category) {
  const norm = normalizeString(category)
  const current = selectedCategories.value.map((c) => normalizeString(c))

  if (current.includes(norm)) {
    selectedCategories.value = selectedCategories.value.filter(
      (c) => normalizeString(c) !== norm
    )
  } else {
    const match =
      availableSummaries.value.find((s) => normalizeString(s) === norm) || category
    selectedCategories.value = [...selectedCategories.value, match]
  }
}

function getSettingsForTarget(target) {
  if (!target) return DEFAULT_CHART_SETTINGS()
  if (target === "categoryTotals") return { ...categoryTotalsSettings.value }
  if (target === "defaultItems") return { ...defaultItemsSettings.value }
  if (target === "customPlot") return { ...customPlotSettings.value }

  if (target?.type === "categoryItems" && target.categoryName) {
    return categoryItemsSettings.value[target.categoryName]
      ? { ...categoryItemsSettings.value[target.categoryName] }
      : DEFAULT_CHART_SETTINGS()
  }

  return DEFAULT_CHART_SETTINGS()
}

function openChartSettings(target) {
  settingsModalTarget.value = target
  modalSettings.value = getSettingsForTarget(target)
  settingsModalOpen.value = true
}

function closeChartSettings() {
  settingsModalOpen.value = false
  settingsModalTarget.value = null
}

function getCategoryItemsSettings(categoryName) {
  return categoryItemsSettings.value[categoryName] || DEFAULT_CHART_SETTINGS()
}

function updateCategoryTotalsChart() {
  if (!scenarioStructure.value) {
    categoryTotalsOption.value = {}
    defaultItemsOption.value = {}
    return
  }

  if (!scenarioStructure.value.hasSummaries) {
    categoryTotalsOption.value = {}
    defaultItemsOption.value = {}
    return
  }

  const allScenarios = scenarioStructure.value.scenarios.map((s) => normalizeString(s))

  const totalsSettings = categoryTotalsSettings.value
  const totalsChartType =
    totalsSettings.orientation === "vertical" ? "groupedBar" : "horizontalBar"

  const totalsConfig = processCategorySummedData(
    props.data,
    scenarioStructure.value,
    allScenarios,
    totalsChartType,
    totalsSettings.yAxisScale,
    totalsSettings.useMinBarHeight,
    totalsSettings.hideZeroValues
  )

  if (totalsConfig) {
    totalsConfig.title = {
      text: `Category totals: ${props.fileName}`,
      left: "center",
      textStyle: { fontSize: CHART_THEME.titleFontSize }
    }
    categoryTotalsOption.value = totalsConfig
  } else {
    categoryTotalsOption.value = {}
  }

  const allItems = (scenarioStructure.value.items || []).map((i) => normalizeString(i))
  const itemSettings = defaultItemsSettings.value
  const itemChartType =
    itemSettings.orientation === "vertical" ? "groupedBar" : "horizontalBar"

  const defaultConfig = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    allItems,
    allScenarios,
    itemChartType,
    false,
    [],
    itemSettings.yAxisScale,
    itemSettings.useMinBarHeight,
    itemSettings.hideZeroValues
  )

  if (defaultConfig) {
    defaultConfig.title = {
      text: `All items: ${props.fileName}`,
      left: "center",
      textStyle: { fontSize: CHART_THEME.titleFontSize }
    }
    defaultItemsOption.value = applyTopNFilter(defaultConfig, itemSettings.topNValues)
  } else {
    defaultItemsOption.value = {}
  }
}

function updateCategoryItemsChartFor(categoryName) {
  if (!categoryName || !scenarioStructure.value) return

  const categoryItems = scenarioStructure.value.summaryItemMap?.[categoryName] || []
  if (!categoryItems.length) {
    categoryItemsChartOptions.value = {
      ...categoryItemsChartOptions.value,
      [categoryName]: {}
    }
    return
  }

  const allScenarios = scenarioStructure.value.scenarios.map((s) => normalizeString(s))
  const settings = getCategoryItemsSettings(categoryName)
  const chartType = settings.orientation === "vertical" ? "groupedBar" : "horizontalBar"

  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    categoryItems.map((i) => normalizeString(i)),
    allScenarios,
    chartType,
    false,
    [],
    settings.yAxisScale,
    settings.useMinBarHeight,
    settings.hideZeroValues
  )

  if (config) {
    config.title = {
      text: `Items in "${categoryName}": ${props.fileName}`,
      left: "center",
      textStyle: { fontSize: CHART_THEME.titleFontSize }
    }

    categoryItemsChartOptions.value = {
      ...categoryItemsChartOptions.value,
      [categoryName]: applyTopNFilter(config, settings.topNValues)
    }
  } else {
    categoryItemsChartOptions.value = {
      ...categoryItemsChartOptions.value,
      [categoryName]: {}
    }
  }
}

function getCategoryChartOption(categoryName) {
  return categoryItemsChartOptions.value[categoryName] || {}
}

function applyChartSettings() {
  const target = settingsModalTarget.value
  if (!target) {
    closeChartSettings()
    return
  }

  const settings = { ...modalSettings.value }

  if (target === "categoryTotals") {
    categoryTotalsSettings.value = settings
    updateCategoryTotalsChart()
  } else if (target === "defaultItems") {
    defaultItemsSettings.value = settings
    updateCategoryTotalsChart()
  } else if (target === "customPlot") {
    customPlotSettings.value = settings
    customPlotHideZeroValues.value = settings.hideZeroValues
    rebuildCustomPlot()
  } else if (target?.type === "categoryItems" && target.categoryName) {
    categoryItemsSettings.value = {
      ...categoryItemsSettings.value,
      [target.categoryName]: settings
    }
    updateCategoryItemsChartFor(target.categoryName)
  }

  closeChartSettings()
}

function openCustomPlotModal() {
  customPlotSelectedItems.value = []
  customPlotSelectedScenarios.value = availableScenarios.value.map((s) =>
    normalizeString(s)
  )
  customPlotOrientation.value = "vertical"
  customPlotModalOpen.value = true
}

function closeCustomPlotModal() {
  customPlotModalOpen.value = false
}

function isCustomItemSelected(item) {
  const norm = normalizeString(item)
  return customPlotSelectedItems.value.some((i) => normalizeString(i) === norm)
}

function toggleCustomItem(item, isChecked) {
  const norm = normalizeString(item)
  const list = customPlotSelectedItems.value.map((i) => normalizeString(i))

  if (isChecked) {
    if (!list.includes(norm)) {
      customPlotSelectedItems.value = [...list, norm]
    }
  } else {
    customPlotSelectedItems.value = customPlotSelectedItems.value.filter(
      (i) => normalizeString(i) !== norm
    )
  }
}

function isCustomCategoryFullySelected(summary) {
  const items = getItemsForSummary(summary)
  return items.length > 0 && items.every((item) => isCustomItemSelected(item))
}

function toggleCustomCategoryAll(summary, isChecked) {
  const items = getItemsForSummary(summary)
  items.forEach((item) => toggleCustomItem(item, isChecked))
}

function isCustomScenarioSelected(scenario) {
  return customPlotSelectedScenarios.value.some(
    (s) => normalizeString(s) === normalizeString(scenario)
  )
}

function toggleCustomScenario(scenario) {
  const norm = normalizeString(scenario)
  const list = customPlotSelectedScenarios.value.map((s) => normalizeString(s))

  if (list.includes(norm)) {
    customPlotSelectedScenarios.value = customPlotSelectedScenarios.value.filter(
      (s) => normalizeString(s) !== norm
    )
  } else {
    customPlotSelectedScenarios.value = [...customPlotSelectedScenarios.value, scenario]
  }
}

function getCustomPlotItemsList() {
  return Array.from(new Set(customPlotSelectedItems.value.map((i) => normalizeString(i))))
}

function applyCustomPlot() {
  const items = getCustomPlotItemsList()
  const scenarios = customPlotSelectedScenarios.value.map((s) => normalizeString(s))

  if (!items.length || !scenarios.length) {
    closeCustomPlotModal()
    return
  }

  customPlotSettings.value.hideZeroValues = customPlotHideZeroValues.value
  const chartType =
    customPlotOrientation.value === "vertical" ? "groupedBar" : "horizontalBar"

  const settings = customPlotSettings.value
  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    items,
    scenarios,
    chartType,
    false,
    [],
    settings.yAxisScale,
    settings.useMinBarHeight,
    settings.hideZeroValues
  )

  if (config) {
    config.title = {
      text: `Custom plot: ${props.fileName}`,
      left: "center",
      textStyle: { fontSize: CHART_THEME.titleFontSize }
    }
    customPlotChartOption.value = applyTopNFilter(config, settings.topNValues)
    showCustomPlot.value = true
  }

  closeCustomPlotModal()
}

function rebuildCustomPlot() {
  if (!showCustomPlot.value || !scenarioStructure.value) return

  const items = getCustomPlotItemsList()
  const scenarios = customPlotSelectedScenarios.value.map((s) => normalizeString(s))
  if (!items.length || !scenarios.length) return

  const chartType =
    customPlotOrientation.value === "vertical" ? "groupedBar" : "horizontalBar"

  const settings = customPlotSettings.value
  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    items,
    scenarios,
    chartType,
    false,
    [],
    settings.yAxisScale,
    settings.useMinBarHeight,
    settings.hideZeroValues
  )

  if (config) {
    config.title = {
      text: `Custom plot: ${props.fileName}`,
      left: "center",
      textStyle: { fontSize: CHART_THEME.titleFontSize }
    }
    customPlotChartOption.value = applyTopNFilter(config, settings.topNValues)
  }
}

function closeCustomPlot() {
  showCustomPlot.value = false
  customPlotChartOption.value = {}
}

function initializeChart() {
  if (!props.data?.length) {
    scenarioStructure.value = null
    categoryTotalsOption.value = {}
    defaultItemsOption.value = {}
    categoryItemsChartOptions.value = {}
    return
  }

  const structure = detectScenarioStructure(props.data)
  scenarioStructure.value = structure

  if (!structure) {
    selectedCategories.value = []
    categoryTotalsOption.value = {}
    defaultItemsOption.value = {}
    categoryItemsChartOptions.value = {}
    return
  }

  if (selectedCategories.value.length && structure.summaries) {
    selectedCategories.value = selectedCategories.value.filter((sel) =>
      structure.summaries.some((s) => normalizeString(s) === normalizeString(sel))
    )
  }

  updateCategoryTotalsChart()

  selectedCategories.value.forEach((category) => {
    updateCategoryItemsChartFor(category)
  })
}

watch(
  () => props.data,
  () => {
    initializeChart()
  },
  { immediate: true, deep: true }
)

watch(
  () => [selectedCategories.value, categoryItemsSettings.value],
  () => {
    selectedCategories.value.forEach((category) => {
      updateCategoryItemsChartFor(category)
    })
  },
  { deep: true }
)
</script>

<template>
  <div class="h-full min-h-0 flex flex-col gap-4">
    <div class="text-xs text-gray-500 truncate">
      {{ fileName }}
    </div>

    <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
      <aside class="w-full lg:w-56 shrink-0 rounded-lg border border-gray-200 bg-white p-4 h-fit">
        <div class="space-y-3">
          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Overview
            </p>
            <button
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium rounded-lg border transition-colors"
              :class="showScenarioSumChart
                ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'"
              @click="showScenarioSumChart = !showScenarioSumChart"
            >
              <span class="text-lg leading-none">📊</span>
              <span>Scenario sum plot</span>
            </button>
          </div>

          <div v-if="availableSummaries.length">
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Summaries
            </p>

            <button
              v-for="summary in availableSummaries"
              :key="summary"
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium rounded-lg border transition-colors"
              :class="isCategorySelected(summary)
                ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'"
              @click="toggleCategory(summary)"
            >
              <span class="text-lg leading-none">📈</span>
              <span class="truncate">Plot {{ summary }}</span>
            </button>
          </div>

          <div>
            <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Custom
            </p>
            <button
              type="button"
              class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
              @click="openCustomPlotModal"
            >
              <span class="text-lg leading-none">📉</span>
              <span>Custom plot</span>
            </button>
          </div>
        </div>
      </aside>

      <div class="flex-1 min-w-0 overflow-auto pr-1">
        <div v-if="showScenarioSumChart" class="rounded-lg border border-gray-200 bg-white p-3 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-800">Category totals</h4>
            <button
              type="button"
              class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              @click="openChartSettings('categoryTotals')"
            >
              Settings
            </button>
          </div>

          <ScenarioComparisonChart
            :option="categoryTotalsOption"
            :height="chartHeight"
            empty-message="No category totals data available."
          />
        </div>

        <div
          v-if="defaultItemsOption && Object.keys(defaultItemsOption).length"
          class="rounded-lg border border-gray-200 bg-white p-3 mb-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-800">All items with non-zero values</h4>
            <button
              type="button"
              class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              @click="openChartSettings('defaultItems')"
            >
              Settings
            </button>
          </div>

          <ScenarioComparisonChart
            :option="defaultItemsOption"
            :height="chartHeight"
            empty-message="No item data available."
          />
        </div>

        <div
          v-for="category in selectedCategories"
          :key="category"
          class="rounded-lg border border-gray-200 bg-white p-3 mb-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-800">
              Items in "{{ category }}"
            </h4>
            <button
              type="button"
              class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              @click="openChartSettings({ type: 'categoryItems', categoryName: category })"
            >
              Settings
            </button>
          </div>

          <ScenarioComparisonChart
            :option="getCategoryChartOption(category)"
            :height="chartHeight"
            empty-message="No items data available for this category."
          />
        </div>

        <div
          v-if="showCustomPlot && customPlotChartOption && Object.keys(customPlotChartOption).length"
          class="rounded-lg border border-gray-200 bg-white p-3 mb-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-800">Custom plot</h4>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                @click="openChartSettings('customPlot')"
              >
                Settings
              </button>
              <button
                type="button"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                @click="closeCustomPlot"
              >
                Close
              </button>
            </div>
          </div>

          <ScenarioComparisonChart
            :option="customPlotChartOption"
            :height="chartHeight"
            empty-message="No custom plot data available."
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="customPlotModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeCustomPlotModal"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div class="p-4 border-b font-semibold text-gray-800">Define custom plot</div>

          <div class="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Categories & items
              </label>

              <div class="max-h-48 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <template v-if="hasSummaries">
                  <div
                    v-for="summary in availableSummaries"
                    :key="summary"
                    class="mb-1"
                  >
                    <button
                      type="button"
                      class="w-full flex items-center justify-between text-xs font-medium text-gray-700 hover:text-gray-900 mb-1"
                      @click="toggleSummaryExpanded(summary)"
                    >
                      <span class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          class="w-3 h-3 rounded border border-gray-400"
                          :checked="isCustomCategoryFullySelected(summary)"
                          @change.stop="toggleCustomCategoryAll(summary, $event.target.checked)"
                        />
                        <span
                          class="inline-block transition-transform"
                          :class="isSummaryExpanded(summary) ? 'rotate-90' : ''"
                        >
                          ▶
                        </span>
                        <span>{{ summary }}</span>
                      </span>
                    </button>

                    <div v-if="isSummaryExpanded(summary)" class="ml-4 space-y-1">
                      <label
                        v-for="item in getItemsForSummary(summary)"
                        :key="item"
                        class="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          :checked="isCustomItemSelected(item)"
                          @change="toggleCustomItem(item, $event.target.checked)"
                          class="rounded"
                        />
                        <span class="text-sm truncate">{{ item }}</span>
                      </label>
                    </div>
                  </div>
                </template>

                <template v-else>
                  <label
                    v-for="item in availableItems"
                    :key="item"
                    class="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :checked="isCustomItemSelected(normalizeString(item))"
                      @change="toggleCustomItem(normalizeString(item), $event.target.checked)"
                      class="rounded"
                    />
                    <span class="text-sm truncate">{{ item }}</span>
                  </label>
                </template>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Scenarios
              </label>

              <div class="max-h-48 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <label
                  v-for="scenario in availableScenarios"
                  :key="scenario"
                  class="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="isCustomScenarioSelected(scenario)"
                    @change="toggleCustomScenario(scenario)"
                    class="rounded"
                  />
                  <span class="text-sm truncate">{{ scenario }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="p-4 border-t flex flex-wrap items-center justify-between gap-4">
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="customPlotHideZeroValues" class="rounded" />
                <span class="text-sm text-gray-700">Hide zero values</span>
              </label>

              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-700">Orientation:</span>

                <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                  <input type="radio" value="horizontal" v-model="customPlotOrientation" />
                  <span>Horizontal</span>
                </label>

                <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                  <input type="radio" value="vertical" v-model="customPlotOrientation" />
                  <span>Vertical</span>
                </label>
              </div>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                @click="closeCustomPlotModal"
                class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="applyCustomPlot"
                class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Show plot
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="settingsModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeChartSettings"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
          <div class="p-4 border-b font-semibold text-gray-800">Plot settings</div>

          <div class="p-4 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Y-axis scale</label>
              <select
                v-model="modalSettings.yAxisScale"
                class="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="linear">Linear</option>
                <option value="log">Logarithmic</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Show top {{ modalSettings.topNValues }} values
              </label>
              <input
                type="range"
                v-model.number="modalSettings.topNValues"
                min="1"
                max="50"
                class="w-full"
              />
              <div class="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>{{ modalSettings.topNValues }}</span>
                <span>50</span>
              </div>
            </div>

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="modalSettings.useMinBarHeight" class="rounded" />
              <span class="text-sm text-gray-700">Show minimum bar height for small values</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="modalSettings.hideZeroValues" class="rounded" />
              <span class="text-sm text-gray-700">Hide zero values</span>
            </label>

            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-700">Orientation</span>

              <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                <input type="radio" value="horizontal" v-model="modalSettings.orientation" />
                <span>Horizontal</span>
              </label>

              <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                <input type="radio" value="vertical" v-model="modalSettings.orientation" />
                <span>Vertical</span>
              </label>
            </div>
          </div>

          <div class="p-4 border-t flex justify-end gap-2">
            <button
              type="button"
              @click="closeChartSettings"
              class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="applyChartSettings"
              class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>