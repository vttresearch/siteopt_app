export function normalizeScenarioComparisonString(value) {
  return String(value || "").trim()
}

export function normalizeStoredCustomPlot(plotLike, index = 0, {
  makePlotId,
  defaultSettings,
} = {}) {
  const title = normalizeScenarioComparisonString(plotLike?.title) || `Custom plot ${index + 1}`
  const items = Array.isArray(plotLike?.items)
    ? Array.from(new Set(plotLike.items.map((item) => normalizeScenarioComparisonString(item)).filter(Boolean)))
    : []
  const scenarios = Array.isArray(plotLike?.scenarios)
    ? Array.from(new Set(plotLike.scenarios.map((scenario) => normalizeScenarioComparisonString(scenario)).filter(Boolean)))
    : []

  return {
    id: plotLike?.id || makePlotId?.(),
    title,
    items,
    scenarios,
    settings: {
      ...(defaultSettings || {}),
      ...(plotLike?.settings || {}),
    },
    isVisible: plotLike?.isVisible !== false,
    option: {},
  }
}

export function serializeCustomPlots(plots) {
  return plots.map((plot) => ({
    id: plot.id,
    title: plot.title,
    items: [...plot.items],
    scenarios: [...plot.scenarios],
    settings: { ...plot.settings },
    isVisible: plot.isVisible !== false,
  }))
}

export function hydrateStoredCustomPlots(plots, buildOption) {
  return plots.map((plot) => ({
    ...plot,
    option: buildOption ? (buildOption(plot) || {}) : {},
  }))
}
