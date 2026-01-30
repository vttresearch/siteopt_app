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
            <i class="fa-regular fa-file"></i>
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
            <i class="fa-solid fa-chart-line"></i>
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
            <i class="fa-regular fa-file"></i>
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
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Data Table</h3>
            <div class="text-sm text-gray-600">
              {{ dataRows.length }} rows × {{ dataColumns.length }} columns
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <button
              v-if="canEdit && !editMode"
              @click="enableEditMode"
              class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              <i class="fa-solid fa-edit"></i>
              Edit
            </button>
            <button
              v-if="editMode"
              @click="cancelEdit"
              class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              v-if="editMode"
              @click="saveChanges"
              :disabled="saving"
              class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              <span>
              <i v-if="!saving" class="fa-solid fa-save"></i>
              <span v-if="saving">
                Saving...</span>
              <span v-else>Save</span>
              </span>
            </button>
          </div>
        </div>
        <ag-grid-vue
          ref="gridRef"
          style="width: 100%; height: 500px;"
          class="ag-theme-alpine"
          :columnDefs="columnDefs"
          :rowData="editMode ? editableRows : dataRows"
          :defaultColDef="defaultColDef"
          :pagination="true"
          :paginationPageSize="50"
          :enableSorting="true"
          :enableFilter="true"
          :enableColResize="true"
          :suppressMenuHide="true"
          :stopEditingWhenCellsLoseFocus="true"
          @cell-value-changed="onCellValueChanged"
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
            style="width: 100%; height: 500px;"
            class="ag-theme-alpine"
            :columnDefs="columnDefs"
            :rowData="editMode ? editableRows : dataRows"
            :defaultColDef="defaultColDef"
            :pagination="true"
            :paginationPageSize="50"
            :enableSorting="true"
            :enableFilter="true"
            :enableColResize="true"
            :suppressMenuHide="true"
          />
        </div>
      </div>

      <!-- No Time Series Data Message -->
      <div v-if="activeTab === 'chart' && !isTimeSeriesData" class="text-center py-12">
        <i class="fa-solid fa-chart-line"></i>  <!-- class="text-4xl text-gray-400 mb-4"-->
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
import { postSaveFile, postRequestData } from "@/utils/functions.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";

const notify = useNotificationStore();
const tableDataStore = useTableDataStore();


const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  fileName: {
    type: String,
    default: 'data'
  },
  filePath: {
    type: String,
    default: ''
  }
});

const activeTab = ref('table');
const selectedSheet = ref('');
const processingData = ref(false); // For Excel files with multiple sheets
const editMode = ref(false);
const saving = ref(false);
//const gridRef = ref(null);
const editableRows = ref([]);
const hasChanges = ref(false);
const filetype = computed(() => props.data?.filetype);

const canEdit = computed(() => {
  const ft = props.data?.filetype;
  return props.filePath && (ft === "csv" || ft === "xlsx");
});

function enableEditMode() {
  editMode.value = true;
  // Create a deep copy for editing
  editableRows.value = JSON.parse(JSON.stringify(dataRows.value));
  hasChanges.value = false;
}

function cancelEdit() {
  if (hasChanges.value) {
    if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return;
    }
  }
  editMode.value = false;
  editableRows.value = [];
  hasChanges.value = false;
}

function onCellValueChanged(event) {
  hasChanges.value = true;
}

async function saveChanges() {
  if (!hasChanges.value) {
    editMode.value = false;
    return;
  }

  saving.value = true;
  try {
    const ft = props.data?.filetype;

    const meta = {};
    if (ft === "xlsx") {
      meta.sheet = selectedSheet.value;
      meta.columns = dataColumns.value;
    } else if (ft === "csv") {
      meta.columns = dataColumns.value;
    }

    const r = await postSaveFile(
      props.filePath,
      ft,
      editableRows.value,
      meta,
      notify
    );

    if (r?.success) {
      notify.show("Saved", 2000, "info");
      editMode.value = false;
      hasChanges.value = false;

      await postRequestData(props.filePath, props.fileName, tableDataStore, notify);
    }
  } finally {
    saving.value = false;
  }
}

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

const dataRows = computed(() => {
  const ft = props.data?.filetype;
  const d = props.data?.data;

  if (ft === "csv") return d?.rows ?? [];
  if (ft === "xlsx") return selectedSheet.value ? (d?.[selectedSheet.value]?.rows ?? []) : [];
  return [];
});

const dataColumns = computed(() => {
  const ft = props.data?.filetype;
  const d = props.data?.data;

  if (ft === "csv") return d?.columns ?? [];
  if (ft === "xlsx") return selectedSheet.value ? (d?.[selectedSheet.value]?.columns ?? []) : [];
  return [];
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
    editable: editMode.value,
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
