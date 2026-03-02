<template>
  <div class="scenario-comparison-container">
    <!-- Category Totals Chart Container -->
    <div
      ref="categoryChartWrapperRef"
      class="chart-wrapper bg-white rounded-lg shadow-sm border mb-4"
      @mousemove="onCategoryChartMouseMove"
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
        @click="onCategoryChartClick"
      />
    </div>
    
    <!-- Category Items Charts (one per opened category, stacked below) -->
    <div
      v-for="category in openedCategories"
      :key="category"
      class="chart-wrapper bg-white rounded-lg shadow-sm border mb-4"
    >
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-700">
          Items in "{{ category }}" Category
        </h3>
        <div class="flex gap-2">
          <button type="button" @click="openChartSettings({ type: 'categoryItems', categoryName: category })" class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Settings</button>
          <button
            type="button"
            @click="closeCategoryChart(category)"
            class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Close
          </button>
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
    
    <!-- Controls Section (Scenarios + Items only; chart options are per-plot via Settings) -->
    <div class="chart-controls mb-4 p-4 bg-gray-50 rounded-lg border">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <!-- Scenarios Selection -->
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select Scenarios ({{ selectedScenarios.length }}/{{ availableScenarios.length }} selected)
          </label>
          <div class="max-h-96 overflow-y-auto border border-gray-300 rounded p-2 bg-white">
            <div class="mb-2 flex gap-2">
              <button @click="selectAllScenarios" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                Select All
              </button>
              <button @click="deselectAllScenarios" class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                Deselect All
              </button>
            </div>
            <div v-for="scenario in availableScenarios" :key="scenario" class="mb-1">
              <button
                @click="toggleScenario(scenario, !isScenarioSelected(scenario))"
                type="button"
                :class="[
                  'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                  isScenarioSelected(scenario) 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                ]"
                :title="scenario"
              >
                <span class="flex items-center justify-between">
                  <span class="truncate flex-1">{{ scenario }}</span>
                  <span v-if="isScenarioSelected(scenario)" class="ml-2">✓</span>
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Items Selection -->
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select Items ({{ selectedItems.length }}/{{ filteredItems.length }} selected)
          </label>
          <div class="max-h-96 overflow-y-auto border border-gray-300 rounded p-2 bg-white">
            <div class="mb-2 flex gap-2">
              <button @click="selectAllFilteredItems" class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                Select All
              </button>
              <button @click="deselectAllItems" class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                Deselect All
              </button>
            </div>
            <div v-if="hasSummaries">
              <div v-for="summary in availableSummaries" :key="summary" class="mb-2">
                <div class="flex items-center justify-between bg-gray-100 p-2 rounded cursor-pointer" @click="toggleSummaryExpanded(summary)">
                  <div class="flex items-center">
                    <span class="text-sm font-medium text-gray-700">{{ summary }}</span>
                    <span class="ml-2 text-xs text-gray-500">
                      ({{ getSummarySelectedCount(summary) }}/{{ getSummaryItemsCount(summary) }})
                    </span>
                  </div>
                  <button
                    @click.stop="selectAllItemsBySummary(summary)"
                    class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    {{ isSummaryFullySelected(summary) ? 'Deselect All' : 'Select All' }}
                  </button>
                </div>
                <div v-if="isSummaryExpanded(summary)" class="mt-1 ml-2 space-y-1">
                  <button
                    v-for="item in getItemsForSummary(summary)" 
                    :key="item"
                    @click="toggleItem(item, !isItemSelected(item))"
                    type="button"
                    :class="[
                      'w-full text-left px-3 py-1.5 rounded text-sm transition-colors',
                      isItemSelected(item) 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    ]"
                    :title="item"
                  >
                    <span class="flex items-center justify-between">
                      <span class="truncate flex-1">{{ item }}</span>
                      <span v-if="isItemSelected(item)" class="ml-2">✓</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="space-y-1">
              <button
                v-for="item in filteredItems" 
                :key="item"
                @click="toggleItem(item, !isItemSelected(item))"
                type="button"
                :class="[
                  'w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1',
                  isItemSelected(item) 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                ]"
                :title="item"
              >
                <span class="flex items-center justify-between">
                  <span class="truncate flex-1">{{ item }}</span>
                  <span v-if="isItemSelected(item)" class="ml-2">✓</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-if="selectedScenarios.length === 0 || selectedItems.length === 0" class="text-sm text-orange-600">
        Select scenarios and items above to view the detailed horizontal bar chart below.
      </div>
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
    
    <!-- Horizontal Bar Chart Container (only when data is selected) -->
    <div v-if="hasValidHorizontalData" class="chart-wrapper bg-white rounded-lg shadow-sm border">
      <div class="p-2 border-b flex items-center justify-end">
        <button type="button" @click="openChartSettings('horizontal')" class="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded" title="Chart settings">Settings</button>
      </div>
      <v-chart
        ref="horizontalChartRef"
        :option="horizontalChartOption"
        :style="{ height: chartHeight + 'px', width: '100%' }"
        autoresize
      />
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
          <div class="p-4 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Categories -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Categories</label>
              <div class="max-h-48 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <label
                  v-for="summary in availableSummaries"
                  :key="summary"
                  class="flex items-center gap-2 cursor-pointer"
                >
                  <input type="checkbox" :checked="isCustomCategorySelected(summary)" @change="toggleCustomCategory(summary)" class="rounded" />
                  <span class="text-sm truncate">{{ summary }}</span>
                </label>
              </div>
            </div>
            <!-- Items -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Items</label>
              <div class="max-h-48 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <template v-for="summary in availableSummaries" :key="summary">
                  <div class="text-xs font-medium text-gray-500 mt-2 first:mt-0">{{ summary }}</div>
                  <label
                    v-for="item in getItemsForSummary(summary)"
                    :key="item"
                    class="flex items-center gap-2 cursor-pointer ml-1"
                  >
                    <input type="checkbox" :checked="isCustomItemSelected(item)" @change="toggleCustomItem(item)" class="rounded" />
                    <span class="text-sm truncate">{{ item }}</span>
                  </label>
                </template>
                <template v-if="!hasSummaries">
                  <label
                    v-for="item in availableItems"
                    :key="item"
                    class="flex items-center gap-2 cursor-pointer"
                  >
                    <input type="checkbox" :checked="isCustomItemSelected(normalizeString(item))" @change="toggleCustomItem(normalizeString(item))" class="rounded" />
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
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="customPlotHideZeroValues" class="rounded" />
              <span class="text-sm text-gray-700">Hide zero values</span>
            </label>
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
import { detectScenarioStructure, processScenarioComparisonData, processCategorySummedData } from '@/utils/chartUtils.js';

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
const horizontalChartRef = ref(null);
const categoryItemsChartRef = ref(null);
const categoryChartWrapperRef = ref(null);
/** Cursor position relative to category chart container (for tooltip placement) */
const categoryChartCursorPos = ref([0, 0]);
const chartHeight = ref(400);
const showEntities = ref(false);

