<template>
  <div class="time-series-chart-container">
    <!-- Chart Controls -->
    <div class="chart-controls mb-4 p-4 bg-gray-50 rounded-lg">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex-1 min-w-64">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Select Columns to Chart ({{ selectedColumns.length }}/{{ maxSeries }} selected)
          </label>
          <div class="max-h-32 overflow-y-auto border border-gray-300 rounded p-2 bg-white">
            <div v-for="column in dataColumns" :key="column" class="flex items-center mb-1">
              <input
                :id="'col-' + column"
                v-model="selectedColumns"
                :value="column"
                type="checkbox"
                :disabled="!selectedColumns.includes(column) && selectedColumns.length >= maxSeries"
                class="mr-2 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label 
                :for="'col-' + column" 
                class="text-sm text-gray-700 cursor-pointer truncate"
                :title="column"
              >
                {{ column }}
              </label>
            </div>
          </div>
        </div>
        
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Chart Type</label>
          <select 
            v-model="chartType" 
            class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="line">Line Chart</option>
            <option value="bar">Bar Chart</option>
            <option value="area">Area Chart</option>
          </select>
        </div>
        
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-gray-700">Data View</label>
          <select 
            v-model="aggregation" 
            class="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option v-for="option in aggregationOptions" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </div>
        
        <button
          @click="updateChart"
          class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Update Chart
        </button>
      </div>
    </div>
    
    <!-- Chart Container -->
    <div class="chart-wrapper bg-white rounded-lg shadow-sm border">
      <div v-if="loading" class="flex items-center justify-center h-96">
        <div class="text-gray-500">Loading chart...</div>
      </div>
      <div v-else-if="!hasValidData" class="flex items-center justify-center h-96">
        <div class="text-gray-500">
          No time series data available. Select columns with numeric data to display charts.
        </div>
      </div>
      <v-chart
        v-else
        ref="chartRef"
        :option="chartOption"
        :style="{ height: chartHeight + 'px', width: '100%' }"
        autoresize
        @click="onChartClick"
      />
    </div>
    
    <!-- Chart Info -->
    <div v-if="hasValidData" class="mt-4 text-sm text-gray-600">
      <div class="flex flex-wrap gap-4">
        <span>Data Points: {{ dataPointCount }}</span>
        <span>Time Range: {{ timeRange }}</span>
        <span>Series: {{ selectedColumns.length }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent,
  DataZoomComponent
} from 'echarts/components';
import { 
  detectTimeSeriesStructure, 
  processTimeSeriesData, 
  getAggregationOptions,
  generateColorPalette 
} from '@/utils/chartUtils.js';

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent,
  DataZoomComponent
]);

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  fileName: {
    type: String,
    default: ''
  }
});

// Chart state
const chartRef = ref(null);
const loading = ref(false);
const chartHeight = ref(400);
const maxSeries = ref(10); // Limit for performance
const chartType = ref('line');
const aggregation = ref('Raw Data');

// Data processing
const timeSeriesStructure = ref(null);
const selectedColumns = ref([]);
const chartOption = ref({});

// Computed properties
const dataColumns = computed(() => {
  return timeSeriesStructure.value?.dataColumns || [];
});

const aggregationOptions = computed(() => {
  if (!timeSeriesStructure.value) return ['Raw Data'];
  return getAggregationOptions(props.data, timeSeriesStructure.value.timeColumn);
});

const hasValidData = computed(() => {
  return timeSeriesStructure.value?.isTimeSeries && selectedColumns.value.length > 0;
});

const dataPointCount = computed(() => {
  return props.data?.length || 0;
});

const timeRange = computed(() => {
  if (!props.data || props.data.length === 0 || !timeSeriesStructure.value) return 'N/A';
  
  const timeCol = timeSeriesStructure.value.timeColumn;
  const times = props.data
    .map(row => new Date(row[timeCol]))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);
  
  if (times.length === 0) return 'N/A';
  
  const start = times[0].toLocaleDateString();
  const end = times[times.length - 1].toLocaleDateString();
  return `${start} - ${end}`;
});

// Methods
function initializeChart() {
  loading.value = true;
  
  try {
    // Detect time series structure
    timeSeriesStructure.value = detectTimeSeriesStructure(props.data);
    
    if (timeSeriesStructure.value?.isTimeSeries) {
      // Auto-select first few columns
      const autoSelectCount = Math.min(3, timeSeriesStructure.value.dataColumns.length);
      selectedColumns.value = timeSeriesStructure.value.dataColumns.slice(0, autoSelectCount);
      
      nextTick(() => {
        updateChart();
      });
    }
  } catch (error) {
    console.error('Error initializing chart:', error);
  } finally {
    loading.value = false;
  }
}

function updateChart() {
  if (!hasValidData.value) {
    chartOption.value = {};
    return;
  }
  
  loading.value = true;
  
  try {
    const config = processTimeSeriesData(
      props.data,
      selectedColumns.value,
      timeSeriesStructure.value.timeColumn
    );
    
    if (config) {
      // Apply chart type
      config.series.forEach(series => {
        series.type = chartType.value;
        if (chartType.value === 'area') {
          series.type = 'line';
          series.areaStyle = {};
        }
      });
      
      // Apply color palette
      const colors = generateColorPalette(selectedColumns.value.length);
      config.color = colors;
      
      chartOption.value = config;
    }
  } catch (error) {
    console.error('Error updating chart:', error);
  } finally {
    loading.value = false;
  }
}

function onChartClick(params) {
  console.log('Chart clicked:', params);
}

// Watch for data changes
watch(() => props.data, (newData) => {
  if (newData && newData.length > 0) {
    initializeChart();
  }
}, { immediate: true });

watch([chartType, aggregation], () => {
  if (hasValidData.value) {
    updateChart();
  }
});

// Lifecycle
onMounted(() => {
  // Adjust chart height based on screen size
  const updateHeight = () => {
    const screenHeight = window.innerHeight;
    chartHeight.value = Math.min(500, Math.max(300, screenHeight * 0.4));
  };
  
  updateHeight();
  window.addEventListener('resize', updateHeight);
  
  return () => {
    window.removeEventListener('resize', updateHeight);
  };
});
</script>

<style scoped>
.time-series-chart-container {
  width: 100%;
}

.chart-controls {
  border: 1px solid #e5e7eb;
}

.chart-wrapper {
  min-height: 300px;
}

/* Custom checkbox styling */
input[type="checkbox"]:disabled + label {
  color: #9ca3af;
  cursor: not-allowed;
}
</style>
