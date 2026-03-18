<script setup>
import { computed, reactive, watch } from "vue"

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(["close", "apply"])

const localSettings = reactive({
  yAxisScale: "linear",
  topNValues: 10,
  useMinBarHeight: true,
  hideZeroValues: false,
  orientation: "vertical"
})

watch(
  () => props.settings,
  (value) => {
    localSettings.yAxisScale = value?.yAxisScale ?? "linear"
    localSettings.topNValues = value?.topNValues ?? 10
    localSettings.useMinBarHeight = value?.useMinBarHeight ?? true
    localSettings.hideZeroValues = value?.hideZeroValues ?? false
    localSettings.orientation = value?.orientation ?? "vertical"
  },
  { immediate: true, deep: true }
)

watch(
  () => localSettings.yAxisScale,
  (newScale) => {
    if (newScale === "log") {
      localSettings.hideZeroValues = true
    }
  }
)

const zeroValuesDisabled = computed(() => localSettings.yAxisScale === "log")

function handleClose() {
  emit("close")
}

function handleApply() {
  emit("apply", {
    yAxisScale: localSettings.yAxisScale,
    topNValues: localSettings.topNValues,
    useMinBarHeight: localSettings.useMinBarHeight,
    hideZeroValues: zeroValuesDisabled.value
      ? true
      : localSettings.hideZeroValues,
    orientation: localSettings.orientation
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="handleClose"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div class="p-4 border-b font-semibold text-gray-800">
          Plot settings
        </div>

        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Y-axis scale
            </label>
            <select
              v-model="localSettings.yAxisScale"
              class="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="linear">Linear</option>
              <option value="log">Logarithmic</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Show top {{ localSettings.topNValues }} values
            </label>
            <input
              v-model.number="localSettings.topNValues"
              type="range"
              min="1"
              max="50"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>{{ localSettings.topNValues }}</span>
              <span>50</span>
            </div>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="localSettings.useMinBarHeight"
              type="checkbox"
              class="rounded"
            />
            <span class="text-sm text-gray-700">
              Show minimum bar height for small values
            </span>
          </label>

          <label
            class="flex items-center gap-2"
            :class="zeroValuesDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
          >
            <input
              v-model="localSettings.hideZeroValues"
              type="checkbox"
              class="rounded"
              :disabled="zeroValuesDisabled"
            />
            <span class="text-sm text-gray-700">
              Hide zero values
              <span
                v-if="zeroValuesDisabled"
                class="text-xs text-gray-500 ml-1"
              >
                (required for log scale)
              </span>
            </span>
          </label>

          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-gray-700">Orientation</span>

            <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
              <input
                v-model="localSettings.orientation"
                type="radio"
                value="horizontal"
              />
              <span>Horizontal</span>
            </label>

            <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
              <input
                v-model="localSettings.orientation"
                type="radio"
                value="vertical"
              />
              <span>Vertical</span>
            </label>
          </div>
        </div>

        <div class="p-4 border-t flex justify-end gap-2">
          <button
            type="button"
            @click="handleClose"
            class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleApply"
            class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>