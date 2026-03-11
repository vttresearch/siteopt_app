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
import {
  buildStyledChartOption,
  getAutoChartHeight
} from "@/utils/chartStyleUtils.js"

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
  },
  styleOverrides: {
    type: Object,
    default: () => ({})
  }
})

const hasOption = computed(() => {
  return props.option && Object.keys(props.option).length > 0
})

const finalOption = computed(() => {
  if (!hasOption.value) return {}

  const built = buildStyledChartOption(props.option, props.styleOverrides)

  console.log("RAW OPTION:", props.option)
  console.log("FINAL GRID:", built.grid)
  console.log("FINAL YAXIS:", built.yAxis)
  console.log("FINAL XAXIS:", built.xAxis)

  return built
})

const finalHeight = computed(() => {
  if (!hasOption.value) return props.height
  return getAutoChartHeight(finalOption.value, props.height)
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
      :option="finalOption"
      :style="{ height: `${finalHeight}px`, width: '100%' }"
      autoresize
    />
  </div>
</template>