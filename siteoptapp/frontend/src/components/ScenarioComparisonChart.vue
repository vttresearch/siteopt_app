<template>
  <div class="scenario-comparison-container flex gap-4">
    <!-- Left sidebar: Create new plot -->
    <aside class="create-plot-sidebar flex-shrink-0 w-52 bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-fit">
      <div class="space-y-3">
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Overview</p>
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium rounded-lg border transition-colors"
          :class="showScenarioSumChart ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'"
          title="Scenario totals by category"
          @click="toggleScenarioSumPlot"
        >
          <span class="text-lg leading-none" aria-hidden="true">📊</span>
          <span>Scenarios Sum Plot</span>
        </button>
        </div>
        <div v-if="availableSummaries.length">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Summaries</p>
        <button
          v-for="summary in availableSummaries"
          :key="summary"
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium rounded-lg border transition-colors"
          :class="isCategorySelected(summary) ? 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'"
          @click="toggleCategory(summary)"
        >
          <span class="text-lg leading-none" aria-hidden="true">📈</span>
          <span class="truncate">Plot {{ summary }}</span>
        </button>
        </div>
        <div>
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Custom</p>
        <button
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
          @click="openCustomPlotModal"
        >
          <span class="text-lg leading-none" aria-hidden="true">📉</span>
          <span>Custom Plot</span>
          <span class="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500 text-white">Custom</span>
        </button>
        </div>
      </div>
    </aside>

    <!-- Main content: charts -->
    <div class="flex-1 min-w-0">
    <!-- Category Totals Chart Container -->
    <div
      v-if="showScenarioSumChart"
      ref="categoryChartWrapperRef"
      class="chart-wrapper bg-white rounded-lg shadow-sm border mb-4"
    >
      <div v-if="hasValidData" class="p-2 border-b flex items-center justify-end">
        <button type="button" @click="openChartSettings('categoryTotals')" class="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" title="Chart settings">Settings</button>
      </div>
      <div v-if="!hasValidData" class="flex items-center justify-center h-96">
        <div class="text-gray-500 text-center">
          <p class="mb-2">No category totals data available.</p>
          <p class="text-sm">Category totals chart will display automatically when data is loaded.</p>
        </div>
      </div>
      <v-chart
        v-else
        ref="chartRef"
        :option="chartOption"
        :style="{ height: chartHeight + 'px', width: '100%' }"
        autoresize
      />
    </div>

    <!-- Default items plot: all items that have some non-zero value in any scenario -->
    <div
      v-if="defaultItemsChartOption && Object.keys(defaultItemsChartOption).length"
      class="chart-wrapper bg-white rounded-lg shadow-sm border mb-4"
    >
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-700">All items with non-zero values</h3>
        <div class="flex gap-2">
          <button
            type="button"
            @click="openChartSettings('defaultItems')"
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Settings
          </button>
        </div>
      </div>
      <v-chart
        :option="defaultItemsChartOption"
        :style="{ height: chartHeight + 'px', width: '100%' }"
        autoresize
      />
    </div>

    <!-- Category items charts (one per selected category, stacked below) -->
    <div
      v-for="category in selectedCategories"
      :key="category"
      class="chart-wrapper bg-white rounded-lg shadow-sm border mb-4"
    >
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-700">
          Items in "{{ category }}" Category
        </h3>
        <div class="flex gap-2">
          <button type="button" @click="openChartSettings({ type: 'categoryItems', categoryName: category })" class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Settings</button>
        </div>
      </div>
      <div v-if="!getCategoryChartOption(category) || !Object.keys(getCategoryChartOption(category)).length" class="flex items-center justify-center h-96">
        <div class="text-gray-500 text-center">
          <p class="mb-2">No items data available for this category.</p>
        </div>
      </div>
      <v-chart
        v-else
        :option="getCategoryChartOption(category)"
        :style="{ height: chartHeight + 'px', width: '100%' }"
        autoresize
      />
    </div>

    <!-- Custom plot chart (when user defines one from modal) -->
    <div v-if="showCustomPlot && customPlotChartOption && Object.keys(customPlotChartOption).length" class="chart-wrapper bg-white rounded-lg shadow-sm border mb-4">
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-700">Custom plot</h3>
        <div class="flex gap-2">
          <button type="button" @click="openChartSettings('customPlot')" class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Settings</button>
          <button type="button" @click="closeCustomPlot" class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Close</button>
        </div>
      </div>
      <v-chart
        :option="customPlotChartOption"
        :style="{ height: chartHeight + 'px', width: '100%' }"
        autoresize
      />
    </div>
    </div>

    <!-- Custom plot modal -->
    <Teleport to="body">
      <div
        v-if="customPlotModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="closeCustomPlotModal"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div class="p-4 border-b font-semibold text-gray-800">Define custom plot</div>
          <div class="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Categories & items (combined) -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Categories & items</label>
              <div class="max-h-48 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <!-- When summaries/categories exist, show items grouped under collapsible category headers -->
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
                        <span class="inline-block transition-transform" :class="isSummaryExpanded(summary) ? 'rotate-90' : ''">
                          ▶
                        </span>
                        <span>{{ summary }}</span>
                      </span>
                    </button>
                    <div
                      v-if="isSummaryExpanded(summary)"
                      class="ml-4 space-y-1"
                    >
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
                <!-- Fallback: no summaries, show flat item list -->
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
            <!-- Scenarios -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Scenarios</label>
              <div class="max-h-48 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <label
                  v-for="scenario in availableScenarios"
                  :key="scenario"
                  class="flex items-center gap-2 cursor-pointer"
                >
                  <input type="checkbox" :checked="isCustomScenarioSelected(scenario)" @change="toggleCustomScenario(scenario)" class="rounded" />
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
                  <input
                    type="radio"
                    class="rounded"
                    value="horizontal"
                    v-model="customPlotOrientation"
                  />
                  <span>Horizontal</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                  <input
                    type="radio"
                    class="rounded"
                    value="vertical"
                    v-model="customPlotOrientation"
                  />
                  <span>Vertical</span>
                </label>
              </div>
            </div>
            <div class="flex gap-2">
              <button type="button" @click="closeCustomPlotModal" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
              <button type="button" @click="applyCustomPlot" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Show plot</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Chart settings modal (per-plot) -->
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
              <label class="block text-sm font-medium text-gray-700 mb-1">Y-Axis scale</label>
              <select v-model="modalSettings.yAxisScale" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                <option value="linear">Linear</option>
                <option value="log">Logarithmic</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Show top {{ modalSettings.topNValues }} values (others as "Other")</label>
              <input type="range" v-model.number="modalSettings.topNValues" min="1" max="50" class="w-full" />
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
                <input type="radio" class="rounded" value="horizontal" v-model="modalSettings.orientation" />
                <span>Horizontal</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                <input type="radio" class="rounded" value="vertical" v-model="modalSettings.orientation" />
                <span>Vertical</span>
              </label>
            </div>
          </div>
          <div class="p-4 border-t flex justify-end gap-2">
            <button type="button" @click="closeChartSettings" class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
            <button type="button" @click="applyChartSettings" class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Apply</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import VChart from 'vue-echarts';
