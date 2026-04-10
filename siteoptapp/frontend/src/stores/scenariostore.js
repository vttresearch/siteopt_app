import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useScenarioStore = defineStore('scenarioData', () => {

  const loadingScenarios = ref(false)
  const scenarios = ref([])

  return { loadingScenarios, scenarios }
})
