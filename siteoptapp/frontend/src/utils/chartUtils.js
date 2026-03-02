/**
 * Utility functions for processing time series data and creating chart configurations
 */

/**
 * Detect if a CSV dataset contains time series data
 * @param {Array} data - CSV data as array of objects
 * @returns {Object} - Detection result with timeColumn and dataColumns
 */
export function detectTimeSeriesStructure(data) {
  if (!data || data.length === 0) return null;
  
  const firstRow = data[0];
  const columns = Object.keys(firstRow);
  
  // Look for time/date column
  const timeColumn = columns.find(col => 
    col.toLowerCase().includes('time') ||
    col.toLowerCase().includes('date') ||
    col.toLowerCase().includes('timestamp')
  );
  
  if (!timeColumn) return null;
  
  // Get numeric columns (excluding time and metadata)
  const metadataColumns = ['objectclass', 'parameter_name', 'alternative'];
  const dataColumns = columns.filter(col => 
    col !== timeColumn && 
    !metadataColumns.includes(col.toLowerCase()) &&
    !isNaN(parseFloat(firstRow[col]))
  );
  
  return {
    timeColumn,
    dataColumns,
    isTimeSeries: dataColumns.length > 0
  };
}

/**
 * Process CSV data for time series charting
 * @param {Array} data - Raw CSV data
 * @param {Array} selectedColumns - Columns to chart
 * @param {string} timeColumn - Time column name
 * @returns {Object} - ECharts configuration
 */
export function processTimeSeriesData(data, selectedColumns, timeColumn) {
  if (!data || data.length === 0) return null;
  
  // Parse time data and sort by time
  const sortedData = data
    .map(row => ({
      ...row,
      parsedTime: new Date(row[timeColumn])
    }))
    .filter(row => !isNaN(row.parsedTime.getTime()))
    .sort((a, b) => a.parsedTime - b.parsedTime);
  
  // Prepare series data
  const series = selectedColumns.map(col => ({
    name: col,
    type: 'line',
    data: sortedData.map(row => [
      row.parsedTime.getTime(),
      parseFloat(row[col]) || 0
    ]),
    smooth: true,
    lineStyle: { width: 2 },
    emphasis: { focus: 'series' }
  }));
  
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: function(params) {
        const time = new Date(params[0].value[0]);
        let html = `<div><strong>${time.toLocaleString()}</strong></div>`;
        params.forEach(param => {
          html += `<div>${param.marker} ${param.seriesName}: ${param.value[1].toFixed(2)}</div>`;
        });
        return html;
      }
    },
    legend: {
      data: selectedColumns,
      type: 'scroll',
      orient: 'horizontal',
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    toolbox: {
      feature: {
        dataZoom: { yAxisIndex: 'none' },
        restore: {},
        saveAsImage: {}
      }
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: {
        formatter: function(value) {
          const date = new Date(value);
          return date.toLocaleDateString() + '\n' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}'
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      },
      {
        start: 0,
        end: 100,
        handleIcon: 'M10.7,11.9v-1.3H9.3v1.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4v1.3h1.3v-1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z',
        handleSize: '80%',
        handleStyle: {
          color: '#fff',
          shadowBlur: 3,
          shadowColor: 'rgba(0, 0, 0, 0.6)',
          shadowOffsetX: 2,
          shadowOffsetY: 2
        }
      }
    ],
    series: series
  };
}

/**
 * Create aggregated view options for large datasets
 * @param {Array} data - Time series data
 * @param {string} timeColumn - Time column name
 * @returns {Array} - Available aggregation options
 */
export function getAggregationOptions(data, timeColumn) {
  if (!data || data.length === 0) return [];
  
  const options = ['Raw Data'];
  
  // Determine time span
  const times = data.map(row => new Date(row[timeColumn])).filter(d => !isNaN(d.getTime()));
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpanDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
  
  if (timeSpanDays > 7) options.push('Daily Average');
  if (timeSpanDays > 30) options.push('Weekly Average');
  if (timeSpanDays > 365) options.push('Monthly Average');
  
  return options;
}

/**
 * Generate color palette for multiple series
 * @param {number} count - Number of colors needed
 * @returns {Array} - Array of color hex codes
 */
export function generateColorPalette(count) {
  const baseColors = [
    '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
    '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#5470c6'
  ];
  
  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }
  
  // Generate additional colors if needed
  const colors = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle approximation
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  
  return colors;
}

function normalizeStr(s) {
  return String(s ?? '').trim();
}

/**
 * Detect scenario comparison structure from results data (array of row objects).
 * @param {Array} data - Rows from xlsx/csv (array of objects)
 * @returns {Object|null} - { scenarios, items, hasSummaries, summaries, summaryItemMap, hasEntities, itemEntityMap }
 */