import { CanvasRenderer } from 'echarts/renderers';
import { use } from 'echarts/core';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent
} from 'echarts/components';
import { BarChart } from 'echarts/charts';
import { CHART_THEME, detectScenarioStructure, processScenarioComparisonData, processCategorySummedData } from '@/utils/chartUtils.js';

use([
  CanvasRenderer,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent,
  BarChart
]);

const props = defineProps({
  data: { type: Array, required: true },
  fileName: { type: String, default: 'Results' }
});

defineExpose({ openCustomPlotModal });

const chartRef = ref(null);
const categoryItemsChartRef = ref(null);
const categoryChartWrapperRef = ref(null);
const showScenarioSumChart = ref(true);
const defaultItemsChartOption = ref({});
const chartHeight = ref(400);
const showEntities = ref(false);

const selectedScenarios = ref([]);
const selectedItems = ref([]);
const selectedEntities = ref([]);
const expandedSummaries = ref([]);
const scenarioStructure = ref(null);
const chartOption = ref({});
/** Categories selected from dropdown to show item plots below */
const selectedCategories = ref([]);
/** Chart options per category: { [categoryName]: EChartsOption } */
const categoryItemsChartOptions = ref({});

/** Custom plot modal and chart */
const customPlotModalOpen = ref(false);
const customPlotSelectedCategories = ref([]);
const customPlotSelectedItems = ref([]);
const customPlotSelectedScenarios = ref([]);
const customPlotChartOption = ref({});
const showCustomPlot = ref(false);
/** Custom plot: hide zero values (default false = keep zero values) */
const customPlotHideZeroValues = ref(false);
/** Custom plot: orientation ('horizontal' or 'vertical') */
const customPlotOrientation = ref('vertical');

