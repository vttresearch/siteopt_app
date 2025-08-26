<script setup>
import { ref, watch } from 'vue';

const activeIndex = ref(0)
const basicClass = ref("align-middle whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-1")
const activeClass = ref("align-middle whitespace-nowrap text-black bg-white rounded-sm p-1")

const props = defineProps({
  sheets: Array,
  activeIndex: Number,
  activeSheet: String,
})

const emit = defineEmits(['update:activeSheet'])

// Makes sure that the first sheet button is active when data changes
watch(() => props.activeSheet, (newSheet) => {
  let i = 0
  for (const sheet of props.sheets) {
    if (sheet === newSheet) {
      activeIndex.value = i
      return
    }
    i++
  }
});

function handleClick(sheet, index) {
  emit('update:activeSheet', sheet)
  activeIndex.value = index
}

</script>

<template>
  <div class="inline-block w-full border-r-1 border-l-1 border-t-1 border-gray-400 rounded">
    <button v-for="(sheet, index) in sheets"
            :key="index"
            :class="[activeIndex === index ? activeClass : basicClass]"
            @click="handleClick(sheet, index)">
      {{ sheet }}
    </button>
  </div>
</template>
