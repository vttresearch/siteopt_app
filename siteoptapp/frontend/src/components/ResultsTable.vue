<script setup>
import { computed } from "vue"
import { AgGridVue } from "ag-grid-vue3"

const props = defineProps({
  columnDefs: {
    type: Array,
    default: () => []
  },
  rowData: {
    type: Array,
    default: () => []
  }
})

const hasRows = computed(() => props.rowData.length > 0)
</script>

<template>
  <div class="w-full h-full min-h-0">
    <div
      v-if="!hasRows"
      class="h-full min-h-[240px] flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500"
    >
      No result data to display.
    </div>

    <div v-else class="w-full h-full min-h-0 ag-theme-alpine">
      <AgGridVue
        class="w-full h-full"
        :columnDefs="columnDefs"
        :rowData="rowData"
        :domLayout="'normal'"
        :rowBuffer="10"
        :rowHeight="40"
        :headerHeight="42"
        :animateRows="true"
        :suppressColumnVirtualization="false"
        :suppressCellFocus="true"
        :suppressAnimationFrame="true"
        :enableCellTextSelection="false"
      />
    </div>
  </div>
</template>