/** Per-chart settings (axis scale, top N, min bar height, hide zeros). Each plot has a Settings button that opens a popup. */
const DEFAULT_CHART_SETTINGS = () => ({ yAxisScale: 'linear', topNValues: 10, useMinBarHeight: true, hideZeroValues: false, orientation: 'vertical' });
const categoryTotalsSettings = ref(DEFAULT_CHART_SETTINGS());
// For the default items plot we want to hide items that are zero in all scenarios by default
const defaultItemsSettings = ref({ ...DEFAULT_CHART_SETTINGS(), hideZeroValues: true });
const categoryItemsSettings = ref({}); // { [categoryName]: settings }
const customPlotSettings = ref({ ...DEFAULT_CHART_SETTINGS() });

const settingsModalOpen = ref(false);
const settingsModalTarget = ref(null); // 'categoryTotals' | 'defaultItems' | { type: 'categoryItems', categoryName } | 'customPlot'
const modalSettings = ref({ ...DEFAULT_CHART_SETTINGS() });

const availableScenarios = computed(() => scenarioStructure.value?.scenarios || []);
const availableItems = computed(() => scenarioStructure.value?.items || []);
const hasSummaries = computed(() => scenarioStructure.value?.hasSummaries || false);
const availableSummaries = computed(() => scenarioStructure.value?.summaries || []);
const hasEntities = computed(() => scenarioStructure.value?.hasEntities || false);
const filteredItems = computed(() => availableItems.value);

// First chart shows category totals for ALL scenarios automatically (independent of controls)
const hasValidData = computed(() => {
  if (!scenarioStructure.value) {
    return false;
  }
  // First chart always shows if we have summaries/categories
  return scenarioStructure.value.hasSummaries && scenarioStructure.value.scenarios.length > 0;
});

function normalizeString(value) {
  return String(value || '').trim();
}

function getSettingsForTarget(target) {
  if (!target) return DEFAULT_CHART_SETTINGS();
  if (target === 'categoryTotals') return { ...categoryTotalsSettings.value };
  if (target === 'defaultItems') return { ...defaultItemsSettings.value };
  if (target === 'customPlot') return { ...customPlotSettings.value };
  if (target?.type === 'categoryItems' && target.categoryName) {
    const s = categoryItemsSettings.value[target.categoryName];
    return s ? { ...s } : DEFAULT_CHART_SETTINGS();
  }
  return DEFAULT_CHART_SETTINGS();
}

