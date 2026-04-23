import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useResultStore = defineStore('resultData', () => {

  const runs = ref({})

  function reset() {
    runs.value = {}
  }

  return { runs, reset }
})
