<script setup>
import { ref, watch } from "vue"

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  availableSummaries: {
    type: Array,
    default: () => []
  },
  availableItems: {
    type: Array,
    default: () => []
  },
  availableScenarios: {
    type: Array,
    default: () => []
  },
  hasSummaries: {
    type: Boolean,
    default: false
  },
  getItemsForSummary: {
    type: Function,
    required: true
  },
  selectedItems: {
    type: Array,
    default: () => []
  },
  selectedScenarios: {
    type: Array,
    default: () => []
  },
  hideZeroValues: {
    type: Boolean,
    default: false
  },
  orientation: {
    type: String,
    default: "vertical"
  },
  title: {
    type: String,
    default: ""
  }
})

const emit = defineEmits([
  "close",
  "apply",
  "update:selectedItems",
  "update:selectedScenarios",
  "update:hideZeroValues",
  "update:orientation",
  "update:title"
])

const expandedSummaries = ref([])

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      expandedSummaries.value = []
    }
  }
)

function normalizeString(value) {
  return String(value || "").trim()
}

function isSummaryExpanded(summary) {
  return expandedSummaries.value.includes(summary)
}

function toggleSummaryExpanded(summary) {
  const index = expandedSummaries.value.indexOf(summary)
  if (index > -1) {
    expandedSummaries.value.splice(index, 1)
  } else {
    expandedSummaries.value.push(summary)
  }
}

function isCustomItemSelected(item) {
  const norm = normalizeString(item)
  return props.selectedItems.some((i) => normalizeString(i) === norm)
}

function toggleCustomItem(item, isChecked) {
  const norm = normalizeString(item)
  const list = props.selectedItems.map((i) => normalizeString(i))

  if (isChecked) {
    if (!list.includes(norm)) {
      emit("update:selectedItems", [...list, norm])
    }
  } else {
    emit(
      "update:selectedItems",
      props.selectedItems.filter((i) => normalizeString(i) !== norm)
    )
  }
}

function isCustomCategoryFullySelected(summary) {
  const items = props.getItemsForSummary(summary)
  return items.length > 0 && items.every((item) => isCustomItemSelected(item))
}

function toggleCustomCategoryAll(summary, isChecked) {
  const items = props.getItemsForSummary(summary)
  let next = props.selectedItems.map((i) => normalizeString(i))

  if (isChecked) {
    items.forEach((item) => {
      const norm = normalizeString(item)
      if (!next.includes(norm)) next.push(norm)
    })
  } else {
    const removeSet = new Set(items.map((item) => normalizeString(item)))
    next = next.filter((item) => !removeSet.has(normalizeString(item)))
  }

  emit("update:selectedItems", next)
}

function isCustomScenarioSelected(scenario) {
  return props.selectedScenarios.some(
    (s) => normalizeString(s) === normalizeString(scenario)
  )
}

function toggleCustomScenario(scenario) {
  const norm = normalizeString(scenario)
  const list = props.selectedScenarios.map((s) => normalizeString(s))

  if (list.includes(norm)) {
    emit(
      "update:selectedScenarios",
      props.selectedScenarios.filter((s) => normalizeString(s) !== norm)
    )
  } else {
    emit("update:selectedScenarios", [...props.selectedScenarios, scenario])
  }
}

function handleApply() {
  emit("apply")
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="$emit('close')"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b font-semibold text-gray-800">
          Define custom plot
        </div>

        <div class="p-4 overflow-y-auto flex-1 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Plot title
            </label>
            <input
              :value="title"
              type="text"
              placeholder="Enter custom plot title"
              class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              @input="$emit('update:title', $event.target.value)"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Categories & items
              </label>

              <div class="max-h-64 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <template v-if="hasSummaries">
                  <div
                    v-for="summary in availableSummaries"
                    :key="summary"
                    class="mb-1 rounded-md hover:bg-gray-50"
                  >
                    <div class="flex items-center gap-2 px-1 py-1">
                      <input
                        type="checkbox"
                        class="w-3.5 h-3.5 rounded border border-gray-400"
                        :checked="isCustomCategoryFullySelected(summary)"
                        @change="toggleCustomCategoryAll(summary, $event.target.checked)"
                      />

                      <button
                        type="button"
                        class="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium text-gray-700 hover:text-gray-900"
                        @click="toggleSummaryExpanded(summary)"
                      >
                        <span
                          class="inline-flex h-4 w-4 items-center justify-center text-gray-500 transition-transform duration-200"
                          :class="isSummaryExpanded(summary) ? 'rotate-90 text-gray-700' : ''"
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.24 4.24a.75.75 0 0 1 0 1.06l-4.24 4.24a.75.75 0 0 1-1.08 0Z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </span>

                        <span class="truncate">{{ summary }}</span>
                      </button>
                    </div>

                    <div v-if="isSummaryExpanded(summary)" class="ml-7 space-y-1 pb-1">
                      <label
                        v-for="item in getItemsForSummary(summary)"
                        :key="item"
                        class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-50"
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

                <template v-else>
                  <label
                    v-for="item in availableItems"
                    :key="item"
                    class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      :checked="isCustomItemSelected(item)"
                      @change="toggleCustomItem(item, $event.target.checked)"
                      class="rounded"
                    />
                    <span class="text-sm truncate">{{ item }}</span>
                  </label>
                </template>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Scenarios
              </label>

              <div class="max-h-64 overflow-y-auto border border-gray-300 rounded p-2 bg-white space-y-1">
                <label
                  v-for="scenario in availableScenarios"
                  :key="scenario"
                  class="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    :checked="isCustomScenarioSelected(scenario)"
                    @change="toggleCustomScenario(scenario)"
                    class="rounded"
                  />
                  <span class="text-sm truncate">{{ scenario }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4 border-t flex flex-wrap items-center justify-between gap-4">
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                :checked="hideZeroValues"
                type="checkbox"
                class="rounded"
                @change="$emit('update:hideZeroValues', $event.target.checked)"
              />
              <span class="text-sm text-gray-700">Hide zero values</span>
            </label>

            <div class="flex items-center gap-3">
              <span class="text-sm text-gray-700">Orientation:</span>

              <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  value="horizontal"
                  :checked="orientation === 'horizontal'"
                  @change="$emit('update:orientation', 'horizontal')"
                />
                <span>Horizontal</span>
              </label>

              <label class="flex items-center gap-1 cursor-pointer text-sm text-gray-700">
                <input
                  type="radio"
                  value="vertical"
                  :checked="orientation === 'vertical'"
                  @change="$emit('update:orientation', 'vertical')"
                />
                <span>Vertical</span>
              </label>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleApply"
              class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Show plot
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>