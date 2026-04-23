import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useScenarioStore = defineStore('scenarioData', () => {

  const loadingScenarios = false
  const scenarios = ref([])

  function reset() {
    scenarios.value = []
  }

  return { loadingScenarios, scenarios, reset }
})