export function detectScenarioStructure(data) {
  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  if (!columns.length) return null;

  const scenarioKeywords = ['scenario', 'alternative', 'case', 'run', 'variant'];
  const scenarioCol = columns.find(c => scenarioKeywords.some(k => c.toLowerCase().includes(k)));
  const itemCol = columns.find(c => /^(item|parameter|variable|metric|name)$/i.test(c));
  const valueCol = columns.find(c => /^(value|values?|result|total)$/i.test(c));
  const categoryCol = columns.find(c => /^(category|summary|group|type)$/i.test(c));
  const entityCol = columns.find(c => /^(entity|entityid|object)$/i.test(c));

  const scenarioColumn = scenarioCol || (columns.length > 1 ? columns[0] : null);
  const scenarios = scenarioColumn
    ? [...new Set(data.map(r => normalizeStr(r[scenarioColumn])).filter(Boolean))].sort()
    : [];

  let items = [];
  let hasSummaries = false;
  let summaries = [];
  const summaryItemMap = {};
  let hasEntities = false;
  const itemEntityMap = {};

  if (itemCol && valueCol) {
    items = [...new Set(data.map(r => normalizeStr(r[itemCol])).filter(Boolean))].sort();
    if (categoryCol) {
      hasSummaries = true;
      const byCat = {};
      data.forEach(r => {
        const cat = normalizeStr(r[categoryCol]) || 'Other';
        const item = normalizeStr(r[itemCol]);
        if (!item) return;
        if (!byCat[cat]) byCat[cat] = new Set();
        byCat[cat].add(item);
      });
      summaries = Object.keys(byCat).sort();
      summaries.forEach(cat => {
        summaryItemMap[cat] = [...byCat[cat]].sort();
      });
    }
    if (entityCol) {
      hasEntities = true;
      const byItem = {};
      data.forEach(r => {
        const item = normalizeStr(r[itemCol]);
        const entity = normalizeStr(r[entityCol]);
        if (!item) return;
        if (!byItem[item]) byItem[item] = new Set();
        if (entity) byItem[item].add(entity);
      });
      Object.keys(byItem).forEach(item => {
        itemEntityMap[item] = [...byItem[item]].sort();
      });
    }
  } else {
    const numericCols = columns.filter(c => {
      if (c === scenarioColumn) return false;
      const v = data[0][c];
      return v !== undefined && v !== null && (typeof v === 'number' || !isNaN(parseFloat(v)));
    });
    items = numericCols;
    if (items.length > 0) {
      hasSummaries = true;
      summaries = [...items];
      items.forEach(i => { summaryItemMap[i] = [i]; });
    }
  }

  return {
    scenarios,
    items,
    hasSummaries,
    summaries,
    summaryItemMap,
    hasEntities,
    itemEntityMap
  };
}

/**
 * Build category-totals chart config (grouped bar: categories on x-axis, one series per scenario).
 */
export function processCategorySummedData(data, scenarioStructure, scenarios, chartType, yAxisScale, useMinBarHeight, hideZeroValues) {
  if (!data?.length || !scenarioStructure || !scenarios?.length) return null;

  const categories = scenarioStructure.summaries?.length ? scenarioStructure.summaries : scenarioStructure.items;
  if (!categories?.length) return null;

  const scenarioColumn = Object.keys(data[0]).find(c => /^(scenario|alternative|case|run)$/i.test(c)) || Object.keys(data[0])[0];
  const itemCol = Object.keys(data[0]).find(c => /^(item|parameter|variable)$/i.test(c));
  const valueCol = Object.keys(data[0]).find(c => /^(value|values?|result|total)$/i.test(c));
  const categoryCol = Object.keys(data[0]).find(c => /^(category|summary|group|type)$/i.test(c));

  const getValue = (row, cat) => {
    if (valueCol) return parseFloat(row[valueCol]) || 0;
    const v = row[cat];
    return v !== undefined && v !== null ? (typeof v === 'number' ? v : parseFloat(v) || 0) : 0;
  };

  const sums = {};
  scenarios.forEach(s => { sums[s] = {}; categories.forEach(c => { sums[s][c] = 0; }); });

  if (itemCol && valueCol && categoryCol) {
    data.forEach(row => {
      const sc = normalizeStr(row[scenarioColumn]);
      const cat = normalizeStr(row[categoryCol]) || 'Other';
      if (!scenarios.includes(sc) || !categories.includes(cat)) return;
      sums[sc][cat] += parseFloat(row[valueCol]) || 0;
    });
  } else {
    data.forEach(row => {
      const sc = normalizeStr(row[scenarioColumn]);
      if (!scenarios.includes(sc)) return;
      categories.forEach(cat => {
        const v = getValue(row, cat);
        if (hideZeroValues && v === 0) return;
        sums[sc][cat] += v;
      });
    });
  }

  let categoriesToShow = categories;
  if (hideZeroValues) {
    categoriesToShow = categories.filter(cat =>
      scenarios.some(sc => (sums[sc][cat] ?? 0) !== 0)
    );
  }

  const series = scenarios.map(name => {
    const rawData = categoriesToShow.map(cat => sums[name][cat] ?? 0);
    let data = rawData;
    if (useMinBarHeight && rawData.some(v => v > 0)) {
      const maxVal = Math.max(...rawData);
      const minDisplay = maxVal > 0 ? maxVal * 0.005 : 0;
      data = rawData.map(v => {
        if (v === 0) return 0;
        const display = Math.max(v, minDisplay);
        return display !== v ? { value: display, actualValue: v } : v;
      });
    }
    return { name, type: 'bar', data };
  });

  const colors = generateColorPalette(series.length);
  const tooltip = {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    formatter: useMinBarHeight ? (params) => {
      if (!params?.length) return '';
      const lines = [params[0].axisValue];
      params.forEach(p => {
        const val = p.data?.actualValue ?? p.value;
        const num = typeof val === 'number' ? val : (p.data?.value ?? p.value);
        lines.push(`${p.marker} ${p.seriesName}: ${num}`);
      });
      return lines.join('<br/>');
    } : undefined
  };
  return {
    tooltip: tooltip.formatter ? tooltip : { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: scenarios, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: categoriesToShow },
    yAxis: { type: 'value', scale: yAxisScale === 'log' },
    series: series.map((s, i) => ({ ...s, itemStyle: { color: colors[i % colors.length] } }))
  };
}

