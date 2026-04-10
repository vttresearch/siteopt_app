import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useResultStore = defineStore('resultData', () => {

  const runs = ref({})

  return { runs }
})
