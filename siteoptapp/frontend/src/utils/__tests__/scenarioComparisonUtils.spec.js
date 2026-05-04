import assert from "node:assert/strict";

import {
  normalizeStoredCustomPlot,
  serializeCustomPlots,
  hydrateStoredCustomPlots,
} from "../scenarioComparisonUtils.js";

export const scenarioComparisonUtilsTests = [
  {
    name: "normalizeStoredCustomPlot restores saved plot structure with defaults",
    run() {
      const plot = normalizeStoredCustomPlot(
        {
          title: "  My Plot  ",
          items: [" item_a ", "item_a", "item_b"],
          scenarios: [" base ", "peak"],
          settings: { orientation: "horizontal" },
        },
        0,
        {
          makePlotId: () => "generated-id",
          defaultSettings: {
            yAxisScale: "linear",
            topNValues: 10,
            useMinBarHeight: true,
            hideZeroValues: false,
            orientation: "vertical",
          },
        },
      );

      assert.equal(plot.id, "generated-id");
      assert.equal(plot.title, "My Plot");
      assert.deepEqual(plot.items, ["item_a", "item_b"]);
      assert.deepEqual(plot.scenarios, ["base", "peak"]);
      assert.equal(plot.settings.orientation, "horizontal");
      assert.equal(plot.settings.topNValues, 10);
      assert.deepEqual(plot.option, {});
    },
  },
  {
    name: "hydrateStoredCustomPlots rebuilds chart options for restored plots",
    run() {
      const hydrated = hydrateStoredCustomPlots(
        [
          {
            id: "plot-1",
            title: "Restored Plot",
            items: ["capacity"],
            scenarios: ["base"],
            settings: { orientation: "vertical" },
            option: {},
          },
        ],
        (plot) => ({
          title: { text: plot.title },
          series: [{ name: plot.scenarios[0], data: [1] }],
        }),
      );

      assert.equal(hydrated[0].option.title.text, "Restored Plot");
      assert.deepEqual(hydrated[0].option.series, [{ name: "base", data: [1] }]);
    },
  },
  {
    name: "serializeCustomPlots removes runtime option payload from saved metadata",
    run() {
      const serialized = serializeCustomPlots([
        {
          id: "plot-1",
          title: "Keep Me",
          items: ["capacity"],
          scenarios: ["base"],
          settings: { orientation: "vertical" },
          option: { series: [{ data: [1] }] },
        },
      ]);

      assert.deepEqual(serialized, [
        {
          id: "plot-1",
          title: "Keep Me",
          items: ["capacity"],
          scenarios: ["base"],
          settings: { orientation: "vertical" },
        },
      ]);
    },
  },
];