/**
 * Build scenario comparison chart (items vs scenarios, grouped or horizontal bar).
 */
export function processScenarioComparisonData(data, scenarioStructure, items, scenarios, chartType, showEntities, entities, yAxisScale, useMinBarHeight, hideZeroValues) {
  if (!data?.length || !scenarioStructure || !items?.length || !scenarios?.length) return null;

  const scenarioColumn = Object.keys(data[0]).find(c => /^(scenario|alternative|case|run)$/i.test(c)) || Object.keys(data[0])[0];
  const itemCol = Object.keys(data[0]).find(c => /^(item|parameter|variable)$/i.test(c));
  const valueCol = Object.keys(data[0]).find(c => /^(value|values?|result|total)$/i.test(c));

  const getValue = (row, itemKey) => {
    if (valueCol && itemCol) {
      if (normalizeStr(row[itemCol]) !== normalizeStr(itemKey)) return 0;
      return parseFloat(row[valueCol]) || 0;
    }
    const v = row[itemKey];
    return v !== undefined && v !== null ? (typeof v === 'number' ? v : parseFloat(v) || 0) : 0;
  };

  const series = scenarios.map(scenarioName => {
    const rawData = items.map(item => {
      if (itemCol && valueCol) {
        const rows = data.filter(r => normalizeStr(r[scenarioColumn]) === scenarioName && normalizeStr(r[itemCol]) === item);
        return rows.reduce((sum, row) => sum + (parseFloat(row[valueCol]) || 0), 0);
      }
      const row = data.find(r => normalizeStr(r[scenarioColumn]) === scenarioName);
      return row ? getValue(row, item) : 0;
    });
    let outData = rawData;
    if (useMinBarHeight && rawData.some(v => v > 0)) {
      const maxVal = Math.max(...rawData);
      const minDisplay = maxVal > 0 ? maxVal * 0.005 : 0;
      outData = rawData.map(v => {
        if (v === 0) return 0;
        const display = Math.max(v, minDisplay);
        return display !== v ? { value: display, actualValue: v } : v;
      });
    }
    return { name: scenarioName, type: 'bar', data: outData };
  });

  let itemsToShow = items;
  let seriesToUse = series;
  if (hideZeroValues) {
    const nonZeroIndices = items.map((_, i) => i).filter(i =>
      series.some(s => {
        const d = s.data[i];
        const v = (d && typeof d === 'object' && 'actualValue' in d) ? d.actualValue : (d?.value ?? d);
        return (v ?? 0) !== 0;
      })
    );
    itemsToShow = nonZeroIndices.map(i => items[i]);
    seriesToUse = series.map(s => ({
      ...s,
      data: nonZeroIndices.map(i => s.data[i])
    }));
  }

  const colors = generateColorPalette(seriesToUse.length);
  const axisCategories = itemsToShow;

  const tooltip = {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    ...(useMinBarHeight && {
      formatter: (params) => {
        if (!params?.length) return '';
        const lines = [params[0].axisValue];
        params.forEach(p => {
          const val = p.data?.actualValue ?? p.value;
          const num = typeof val === 'number' ? val : (p.data?.value ?? p.value);
          lines.push(`${p.marker} ${p.seriesName}: ${num}`);
        });
        return lines.join('<br/>');
      }
    })
  };

  const base = {
    tooltip,
    legend: { data: scenarios, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    series: seriesToUse.map((s, i) => ({ ...s, itemStyle: { color: colors[i % colors.length] } }))
  };

  if (chartType === 'horizontalBar') {
    base.yAxis = { type: 'category', data: axisCategories, inverse: true };
    base.xAxis = { type: 'value', scale: yAxisScale === 'log' };
  } else {
    base.xAxis = { type: 'category', data: axisCategories };
    base.yAxis = { type: 'value', scale: yAxisScale === 'log' };
  }

  return base;
}
