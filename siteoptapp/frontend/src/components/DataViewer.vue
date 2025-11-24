<template>
  <div class="data-viewer">
    <!-- Header with tabs -->
    <div class="mb-4">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            @click="activeTab = 'table'"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'table'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <font-awesome-icon icon="fa-regular fa-file" class="mr-2" />
            Data Table
          </button>
          
          <button
            v-if="isTimeSeriesData"
            @click="activeTab = 'chart'"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'chart'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <font-awesome-icon icon="fa-solid fa-chart-line" class="mr-2" />
            Time Series Chart
          </button>
          
          <button
            @click="activeTab = 'both'"
            :class="[
              'py-2 px-1 border-b-2 font-medium text-sm',
              activeTab === 'both'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            <font-awesome-icon icon="fa-solid fa-chart-line" class="mr-1" />
            <font-awesome-icon icon="fa-regular fa-file" class="mr-2" />
            Both
          </button>
        </nav>
      </div>
    </div>

    <!-- Sheet Selector for Excel files -->
    <div v-if="availableSheets.length > 1" class="mb-4">
      <div class="flex items-center space-x-4">
        <label class="text-sm font-medium text-gray-700">Sheet:</label>
        <select 
          v-model="selectedSheet"
          class="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option v-for="sheet in availableSheets" :key="sheet" :value="sheet">
            {{ sheet }}
          </option>
        </select>
        <span class="text-xs text-gray-500">
          ({{ availableSheets.length }} sheets available)
        </span>
      </div>
    </div>

    <!-- Loading indicator for data processing -->
    <div v-if="processingData" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mb-2"></div>
      <div class="text-sm text-gray-600">Processing data...</div>
    </div>

    <!-- Content based on active tab -->
    <div v-else class="content-area">
      <!-- Table Only View -->
      <div v-if="activeTab === 'table'" class="table-container">
        <div class="mb-4 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900">Data Table</h3>
          <div class="text-sm text-gray-600">
            {{ dataRows.length }} rows × {{ dataColumns.length }} columns
          </div>
        </div>
        <ag-grid-vue
          style="width: 100%; height: 500px;"
          class="ag-theme-alpine"
          :columnDefs="columnDefs"
          :rowData="dataRows"
          :defaultColDef="defaultColDef"
          :pagination="true"
          :paginationPageSize="50"
          :enableSorting="true"
          :enableFilter="true"
          :enableColResize="true"
          :suppressMenuHide="true"
        />
      </div>

      <!-- Chart Only View -->
      <div v-if="activeTab === 'chart' && isTimeSeriesData" class="chart-container">
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Time Series Visualization</h3>
        </div>
        <TimeSeriesChart 
          :data="dataRows" 
          :fileName="fileName"
        />
      </div>

      <!-- Both Table and Chart View -->
      <div v-if="activeTab === 'both'" class="both-container space-y-6">
        <!-- Chart Section -->
        <div v-if="isTimeSeriesData" class="chart-section">
          <div class="mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Time Series Visualization</h3>
          </div>
          <TimeSeriesChart 
            :data="dataRows" 
            :fileName="fileName"
          />
        </div>

        <!-- Table Section -->
        <div class="table-section">
          <div class="mb-4 flex justify-between items-center">
            <h3 class="text-lg font-semibold text-gray-900">Data Table</h3>
            <div class="text-sm text-gray-600">
              {{ dataRows.length }} rows × {{ dataColumns.length }} columns
            </div>
          </div>
          <ag-grid-vue
            style="width: 100%; height: 400px;"
            class="ag-theme-alpine"
            :columnDefs="columnDefs"
            :rowData="dataRows"
            :defaultColDef="defaultColDef"
            :pagination="true"
            :paginationPageSize="25"
            :enableSorting="true"
            :enableFilter="true"
            :enableColResize="true"
            :suppressMenuHide="true"
          />
        </div>
      </div>

      <!-- No Time Series Data Message -->
      <div v-if="activeTab === 'chart' && !isTimeSeriesData" class="text-center py-12">
        <font-awesome-icon icon="fa-solid fa-chart-line" class="text-4xl text-gray-400 mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 mb-2">No Time Series Data Detected</h3>
        <p class="text-gray-600">
          This file doesn't appear to contain time series data. Charts are available for CSV files with time/date columns.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { AgGridVue } from 'ag-grid-vue3';
import TimeSeriesChart from '@/components/TimeSeriesChart.vue';
import { detectTimeSeriesStructure } from '@/utils/chartUtils.js';

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  fileName: {
    type: String,
    default: 'data'
  }
});

const activeTab = ref('table');
const selectedSheet = ref('');
const processingData = ref(false); // For Excel files with multiple sheets

// Get available sheets for Excel files
const availableSheets = computed(() => {
  if (props.data?.data && props.data?.filetype === 'xlsx') {
    const apiData = props.data.data;
    if (apiData && typeof apiData === 'object') {
      return Object.keys(apiData);
    }
  }
  return [];
});

