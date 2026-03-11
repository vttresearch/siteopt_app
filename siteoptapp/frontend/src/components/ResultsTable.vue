<script setup>
import { computed } from "vue"
import { AgGridVue } from "ag-grid-vue3"
import {
  getDashboardEmptyStateClass,
  getTableWrapperStyle
} from "@/utils/chartStyleUtils.js"

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

const emptyStateClass = computed(() =>
  getDashboardEmptyStateClass("h-full min-h-[240px]")
)

const tableWrapperStyle = computed(() =>
  getTableWrapperStyle({
    minHeight: "240px"
  })
)
</script>

<template>
  <div class="w-full h-full min-h-0">
    <div
      v-if="!hasRows"
      :class="emptyStateClass"
    >
      No result data to display.
    </div>

    <div
      v-else
      class="w-full h-full min-h-0 ag-theme-alpine"
      :style="tableWrapperStyle"
    >
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