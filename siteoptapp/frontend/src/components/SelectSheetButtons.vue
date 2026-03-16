<script setup>
import { ref, watch } from 'vue';
import { useSheetStore } from "@/stores/sheetStore.js";

const sheetStore = useSheetStore();
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
</script>

<template>
  <div class="inline-block w-full border-1 border-gray-400 rounded">
    <button v-for="(sheet, index) in Object.keys(sheets)"
            :key="index"
            :class="[sheetStore.activeSheet === sheet ? activeClass : basicClass]"
            @click="handleClick(sheet)">
      {{ sheet }}
      <span v-if="sheets[sheet]">*</span>
    </button>
  </div>
</template>
