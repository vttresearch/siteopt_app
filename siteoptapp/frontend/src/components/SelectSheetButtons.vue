<script setup>
import { ref, watch } from 'vue';
import { useSheetStore } from "@/stores/sheetStore.js";

const sheetStore = useSheetStore();
const props = defineProps({
  validationCounts: {
    type: Object,
    default: () => ({}),
  },
})
const sheets = ref({})  // eg. {'scenario': false, objects: false, relationships: false, ... }
const basicClass = ref("align-middle whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1 mr-1")
const activeClass = ref("align-middle whitespace-nowrap text-black bg-gray-200 rounded-sm p-1 mr-1")

const emit = defineEmits(['update:activeSheet'])

/* Collects sheet names and their current dirty status into an object */
watch(() => sheetStore.sheetDataUpdated, (oldItem, newItem) => {
  if (oldItem !== newItem) {
    for (let [sheetName, sheetObj] of Object.entries(sheetStore.sheetsByName)) {
      sheets.value[sheetName] = sheetObj.dirty
    }
  }
});

function handleClick(sheet) {
  emit('update:activeSheet', sheet)
}

function getSheetButtonClass(sheet) {
  const hasValidationIssues = Boolean(props.validationCounts[sheet])
  const isActive = sheetStore.activeSheet === sheet

  if (hasValidationIssues && isActive) {
    return "align-middle whitespace-nowrap rounded-sm border border-red-300 bg-red-100 p-1 mr-1 text-red-800"
  }

  if (hasValidationIssues) {
    return "align-middle whitespace-nowrap rounded-sm bg-red-600 p-1 mr-1 text-white hover:bg-red-700"
  }

  return isActive ? activeClass : basicClass
}
</script>

<template>
  <div class="inline-block w-full border-1 border-gray-400 rounded">
    <button v-for="(sheet, index) in Object.keys(sheets)"
            :key="index"
            :class="getSheetButtonClass(sheet)"
            :title="props.validationCounts[sheet] ? `${props.validationCounts[sheet]} invalid cell${props.validationCounts[sheet] === 1 ? '' : 's'}` : null"
            @click="handleClick(sheet)">
      {{ sheet }}
      <span v-if="sheets[sheet]">*</span>
      <span v-if="props.validationCounts[sheet]" class="ml-1 font-semibold">!</span>
    </button>
  </div>
</template>