const selectedScenarios = ref([]);
const selectedItems = ref([]);
const selectedEntities = ref([]);
const expandedSummaries = ref([]);
const scenarioStructure = ref(null);
const chartOption = ref({});
const horizontalChartOption = ref({});
/** List of category names that have been opened (charts shown below) */
const openedCategories = ref([]);
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

/** Per-chart settings (axis scale, top N, min bar height, hide zeros). Each plot has a Settings button that opens a popup. */
const DEFAULT_CHART_SETTINGS = () => ({ yAxisScale: 'linear', topNValues: 10, useMinBarHeight: true, hideZeroValues: true });
const categoryTotalsSettings = ref(DEFAULT_CHART_SETTINGS());
const categoryItemsSettings = ref({}); // { [categoryName]: settings }
const customPlotSettings = ref({ ...DEFAULT_CHART_SETTINGS(), hideZeroValues: false });
const horizontalChartSettings = ref(DEFAULT_CHART_SETTINGS());

const settingsModalOpen = ref(false);
const settingsModalTarget = ref(null); // 'categoryTotals' | { type: 'categoryItems', categoryName } | 'customPlot' | 'horizontal'
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

// Horizontal chart needs items and scenarios
const hasValidHorizontalData = computed(() => 
  scenarioStructure.value && 
  selectedItems.value.length > 0 && 
  selectedScenarios.value.length > 0 &&
  (!showEntities.value || selectedEntities.value.length > 0)
);

function normalizeString(value) {
  return String(value || '').trim();
}

