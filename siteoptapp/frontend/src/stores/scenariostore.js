import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useScenarioStore = defineStore('scenarioData', () => {

  const loadingScenarios = false
  const scenarios = ref([])

  return { loadingScenarios, scenarios }
})