function toggleScenarioSumPlot() {
  showScenarioSumChart.value = !showScenarioSumChart.value;
  if (showScenarioSumChart.value) {
    // When reopening, scroll into view for convenience
    const el = categoryChartWrapperRef.value;
    if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function openChartSettings(target) {
  settingsModalTarget.value = target;
  modalSettings.value = getSettingsForTarget(target);
  settingsModalOpen.value = true;
}

function closeChartSettings() {
  settingsModalOpen.value = false;
  settingsModalTarget.value = null;
}

function applyChartSettings() {
  const target = settingsModalTarget.value;
  if (!target) {
    closeChartSettings();
    return;
  }
  const s = { ...modalSettings.value };
  if (target === 'categoryTotals') {
    categoryTotalsSettings.value = s;
    updateCategoryTotalsChart();
  } else if (target === 'defaultItems') {
    defaultItemsSettings.value = s;
    updateCategoryTotalsChart();
  } else if (target === 'customPlot') {
    customPlotSettings.value = s;
    customPlotHideZeroValues.value = s.hideZeroValues;
    rebuildCustomPlot();
  } else if (target?.type === 'categoryItems' && target.categoryName) {
    categoryItemsSettings.value = { ...categoryItemsSettings.value, [target.categoryName]: s };
    updateCategoryItemsChartFor(target.categoryName);
  }
  closeChartSettings();
}

function getCategoryItemsSettings(categoryName) {
  const s = categoryItemsSettings.value[categoryName];
  return s || DEFAULT_CHART_SETTINGS();
}

function isCategorySelected(category) {
  const norm = normalizeString(category);
  return selectedCategories.value.some(c => normalizeString(c) === norm);
}

function toggleCategory(category) {
  const norm = normalizeString(category);
  const current = selectedCategories.value.map(c => normalizeString(c));
  if (current.includes(norm)) {
    selectedCategories.value = selectedCategories.value.filter(c => normalizeString(c) !== norm);
  } else {
    const match = availableSummaries.value.find(s => normalizeString(s) === norm) || category;
    selectedCategories.value = [...selectedCategories.value, match];
  }
}

/**
 * Modify chart config to show only top N categories, summing the rest into "Other"
 * @param {Object} chartConfig - ECharts configuration object
 * @param {number} topN - Number of top categories to show
 * @returns {Object} - Modified chart config
 */
function applyTopNFilter(chartConfig, topN) {
  if (!chartConfig || !chartConfig.series || topN <= 0) {
    return chartConfig;
  }
  
  // Check if it's a horizontal chart (yAxis has categories) or vertical chart (xAxis has categories)
  const isHorizontal = chartConfig.yAxis && chartConfig.yAxis.data;
  const categories = isHorizontal 
    ? (chartConfig.yAxis.data || [])
    : (chartConfig.xAxis && chartConfig.xAxis.data ? chartConfig.xAxis.data : []);
  
  if (!categories || categories.length === 0 || categories.length <= topN) {
    return chartConfig; // No need to filter
  }
  
  const series = chartConfig.series || [];
  
  const getBarValue = (d) => {
    if (d == null) return 0;
    if (typeof d === 'object' && 'value' in d) return Number(d.value) || 0;
    return Number(d) || 0;
  };

  // Calculate total value for each category across all series
  const categoryTotals = {};
  categories.forEach((cat, catIndex) => {
    let total = 0;
    series.forEach(serie => {
      if (serie.data && serie.data[catIndex] !== undefined) {
        total += Math.abs(getBarValue(serie.data[catIndex]));
      }
    });
    categoryTotals[cat] = total;
  });
  
  // Sort categories by total value (descending)
  const sortedCategories = categories
    .map(cat => ({ name: cat, total: categoryTotals[cat] || 0 }))
    .sort((a, b) => b.total - a.total);
  
  // Get top N categories
  const topCategories = sortedCategories.slice(0, topN).map(c => c.name);
  const otherCategories = sortedCategories.slice(topN).map(c => c.name);
  
  // Create mapping: original index -> new index (or -1 for "Other")
  const categoryMap = {};
  const newCategories = [...topCategories];
  let otherIndex = -1;
  
  if (otherCategories.length > 0) {
    newCategories.push('Other');
    otherIndex = newCategories.length - 1;
  }
  
  categories.forEach((cat, origIndex) => {
    const topIndex = topCategories.indexOf(cat);
    if (topIndex >= 0) {
      categoryMap[origIndex] = topIndex;
    } else if (otherCategories.includes(cat)) {
      categoryMap[origIndex] = otherIndex;
    } else {
      categoryMap[origIndex] = -1; // Shouldn't happen
    }
  });
  
  // Process series data (extract numeric value for summing when data item is { value, actualValue })
  const newSeries = series.map(serie => {
    const newData = new Array(newCategories.length).fill(0);

    if (serie.data) {
      serie.data.forEach((value, origIndex) => {
        const newIndex = categoryMap[origIndex];
        if (newIndex >= 0) {
          newData[newIndex] = (newData[newIndex] || 0) + getBarValue(value);
        }
      });
    }

    return {
      ...serie,
      data: newData
    };
  });
  
  // Update chart config
  const newConfig = {
    ...chartConfig,
    series: newSeries
  };
  
  // Update the appropriate axis
  if (isHorizontal) {
    newConfig.yAxis = {
      ...chartConfig.yAxis,
      data: newCategories
    };
  } else {
    newConfig.xAxis = {
      ...chartConfig.xAxis,
      data: newCategories
    };
  }
  
  return newConfig;
}

function isScenarioSelected(scenario) {
  return selectedScenarios.value.includes(
    normalizeString(scenario)
  );
}

function isItemSelected(item) {
  return selectedItems.value.some(i => normalizeString(i) === normalizeString(item));
}

function isSummaryExpanded(summary) {
  return expandedSummaries.value.includes(summary);
}

function getItemsForSummary(summary) {
  const items = scenarioStructure.value?.summaryItemMap?.[summary] || [];
  return items.map(i => normalizeString(i));
}

function getSummarySelectedCount(summary) {
  return getItemsForSummary(summary).filter(item => isItemSelected(item)).length;
}

function getSummaryItemsCount(summary) {
  return scenarioStructure.value?.summaryItemMap?.[summary]?.length || 0;
}

function isSummaryFullySelected(summary) {
  const itemsInSummary = getItemsForSummary(summary);
  return itemsInSummary.length > 0 && itemsInSummary.every(item => isItemSelected(item));
}

function toggleScenario(scenario, isChecked) {
  const scenarioNorm = normalizeString(scenario);

  if (isChecked) {
    if (!selectedScenarios.value.some(
      s => normalizeString(s) === scenarioNorm
    )) {
      selectedScenarios.value = [...selectedScenarios.value, scenarioNorm]; 
    }
  } else {
    selectedScenarios.value = selectedScenarios.value.filter(
      s => normalizeString(s) !== scenarioNorm
    );
  }
}

function toggleItem(item, isChecked) {
  const itemStr = normalizeString(item);
  const current = selectedItems.value.map(i => normalizeString(i));
  
  if (isChecked) {
    if (!current.includes(itemStr)) {
      selectedItems.value = [...current, itemStr];
    }
  } else {
    selectedItems.value = current.filter(i => i !== itemStr);
  }
  
  if (hasEntities.value) {
    updateEntitiesForItems();
  }
}

function toggleSummaryExpanded(summary) {
  const index = expandedSummaries.value.indexOf(summary);
  if (index > -1) {
    expandedSummaries.value.splice(index, 1);
  } else {
    expandedSummaries.value.push(summary);
  }
}

function selectAllScenarios() {
  selectedScenarios.value =
    availableScenarios.value.map(s => normalizeString(s));
}

function deselectAllScenarios() {
  selectedScenarios.value = [];
}

function selectAllFilteredItems() {
  selectedItems.value = filteredItems.value.map(i => normalizeString(i));
  if (hasEntities.value) {
    updateEntitiesForItems();
  }
}

function deselectAllItems() {
  selectedItems.value = [];
  selectedEntities.value = [];
}

function selectAllItemsBySummary(summary) {
  const itemsInSummary = getItemsForSummary(summary);
  const current = selectedItems.value.map(i => normalizeString(i));
  
  if (isSummaryFullySelected(summary)) {
    selectedItems.value = current.filter(item => !itemsInSummary.includes(item));
  } else {
    const newSelected = [...current];
    itemsInSummary.forEach(item => {
      if (!newSelected.includes(item)) {
        newSelected.push(item);
      }
    });
    selectedItems.value = newSelected;
  }
  
  if (hasEntities.value) {
    updateEntitiesForItems();
  }
}

function updateEntitiesForItems() {
  if (!scenarioStructure.value?.hasEntities) return;
  
  const entitySet = new Set();
  selectedItems.value.forEach(item => {
    const entities = scenarioStructure.value.itemEntityMap?.[normalizeString(item)] || [];
    entities.forEach(entity => entitySet.add(normalizeString(entity)));
  });
  
  const newEntities = Array.from(entitySet).sort();
  selectedEntities.value = selectedEntities.value.filter(e => newEntities.includes(normalizeString(e)));
  
  if (showEntities.value && selectedEntities.value.length === 0 && newEntities.length > 0) {
    selectedEntities.value = [...newEntities];
  }
}

function updateCategoryTotalsChart() {
  // First chart: Always shows category totals for ALL scenarios (independent of controls)
  if (!scenarioStructure.value) {
    chartOption.value = {};
    defaultItemsChartOption.value = {};
    return;
  }
  
  // Check if we have summaries/categories
  if (scenarioStructure.value.hasSummaries) {
    // Use ALL scenarios, not selectedScenarios
    const allScenarios = scenarioStructure.value.scenarios.map(s => normalizeString(s));
    
    const s = categoryTotalsSettings.value;
    const categoryChartType = (s.orientation === 'vertical') ? 'groupedBar' : 'horizontalBar';
    const categoryConfig = processCategorySummedData(
      props.data,
      scenarioStructure.value,
      allScenarios,
      categoryChartType,
      s.yAxisScale,
      s.useMinBarHeight,
      s.hideZeroValues
    );
    
      if (categoryConfig) {
        categoryConfig.title = {
          text: `Category Totals Comparison: ${props.fileName}`,
          left: 'center',
          textStyle: { fontSize: CHART_THEME.titleFontSize }
        };
        chartOption.value = categoryConfig;
      } else {
        chartOption.value = {};
      }

      // Build default items plot: all items that have some non-zero value in any scenario
      const allItems = (scenarioStructure.value.items || []).map(i => normalizeString(i));
      const scenarios = allScenarios;
      if (allItems.length && scenarios.length) {
        const sDefaults = defaultItemsSettings.value;
        const defaultChartType = (sDefaults.orientation === 'vertical') ? 'groupedBar' : 'horizontalBar';
        const defaultConfig = processScenarioComparisonData(
          props.data,
          scenarioStructure.value,
          allItems,
          scenarios,
          defaultChartType,
          false,
          [],
          sDefaults.yAxisScale,
          sDefaults.useMinBarHeight,
          sDefaults.hideZeroValues // can still hide zero-only items via settings
        );
        if (defaultConfig) {
          defaultConfig.title = {
            text: `All items with non-zero values: ${props.fileName}`,
            left: 'center',
            textStyle: { fontSize: CHART_THEME.titleFontSize }
          };
          defaultItemsChartOption.value = applyTopNFilter(defaultConfig, sDefaults.topNValues);
        } else {
          defaultItemsChartOption.value = {};
        }
      } else {
        defaultItemsChartOption.value = {};
      }
  } else {
    chartOption.value = {};
    defaultItemsChartOption.value = {};
  }
}

function getCategoryChartOption(categoryName) {
  return categoryItemsChartOptions.value[categoryName] || {};
}

function updateCategoryItemsChartFor(categoryName) {
  if (!categoryName || !scenarioStructure.value) {
    return;
  }
  const categoryItems = scenarioStructure.value.summaryItemMap?.[categoryName] || [];
  if (categoryItems.length === 0) {
    categoryItemsChartOptions.value = { ...categoryItemsChartOptions.value, [categoryName]: {} };
    return;
  }
  const allScenarios = scenarioStructure.value.scenarios.map(s => normalizeString(s));
  const s = getCategoryItemsSettings(categoryName);
  const itemsChartType = (s.orientation === 'vertical') ? 'groupedBar' : 'horizontalBar';
  const itemsConfig = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    categoryItems.map(i => normalizeString(i)),
    allScenarios,
    itemsChartType,
    false,
    [],
    s.yAxisScale,
    s.useMinBarHeight,
    s.hideZeroValues
  );
    if (itemsConfig) {
      itemsConfig.title = {
        text: `Items in "${categoryName}": ${props.fileName}`,
        left: 'center',
        textStyle: { fontSize: CHART_THEME.titleFontSize }
      };
    const filteredConfig = applyTopNFilter(itemsConfig, s.topNValues);
    categoryItemsChartOptions.value = { ...categoryItemsChartOptions.value, [categoryName]: filteredConfig };
  } else {
    categoryItemsChartOptions.value = { ...categoryItemsChartOptions.value, [categoryName]: {} };
  }
}

// ---- Custom plot modal ----
function openCustomPlotModal() {
  customPlotSelectedCategories.value = [];
  customPlotSelectedItems.value = [];
  customPlotSelectedScenarios.value = [...(scenarioStructure.value?.scenarios || []).map(s => normalizeString(s))];
  customPlotOrientation.value = 'vertical';
  customPlotModalOpen.value = true;
}

function closeCustomPlotModal() {
  customPlotModalOpen.value = false;
}

function isCustomItemSelected(item) {
  const norm = normalizeString(item);
  return customPlotSelectedItems.value.some(i => normalizeString(i) === norm);
}

function toggleCustomItem(item, isChecked) {
  const norm = normalizeString(item);
  const list = customPlotSelectedItems.value.map(i => normalizeString(i));
  let nextChecked = isChecked;
  if (nextChecked === undefined) {
    nextChecked = !list.includes(norm);
  }
  if (nextChecked) {
    if (!list.includes(norm)) {
      customPlotSelectedItems.value = [...list, norm];
    }
  } else {
    customPlotSelectedItems.value = customPlotSelectedItems.value.filter(i => normalizeString(i) !== norm);
  }
}

function isCustomCategoryFullySelected(summary) {
  const items = getItemsForSummary(summary);
  if (!items.length) return false;
  return items.every(item => isCustomItemSelected(item));
}

function toggleCustomCategoryAll(summary, isChecked) {
  const items = getItemsForSummary(summary);
  if (!items.length) return;
  items.forEach(item => {
    toggleCustomItem(item, isChecked);
  });
}

function isCustomScenarioSelected(scenario) {
  return customPlotSelectedScenarios.value.some(s => normalizeString(s) === normalizeString(scenario));
}

function toggleCustomScenario(scenario) {
  const norm = normalizeString(scenario);
  const list = customPlotSelectedScenarios.value.map(s => normalizeString(s));
  if (list.includes(norm)) {
    customPlotSelectedScenarios.value = customPlotSelectedScenarios.value.filter(s => normalizeString(s) !== norm);
  } else {
    customPlotSelectedScenarios.value = [...customPlotSelectedScenarios.value, scenario];
  }
}

/** Combined list of items for custom plot: items from selected categories + explicitly selected items (deduplicated) */
function getCustomPlotItemsList() {
  const set = new Set();
  customPlotSelectedItems.value.forEach(i => set.add(normalizeString(i)));
  return Array.from(set);
}

function applyCustomPlot() {
  const items = getCustomPlotItemsList();
  const scenarios = customPlotSelectedScenarios.value.map(s => normalizeString(s));
  if (items.length === 0 || scenarios.length === 0) {
    closeCustomPlotModal();
    return;
  }
  customPlotSettings.value.hideZeroValues = customPlotHideZeroValues.value;
  // Map orientation to chart type used by processScenarioComparisonData
  const chartType = customPlotOrientation.value === 'vertical' ? 'groupedBar' : 'horizontalBar';
  const s = customPlotSettings.value;
  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    items,
    scenarios,
    chartType,
    false,
    [],
    s.yAxisScale,
    s.useMinBarHeight,
    s.hideZeroValues
  );
  if (config) {
    config.title = { text: `Custom plot: ${props.fileName}`, left: 'center', textStyle: { fontSize: CHART_THEME.titleFontSize } };
    customPlotChartOption.value = applyTopNFilter(config, s.topNValues);
    showCustomPlot.value = true;
  }
  closeCustomPlotModal();
}

