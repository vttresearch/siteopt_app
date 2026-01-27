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
