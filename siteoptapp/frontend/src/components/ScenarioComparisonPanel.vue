<script setup>
import { ref, computed, watch } from "vue"
import ScenarioComparisonChart from "@/components/ScenarioComparisonChart.vue"
import {
  detectScenarioStructure,
  processScenarioComparisonData
} from "@/utils/chartUtils.js"
import { CHART_STYLE_THEME } from "@/utils/chartStyleUtils.js"
import ChartSettingsModal from "@/components/ChartSettingsModal.vue"
import CustomPlotModal from "@/components/CustomPlotModal.vue"

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

const selectedCategories = ref([])
const scenarioStructure = ref(null)

const categoryItemsChartOptions = ref({})

const customPlotModalOpen = ref(false)
const customPlotSelectedItems = ref([])
const customPlotSelectedScenarios = ref([])
const customPlotHideZeroValues = ref(false)
const customPlotOrientation = ref("vertical")
const customPlotTitle = ref("")
const customPlots = ref([])

const DEFAULT_CHART_SETTINGS = () => ({
  yAxisScale: "linear",
  topNValues: 10,
  useMinBarHeight: true,
  hideZeroValues: false,
  orientation: "vertical"
})

const categoryItemsSettings = ref({})

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

function makePlotId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
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

  const getDisplayValue = (d) => {
    if (d == null) return 0
    if (typeof d === "object" && "value" in d) return Number(d.value) || 0
    return Number(d) || 0
  }

  const getActualValue = (d) => {
    if (d == null) return 0
    if (typeof d === "object" && "actualValue" in d) return Number(d.actualValue) || 0
    if (typeof d === "object" && "value" in d) return Number(d.value) || 0
    return Number(d) || 0
  }

  const totals = {}
  categories.forEach((cat, catIndex) => {
    let total = 0
    for (const serie of chartConfig.series || []) {
      if (serie.data?.[catIndex] !== undefined) {
        total += Math.abs(getActualValue(serie.data[catIndex]))
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
    const newData = new Array(newCategories.length).fill(null).map(() => ({
      value: 0,
      actualValue: 0
    }))

    ;(serie.data || []).forEach((value, origIndex) => {
      const newIndex = categoryMap[origIndex]
      if (newIndex >= 0) {
        newData[newIndex].value += getDisplayValue(value)
        newData[newIndex].actualValue += getActualValue(value)
      }
    })

    return {
      ...serie,
      data: newData.map((d) => {
        if (d.actualValue === 0 && d.value === 0) return 0
        return d
      })
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

  if (target?.type === "customPlot" && target.id) {
    const plot = customPlots.value.find((p) => p.id === target.id)
    return plot ? { ...plot.settings } : DEFAULT_CHART_SETTINGS()
  }

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
      textStyle: { fontSize: CHART_STYLE_THEME.titleFontSize }
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

function buildCustomPlotOption(plotLike) {
  if (!scenarioStructure.value) return {}

  const chartType =
    plotLike.settings.orientation === "vertical" ? "groupedBar" : "horizontalBar"

  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    plotLike.items,
    plotLike.scenarios,
    chartType,
    false,
    [],
    plotLike.settings.yAxisScale,
    plotLike.settings.useMinBarHeight,
    plotLike.settings.hideZeroValues
  )

  if (!config) return {}

  config.title = {
    text: plotLike.title,
    left: "center",
    textStyle: { fontSize: CHART_STYLE_THEME.titleFontSize }
  }

  return applyTopNFilter(config, plotLike.settings.topNValues)
}

function applyChartSettings(settings) {
  const target = settingsModalTarget.value
  if (!target) {
    closeChartSettings()
    return
  }

  if (target?.type === "customPlot" && target.id) {
    customPlots.value = customPlots.value.map((plot) => {
      if (plot.id !== target.id) return plot

      const updatedPlot = {
        ...plot,
        settings: { ...settings }
      }

      return {
        ...updatedPlot,
        option: buildCustomPlotOption(updatedPlot)
      }
    })
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
  customPlotHideZeroValues.value = false
  customPlotOrientation.value = "vertical"
  customPlotTitle.value = ""
  customPlotModalOpen.value = true
}

function closeCustomPlotModal() {
  customPlotModalOpen.value = false
}

function getCustomPlotItemsList() {
  return Array.from(new Set(customPlotSelectedItems.value.map((i) => normalizeString(i))))
}

function applyCustomPlot() {
  const items = getCustomPlotItemsList()
  const scenarios = customPlotSelectedScenarios.value.map((s) => normalizeString(s))
  const title = customPlotTitle.value.trim() || `Custom plot ${customPlots.value.length + 1}`

  if (!items.length || !scenarios.length) {
    closeCustomPlotModal()
    return
  }

  const settings = {
    ...DEFAULT_CHART_SETTINGS(),
    hideZeroValues: customPlotHideZeroValues.value,
    orientation: customPlotOrientation.value
  }

  const plotDraft = {
    id: makePlotId(),
    title,
    items,
    scenarios,
    settings
  }

  const option = buildCustomPlotOption(plotDraft)
  if (!Object.keys(option).length) {
    closeCustomPlotModal()
    return
  }

  const existingIndex = customPlots.value.findIndex(
    (plot) => normalizeString(plot.title) === normalizeString(title)
  )

  if (existingIndex >= 0) {
    const existing = customPlots.value[existingIndex]
    customPlots.value[existingIndex] = {
      ...existing,
      title,
      items,
      scenarios,
      settings,
      option
    }
  } else {
    customPlots.value.push({
      ...plotDraft,
      option
    })
  }

  closeCustomPlotModal()
}

function closeCustomPlot(plotId) {
  customPlots.value = customPlots.value.filter((plot) => plot.id !== plotId)
}

function initializeChart() {
  if (!props.data?.length) {
    scenarioStructure.value = null
    categoryItemsChartOptions.value = {}
    customPlots.value = customPlots.value.map((plot) => ({
      ...plot,
      option: {}
    }))
    return
  }

  const structure = detectScenarioStructure(props.data)
  scenarioStructure.value = structure

  if (!structure) {
    selectedCategories.value = []
    categoryItemsChartOptions.value = {}
    customPlots.value = customPlots.value.map((plot) => ({
      ...plot,
      option: {}
    }))
    return
  }

  selectedCategories.value = structure.summaries ? [...structure.summaries] : []

  selectedCategories.value.forEach((category) => {
    updateCategoryItemsChartFor(category)
  })

  customPlots.value = customPlots.value.map((plot) => ({
    ...plot,
    option: buildCustomPlotOption(plot)
  }))
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
              <span class="truncate">{{ summary }}</span>
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
        <div
          v-for="category in selectedCategories"
          :key="category"
          class="rounded-lg border border-gray-200 bg-white p-3 mb-4"
        >
          <div class="flex items-center justify-end mb-1">
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                @click="openChartSettings({ type: 'categoryItems', categoryName: category })"
              >
                Settings
              </button>
              <button
                type="button"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                @click="toggleCategory(category)"
              >
                Close
              </button>
            </div>
          </div>

          <ScenarioComparisonChart
            :option="getCategoryChartOption(category)"
            :height="chartHeight"
            empty-message="No items data available for this category."
          />
        </div>

        <div
          v-for="plot in customPlots"
          :key="plot.id"
          class="rounded-lg border border-gray-200 bg-white p-3 mb-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-semibold text-gray-800">
              {{ plot.title }}
            </h4>
            <div class="flex gap-2">
              <button
                type="button"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                @click="openChartSettings({ type: 'customPlot', id: plot.id })"
              >
                Settings
              </button>
              <button
                type="button"
                class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                @click="closeCustomPlot(plot.id)"
              >
                Close
              </button>
            </div>
          </div>

          <ScenarioComparisonChart
            :option="plot.option"
            :height="chartHeight"
            empty-message="No custom plot data available."
          />
        </div>
      </div>
    </div>

    <CustomPlotModal
      :isOpen="customPlotModalOpen"
      :availableSummaries="availableSummaries"
      :availableItems="availableItems"
      :availableScenarios="availableScenarios"
      :hasSummaries="hasSummaries"
      :getItemsForSummary="getItemsForSummary"
      :selectedItems="customPlotSelectedItems"
      :selectedScenarios="customPlotSelectedScenarios"
      :hideZeroValues="customPlotHideZeroValues"
      :orientation="customPlotOrientation"
      :title="customPlotTitle"
      @close="closeCustomPlotModal"
      @apply="applyCustomPlot"
      @update:selectedItems="customPlotSelectedItems = $event"
      @update:selectedScenarios="customPlotSelectedScenarios = $event"
      @update:hideZeroValues="customPlotHideZeroValues = $event"
      @update:orientation="customPlotOrientation = $event"
      @update:title="customPlotTitle = $event"
    />

    <ChartSettingsModal
      :isOpen="settingsModalOpen"
      :settings="modalSettings"
      @close="closeChartSettings"
      @apply="applyChartSettings"
    />
  </div>
</template>