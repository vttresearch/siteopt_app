import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useAssistantPlotStore = defineStore('assistantPlot', () => {
  const plotsByContext = ref({});

  function setPlot(contextDir, plotPayload) {
    if (!contextDir) return;
    plotsByContext.value = {
      ...plotsByContext.value,
      [contextDir]: plotPayload,
    };
  }

  function clearPlot(contextDir) {
    if (!contextDir) return;
    const copy = { ...plotsByContext.value };
    delete copy[contextDir];
    plotsByContext.value = copy;
  }

  function getPlot(contextDir) {
    if (!contextDir) return null;
    return plotsByContext.value[contextDir] || null;
  }

  return {
    plotsByContext,
    setPlot,
    clearPlot,
    getPlot,
  };
});