function closeCustomPlot() {
  showCustomPlot.value = false;
  customPlotChartOption.value = {};
}

function rebuildCustomPlot() {
  if (!showCustomPlot.value || !scenarioStructure.value) return;
  const items = getCustomPlotItemsList();
  const scenarios = customPlotSelectedScenarios.value.map(s => normalizeString(s));
  if (items.length === 0 || scenarios.length === 0) return;
  const chartType = customPlotOrientation.value === 'vertical' ? 'groupedBar' : 'horizontalBar';
  const s = customPlotSettings.value;
  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    items,
    scenarios,
    chartType,
    false,
    [],
    s.yAxisScale,
    s.useMinBarHeight,
    s.hideZeroValues
  );
  if (config) {
    config.title = { text: `Custom plot: ${props.fileName}`, left: 'center', textStyle: { fontSize: CHART_THEME.titleFontSize } };
    customPlotChartOption.value = applyTopNFilter(config, s.topNValues);
  }
}

function updateChart() {
  updateCategoryTotalsChart();
}

function initializeChart() {
  if (!props.data || props.data.length === 0) {
    scenarioStructure.value = null;
    return;
  }
  
  const structure = detectScenarioStructure(props.data);
  scenarioStructure.value = structure;
  
  if (structure) {
    selectedScenarios.value = structure.scenarios.map(s => normalizeString(s));
    selectedItems.value = (structure.items || []).map(i => normalizeString(i));
    if (structure.hasEntities) {
      updateEntitiesForItems();
    }
    // Clear dropdown selections if categories no longer exist
    if (selectedCategories.value.length && structure.summaries) {
      selectedCategories.value = selectedCategories.value.filter(sel =>
        structure.summaries.some(s => normalizeString(s) === normalizeString(sel))
      );
    }
  } else {
    selectedCategories.value = [];
  }
}

// Watch data changes to initialize structure
watch(() => props.data, initializeChart, { immediate: true });

// Watcher for category totals chart - only updates when chart settings change
watch(
  () => [categoryTotalsSettings.value, scenarioStructure.value],
  () => {
    updateCategoryTotalsChart();
  },
  { deep: true }
);

// When categories are selected from dropdown, build/update the items charts
watch(
  () => [selectedCategories.value, categoryItemsSettings.value, scenarioStructure.value],
  () => {
    if (!selectedCategories.value || !selectedCategories.value.length) return;
    selectedCategories.value.forEach(cat => {
      updateCategoryItemsChartFor(cat);
    });
  },
  { deep: true }
);

// Initialize on mount - watcher will handle chart update
onMounted(() => {
  initializeChart();
});

// Cleanup on unmount
onUnmounted(() => {});
</script>

<style scoped>
.scenario-comparison-container {
  width: 100%;
}

.chart-controls {
  background-color: #f9fafb;
}

.chart-wrapper {
  min-height: 400px;
}
</style>
