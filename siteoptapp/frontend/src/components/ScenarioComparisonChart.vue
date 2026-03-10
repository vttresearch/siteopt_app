<script setup>
import { computed } from "vue"
import VChart from "vue-echarts"
import { CanvasRenderer } from "echarts/renderers"
import { use } from "echarts/core"
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent
} from "echarts/components"
import { BarChart } from "echarts/charts"

use([
  CanvasRenderer,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent,
  BarChart
])

const props = defineProps({
  option: {
    type: Object,
    default: () => ({})
  },
  height: {
    type: Number,
    default: 400
  },
  emptyMessage: {
    type: String,
    default: "No chart data available."
  }
})

const hasOption = computed(() => {
  return props.option && Object.keys(props.option).length > 0
})
</script>

<template>
  <div class="w-full">
    <div
      v-if="!hasOption"
      class="flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-gray-500"
      :style="{ height: `${height}px` }"
    >
      {{ emptyMessage }}
    </div>

    <v-chart
      v-else
      :option="option"
      :style="{ height: `${height}px`, width: '100%' }"
      autoresize
    />
  </div>
</template>