// Set default sheet when data changes
watch(() => props.data, (newData) => {
  if (newData?.data && newData?.filetype === 'xlsx') {
    const sheets = Object.keys(newData.data);
    if (sheets.length > 0 && !selectedSheet.value) {
      selectedSheet.value = sheets[0];
    }
  } else {
    selectedSheet.value = '';
  }
}, { immediate: true });

// Process the data from the file store
const dataRows = computed(() => {
  // Handle new API format: {filetype: 'csv'/'xlsx', data: {...}}
  if (props.data?.data) {
    const apiData = props.data.data;
    const filetype = props.data.filetype;
    
    if (filetype === 'csv') {
      // CSV format: {data: {column: [values]}}
      if (apiData && typeof apiData === 'object') {
        const columns = Object.keys(apiData);
        if (columns.length === 0) return [];
        
        const rowCount = apiData[columns[0]]?.length || 0;
        const rows = [];
        
        for (let i = 0; i < rowCount; i++) {
          const row = {};
          columns.forEach(col => {
            row[col] = apiData[col]?.[i];
          });
          rows.push(row);
        }
        return rows;
      }
    } else if (filetype === 'xlsx') {
      // Excel format: {data: {sheet_name: [{column: [values]}]}}
      if (apiData && typeof apiData === 'object' && selectedSheet.value) {
        const sheetData = apiData[selectedSheet.value];
        if (Array.isArray(sheetData) && sheetData.length > 0) {
          // Merge all objects in the sheet to get all columns
          const mergedData = {};
          sheetData.forEach(tableObj => {
            Object.assign(mergedData, tableObj);
          });
          
          const columns = Object.keys(mergedData);
          if (columns.length === 0) return [];
          
          const rowCount = Math.max(...columns.map(col => mergedData[col]?.length || 0));
          const rows = [];
          
          for (let i = 0; i < rowCount; i++) {
            const row = {};
            columns.forEach(col => {
              row[col] = mergedData[col]?.[i];
            });
            rows.push(row);
          }
          return rows;
        }
      }
    }
  }
  
  // Handle legacy format: {cols: [...], rows: [...]}
  if (!props.data || !props.data.rows) return [];
  return props.data.rows;
});

const dataColumns = computed(() => {
  // Handle new API format: {filetype: 'csv'/'xlsx', data: {...}}
  if (props.data?.data) {
    const apiData = props.data.data;
    const filetype = props.data.filetype;
    
    if (filetype === 'csv') {
      // CSV format: {data: {column: [values]}}
      if (apiData && typeof apiData === 'object') {
        return Object.keys(apiData);
      }
    } else if (filetype === 'xlsx') {
      // Excel format: {data: {sheet_name: [{column: [values]}]}}
      if (apiData && typeof apiData === 'object' && selectedSheet.value) {
        const sheetData = apiData[selectedSheet.value];
        if (Array.isArray(sheetData) && sheetData.length > 0) {
          // Merge all objects in the sheet to get all columns
          const mergedData = {};
          sheetData.forEach(tableObj => {
            Object.assign(mergedData, tableObj);
          });
          return Object.keys(mergedData);
        }
      }
    }
  }
  
  // Handle legacy format: {cols: [...], rows: [...]}
  if (!props.data || !props.data.cols) return [];
  return props.data.cols;
});

// Check if this is time series data
const isTimeSeriesData = computed(() => {
  const structure = detectTimeSeriesStructure(dataRows.value);
  return structure?.isTimeSeries || false;
});

// AG Grid configuration
const columnDefs = computed(() => {
  return dataColumns.value.map(col => ({
    field: col,
    headerName: col,
    sortable: true,
    filter: true,
    resizable: true,
    width: Math.max(120, Math.min(200, col.length * 8 + 50))
  }));
});

const defaultColDef = ref({
  flex: 1,
  minWidth: 100,
  resizable: true,
  sortable: true,
  filter: true
});

// Auto-switch to chart view if time series data is detected
watch(isTimeSeriesData, (isTS) => {
  if (isTS && activeTab.value === 'table') {
    activeTab.value = 'both'; // Show both by default for time series
  }
}, { immediate: true });

// Show processing state when switching sheets
watch(selectedSheet, async () => {
  if (availableSheets.value.length > 1) {
    processingData.value = true;
    // Simulate brief processing delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    processingData.value = false;
  }
});
</script>

<style scoped>
.data-viewer {
  width: 100%;
}

.content-area {
  min-height: 24rem; /* equivalent to min-h-96 */
}

.ag-theme-alpine {
  --ag-border-color: #e5e7eb;
  --ag-header-background-color: #f9fafb;
  --ag-odd-row-background-color: #ffffff;
  --ag-even-row-background-color: #f9fafb;
}

/* Custom scrollbar for table */
.ag-theme-alpine .ag-body-viewport {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f3f4f6;
}

.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 4px;
}

.ag-theme-alpine .ag-body-viewport::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}
</style>