function getSettingsForTarget(target) {
  if (!target) return DEFAULT_CHART_SETTINGS();
  if (target === 'categoryTotals') return { ...categoryTotalsSettings.value };
  if (target === 'customPlot') return { ...customPlotSettings.value };
  if (target === 'horizontal') return { ...horizontalChartSettings.value };
  if (target?.type === 'categoryItems' && target.categoryName) {
    const s = categoryItemsSettings.value[target.categoryName];
    return s ? { ...s } : DEFAULT_CHART_SETTINGS();
  }
  return DEFAULT_CHART_SETTINGS();
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
  } else if (target === 'customPlot') {
    customPlotSettings.value = s;
    customPlotHideZeroValues.value = s.hideZeroValues;
    rebuildCustomPlot();
  } else if (target === 'horizontal') {
    horizontalChartSettings.value = s;
    updateHorizontalChart();
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

function onCategoryChartMouseMove(e) {
  if (!categoryChartWrapperRef.value) return;
  const rect = categoryChartWrapperRef.value.getBoundingClientRect();
  categoryChartCursorPos.value = [e.clientX - rect.left, e.clientY - rect.top];
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
  
  // Calculate total value for each category across all series
  const categoryTotals = {};
  categories.forEach((cat, catIndex) => {
    let total = 0;
    series.forEach(serie => {
      if (serie.data && serie.data[catIndex] !== undefined) {
        total += Math.abs(serie.data[catIndex] || 0);
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
  
  // Process series data
  const newSeries = series.map(serie => {
    const newData = new Array(newCategories.length).fill(0);
    
    if (serie.data) {
      serie.data.forEach((value, origIndex) => {
        const newIndex = categoryMap[origIndex];
        if (newIndex >= 0) {
          newData[newIndex] = (newData[newIndex] || 0) + (value || 0);
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
    return;
  }
  
  // Check if we have summaries/categories
  if (scenarioStructure.value.hasSummaries) {
    // Use ALL scenarios, not selectedScenarios
    const allScenarios = scenarioStructure.value.scenarios.map(s => normalizeString(s));
    
    const s = categoryTotalsSettings.value;
    const categoryConfig = processCategorySummedData(
      props.data,
      scenarioStructure.value,
      allScenarios,
      'groupedBar',
      s.yAxisScale,
      s.useMinBarHeight,
      s.hideZeroValues
    );
    
    if (categoryConfig) {
      categoryConfig.title = {
        text: `Category Totals Comparison: ${props.fileName}`,
        left: 'center',
        textStyle: { fontSize: 16 }
      };

      categoryConfig.tooltip.enterable = true;
      categoryConfig.tooltip.appendToBody = false;
      categoryConfig.tooltip.formatter = (params) => {
        const categoryName = Array.isArray(params) ? params[0]?.name : params?.name;
        if (!categoryName) return '';
        const safeName = categoryName.replace(/"/g, '&quot;');
        const text = `Open ${categoryName} chart`;
        return `<div class="category-tooltip-container" data-category="${safeName}" style="cursor: pointer; padding: 4px 8px;">${text}</div>`;
      };
      categoryConfig.tooltip.position = (point, params, dom, rect, size) => {
        const [x, y] = categoryChartCursorPos.value;
        const contentSize = size?.contentSize || [0, 0];
        return [x - contentSize[0] / 2, y - contentSize[1] / 2];
      };

      if (categoryConfig.xAxis) {
        categoryConfig.xAxis = {
          ...categoryConfig.xAxis,
          triggerEvent: true,
          axisLabel: {
            ...categoryConfig.xAxis.axisLabel,
            color: '#1890ff',
            cursor: 'pointer'
          }
        };
      }

      chartOption.value = categoryConfig;

      nextTick(() => {
        if (chartRef.value?.chart) {
          attachCategoryBackgroundClick(chartRef.value.chart);
        }
      });
    } else {
      chartOption.value = {};
    }
  } else {
    chartOption.value = {};
  }
}

function updateHorizontalChart() {
  // Horizontal bar chart: Controlled by user selections (scenarios and items)
  if (!scenarioStructure.value || selectedItems.value.length === 0 || selectedScenarios.value.length === 0) {
    horizontalChartOption.value = {};
    return;
  }
  
  if (showEntities.value && selectedEntities.value.length === 0) {
    horizontalChartOption.value = {};
    return;
  }
  
  const s = horizontalChartSettings.value;
  const horizontalConfig = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    selectedItems.value,
    selectedScenarios.value,
    'horizontalBar',
    showEntities.value,
    selectedEntities.value,
    s.yAxisScale,
    s.useMinBarHeight,
    s.hideZeroValues
  );
  
  if (horizontalConfig) {
    horizontalConfig.title = {
      text: `Horizontal Bar Chart: ${props.fileName}`,
      left: 'center',
      textStyle: { fontSize: 16 }
    };
    const filteredConfig = applyTopNFilter(horizontalConfig, s.topNValues);
    horizontalChartOption.value = filteredConfig;
  } else {
    horizontalChartOption.value = {};
  }
}

function onCategoryChartClick(params) {
  // Ignore clicks on bars (series) - only handle background/axis clicks
  if (params.componentType === 'series') {
    return; // Don't open items chart when clicking on bars
  }
  
  // Axis label click
  if (params.componentType === 'xAxis') {
    const categoryName = params.value;
    if (!categoryName) return;
    openCategoryChart(categoryName);
    return;
  }
  
  // Handle clicks on grid/background area (when params is null or has no componentType)
  if (!params || !params.componentType) {
    // This will be handled by handleChartAreaClick
    return;
  }
}

function openCategoryChart(categoryName) {
  if (!categoryName || !scenarioStructure.value?.summaries) return;
  const matched = scenarioStructure.value.summaries.find(
    s => normalizeString(s) === normalizeString(categoryName) || s.toLowerCase() === categoryName.toLowerCase()
  );
  if (!matched) return;
  if (!openedCategories.value.includes(matched)) {
    openedCategories.value = [...openedCategories.value, matched];
  }
  updateCategoryItemsChartFor(matched);
}

function closeCategoryChart(categoryName) {
  openedCategories.value = openedCategories.value.filter(c => c !== categoryName);
  const next = { ...categoryItemsChartOptions.value };
  delete next[categoryName];
  categoryItemsChartOptions.value = next;
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
  const itemsConfig = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    categoryItems.map(i => normalizeString(i)),
    allScenarios,
    'groupedBar',
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
      textStyle: { fontSize: 16 }
    };
    const filteredConfig = applyTopNFilter(itemsConfig, s.topNValues);
    categoryItemsChartOptions.value = { ...categoryItemsChartOptions.value, [categoryName]: filteredConfig };
  } else {
    categoryItemsChartOptions.value = { ...categoryItemsChartOptions.value, [categoryName]: {} };
  }
}

function updateAllOpenedCategoryCharts() {
  openedCategories.value.forEach(cat => updateCategoryItemsChartFor(cat));
}

// ---- Custom plot modal ----
function openCustomPlotModal() {
  customPlotSelectedCategories.value = [];
  customPlotSelectedItems.value = [];
  customPlotSelectedScenarios.value = [...(scenarioStructure.value?.scenarios || []).map(s => normalizeString(s))];
  customPlotModalOpen.value = true;
}

function closeCustomPlotModal() {
  customPlotModalOpen.value = false;
}

function isCustomCategorySelected(category) {
  return customPlotSelectedCategories.value.some(c => normalizeString(c) === normalizeString(category));
}

function toggleCustomCategory(category) {
  const norm = normalizeString(category);
  const list = customPlotSelectedCategories.value.map(c => normalizeString(c));
  if (list.includes(norm)) {
    customPlotSelectedCategories.value = customPlotSelectedCategories.value.filter(c => normalizeString(c) !== norm);
  } else {
    const match = availableSummaries.value.find(s => normalizeString(s) === norm) || category;
    customPlotSelectedCategories.value = [...customPlotSelectedCategories.value, match];
  }
}

function isCustomItemSelected(item) {
  const norm = normalizeString(item);
  return customPlotSelectedItems.value.some(i => normalizeString(i) === norm);
}

function toggleCustomItem(item) {
  const norm = normalizeString(item);
  const list = customPlotSelectedItems.value.map(i => normalizeString(i));
  if (list.includes(norm)) {
    customPlotSelectedItems.value = customPlotSelectedItems.value.filter(i => normalizeString(i) !== norm);
  } else {
    customPlotSelectedItems.value = [...customPlotSelectedItems.value, item];
  }
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
  customPlotSelectedCategories.value.forEach(cat => {
    (scenarioStructure.value?.summaryItemMap?.[cat] || []).forEach(i => set.add(normalizeString(i)));
  });
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
  const s = customPlotSettings.value;
  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    items,
    scenarios,
    'horizontalBar',
    false,
    [],
    s.yAxisScale,
    s.useMinBarHeight,
    s.hideZeroValues
  );
  if (config) {
    config.title = { text: `Custom plot: ${props.fileName}`, left: 'center', textStyle: { fontSize: 16 } };
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
  const s = customPlotSettings.value;
  const config = processScenarioComparisonData(
    props.data,
    scenarioStructure.value,
    items,
    scenarios,
    'horizontalBar',
    false,
    [],
    s.yAxisScale,
    s.useMinBarHeight,
    s.hideZeroValues
  );
  if (config) {
    config.title = { text: `Custom plot: ${props.fileName}`, left: 'center', textStyle: { fontSize: 16 } };
    customPlotChartOption.value = applyTopNFilter(config, s.topNValues);
  }
}

function updateChart() {
  updateCategoryTotalsChart();
  updateHorizontalChart();
}

function initializeChart() {
  if (!props.data || props.data.length === 0) {
    scenarioStructure.value = null;
    return;
  }
  
  const structure = detectScenarioStructure(props.data);
  scenarioStructure.value = structure;
  
  if (structure) {
    // Select all scenarios by default
    selectedScenarios.value = structure.scenarios.map(s => normalizeString(s));
    selectedItems.value = [];
    
    
    if (structure.hasEntities) {
      updateEntitiesForItems();
    }
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

// Watcher for horizontal chart - updates when selections or settings change
watch(
  () => [
    selectedScenarios.value,
    selectedItems.value,
    selectedEntities.value,
    horizontalChartSettings.value,
    showEntities.value,
    scenarioStructure.value
  ],
  () => {
    if (showEntities.value && hasEntities.value) {
      updateEntitiesForItems();
    }
    updateHorizontalChart();
  },
  { deep: true }
);

// Watcher for category items charts - update all opened when settings change
watch(
  () => [openedCategories.value, categoryItemsSettings.value, scenarioStructure.value],
  () => {
    updateAllOpenedCategoryCharts();
  },
  { deep: true }
);

watch(
  () => selectedScenarios.value,
  v => {
    console.log(
      'DEBUG selectedScenarios:',
      v,
      v.map(s => `[${s}]`)
    );
  },
  { deep: true }
);

// Listen for category clicks from tooltip
function handleCategoryClick(event) {
  const categoryName = typeof event === 'string' ? event : (event.detail || event);
  if (categoryName) {
    openCategoryChart(categoryName);
  }
}

// Global click handler for tooltip clicks — whole tooltip box is clickable
function handleDocumentClick(e) {
  // Click on our container, or on the ECharts tooltip wrapper (the visible box) that contains it
  const tooltipContainer =
    e.target.closest('.category-tooltip-container') ||
    e.target.querySelector?.('.category-tooltip-container');
  if (tooltipContainer) {
    e.preventDefault();
    e.stopPropagation();
    const categoryName = tooltipContainer.getAttribute('data-category');
    if (categoryName) {
      handleCategoryClick(categoryName);
      return;
    }
  }

  // Also check for the old category-tooltip-link class (backward compatibility)
  if (e.target.classList && e.target.classList.contains('category-tooltip-link')) {
    e.preventDefault();
    e.stopPropagation();
    const categoryName = e.target.getAttribute('data-category');
    if (categoryName) {
      handleCategoryClick(categoryName);
    }
  }
}

// Watch for tooltip creation and attach click handlers
let tooltipObserver = null;

function setupTooltipClickHandler() {
  if (tooltipObserver) {
    tooltipObserver.disconnect();
  }
  
  // Use MutationObserver to watch for tooltip creation
  tooltipObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Check if this is the tooltip container
          const tooltipContainer = node.classList?.contains('category-tooltip-container') 
            ? node 
            : node.querySelector?.('.category-tooltip-container');
          
          if (tooltipContainer && !tooltipContainer.dataset.clickHandlerAttached) {
            tooltipContainer.dataset.clickHandlerAttached = 'true';
            tooltipContainer.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              const categoryName = tooltipContainer.getAttribute('data-category');
              if (categoryName) {
                handleCategoryClick(categoryName);
              }
            });
          }
        }
      });
    });
  });
  
  // Observe the document body for tooltip additions
  tooltipObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize on mount - watcher will handle chart update
onMounted(() => {
  initializeChart();
  // Listen for clicks on tooltip category links
  document.addEventListener('click', handleDocumentClick, true); // Use capture phase
  // Setup mutation observer for tooltip
  setupTooltipClickHandler();
});

// Cleanup on unmount
onUnmounted(() => {
  if (tooltipClickHandler) {
    document.removeEventListener('click', tooltipClickHandler, true);
  }
  if (tooltipObserver) {
    tooltipObserver.disconnect();
  }
});

function attachCategoryBackgroundClick(chartInstance) {
  const model = chartInstance.getModel();
  const xAxis = model.getComponent('xAxis').axis;
  const grid = model.getComponent('grid').coordinateSystem;

  const categories = chartOption.value?.xAxis?.data;
  if (!categories?.length) return;

  const bandWidth = xAxis.getBandWidth();

  const graphics = categories.map((cat, index) => {
    const xCenter = xAxis.dataToCoord(index);
    const x = xCenter - bandWidth / 2;

    return {
      type: 'rect',
      invisible: true,
      cursor: 'pointer',
      shape: {
        x,
        y: grid.y,
        width: bandWidth,
        height: grid.height
      },
      onclick: () => {
        handleCategoryClick(cat);
      }
    };
  });

  chartInstance.setOption({
    graphic: graphics
  });
}
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
