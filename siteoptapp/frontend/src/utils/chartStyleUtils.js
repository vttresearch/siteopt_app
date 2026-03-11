export const CHART_STYLE_THEME = {
    legendFontSize: 12,
    axisLabelFontSize: 14,
    axisNameFontSize: 12,
    titleFontSize: 16,
  
    horizontalLabelWidth: 220,
    verticalLabelWidth: 120,
  
    horizontalGrid: {
      left: 210,
      right: 20,
      top: 56,
      bottom: 56,
      containLabel: true
    },
  
    verticalGrid: {
      left: 56,
      right: 20,
      top: 56,
      bottom: 110,
      containLabel: true
    }
  }
  
  export function deepMerge(target = {}, source = {}) {
    const output = { ...target }
  
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key]
      const targetValue = output[key]
  
      if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        output[key] = deepMerge(targetValue, sourceValue)
      } else {
        output[key] = sourceValue
      }
    })
  
    return output
  }
  
  function getCategoryCount(option = {}, isHorizontal = false) {
    const categories = isHorizontal
      ? option?.yAxis?.data || []
      : option?.xAxis?.data || []
  
    return Array.isArray(categories) ? categories.length : 0
  }
  
  function wrapAxisLabel(value, maxLineLength = 14) {
    const text = String(value ?? "").trim()
    if (!text) return ""
  
    if (text.length <= maxLineLength) {
      return text
    }
  
    const separators = [" ", "_", "-", "/"]
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator)
        const lines = []
        let current = ""
  
        parts.forEach((part, index) => {
          const chunk = index === 0 ? part : `${separator}${part}`
          if ((current + chunk).length <= maxLineLength) {
            current += chunk
          } else {
            if (current) lines.push(current)
            current = part
          }
        })
  
        if (current) lines.push(current)
  
        return lines.slice(0, 3).join("\n")
      }
    }
  
    const lines = []
    for (let i = 0; i < text.length; i += maxLineLength) {
      lines.push(text.slice(i, i + maxLineLength))
      if (lines.length === 3) break
    }
  
    return lines.join("\n")
  }
  
  function getHorizontalGrid(option = {}) {
    const count = getCategoryCount(option, true)
  
    if (count > 20) {
      return {
        left: 250,
        right: 20,
        top: 56,
        bottom: 56,
        containLabel: true
      }
    }
  
    if (count > 10) {
      return {
        left: 230,
        right: 20,
        top: 56,
        bottom: 56,
        containLabel: true
      }
    }
  
    return { ...CHART_STYLE_THEME.horizontalGrid }
  }
  
  function getVerticalGrid(option = {}) {
    const count = getCategoryCount(option, false)
  
    if (count > 20) {
      return {
        left: 56,
        right: 20,
        top: 56,
        bottom: 150,
        containLabel: true
      }
    }
  
    if (count > 10) {
      return {
        left: 56,
        right: 20,
        top: 56,
        bottom: 130,
        containLabel: true
      }
    }
  
    return { ...CHART_STYLE_THEME.verticalGrid }
  }
  
  function getHorizontalAxisDefaults(option = {}) {
    const count = getCategoryCount(option, true)
  
    return {
      yAxis: {
        axisLabel: {
          interval: 0,
          width: count > 20 ? 240 : CHART_STYLE_THEME.horizontalLabelWidth,
          overflow: "break",
          fontSize: CHART_STYLE_THEME.axisLabelFontSize,
          lineHeight: 14,
          formatter: (value) => wrapAxisLabel(value, count > 20 ? 18 : 22)
        }
      },
      xAxis: {
        axisLabel: {
          fontSize: CHART_STYLE_THEME.axisLabelFontSize
        },
        nameTextStyle: {
          fontSize: CHART_STYLE_THEME.axisNameFontSize
        }
      }
    }
  }
  
  function getVerticalAxisDefaults(option = {}) {
    const count = getCategoryCount(option, false)
  
    return {
      xAxis: {
        axisLabel: {
          interval: 0,
          rotate: count > 20 ? 50 : count > 10 ? 35 : 20,
          width: count > 20 ? 90 : CHART_STYLE_THEME.verticalLabelWidth,
          overflow: "break",
          fontSize: CHART_STYLE_THEME.axisLabelFontSize,
          lineHeight: 14,
          formatter: (value) => wrapAxisLabel(value, count > 20 ? 10 : 14)
        },
        nameTextStyle: {
          fontSize: CHART_STYLE_THEME.axisNameFontSize
        }
      },
      yAxis: {
        axisLabel: {
          fontSize: CHART_STYLE_THEME.axisLabelFontSize
        },
        nameTextStyle: {
          fontSize: CHART_STYLE_THEME.axisNameFontSize
        }
      }
    }
  }
  
  export function getSharedChartStyle(option = {}) {
    const isHorizontal = Boolean(option?.yAxis?.data)
  
    const grid = isHorizontal
      ? getHorizontalGrid(option)
      : getVerticalGrid(option)
  
    const axisDefaults = isHorizontal
      ? getHorizontalAxisDefaults(option)
      : getVerticalAxisDefaults(option)
  
    const sharedDefaults = {
      animation: true,
  
      title: {
        textStyle: {
          fontSize: CHART_STYLE_THEME.titleFontSize,
          fontWeight: 600
        }
      },
  
      tooltip: {
        confine: true,
        appendToBody: true,
        extraCssText: "max-width: 320px; white-space: normal;"
      },
  
      legend: {
        type: "scroll",
        bottom: 8,
        left: "center",
        right: 16,
        textStyle: {
          fontSize: CHART_STYLE_THEME.legendFontSize
        }
      },
  
      grid,
  
      series: Array.isArray(option.series)
        ? option.series.map((seriesItem) => ({
            barMaxWidth: 36,
            barMinHeight: 2,
            ...seriesItem
          }))
        : []
    }
  
    return deepMerge(sharedDefaults, axisDefaults)
  }
  
  export function buildStyledChartOption(option = {}, overrides = {}) {
    const sharedStyle = getSharedChartStyle(option)
    return deepMerge(deepMerge(sharedStyle, option), overrides)
  }