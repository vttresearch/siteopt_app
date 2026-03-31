export const CHART_STYLE_THEME = {
    legendFontSize: 12,
    axisLabelFontSize: 13,
    axisNameFontSize: 12,
    titleFontSize: 20,
    minDisplayRatio: 0.03,
  
    horizontalLabelWidth: 130,
    verticalLabelWidth: 120,
  
    horizontalBaseHeight: 420,
    horizontalRowHeight: 28,
    horizontalGrid: {
      left: "0%",
      right: "4%",
      top: 56,
      bottom: 72,
      containLabel: true
    },
  
    verticalGrid: {
      left: 0,
      right: 24,
      top: 56,
      bottom: 120,
      containLabel: true
    }
  }
  
  export const DASHBOARD_STYLE_THEME = {
    emptyStateClass:
      "flex items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500",
    sectionCardClass:
      "rounded-xl border border-gray-200 bg-white shadow-sm",
    controlClass:
      "w-full sm:w-56 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
    loadingCardClass:
      "rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm",
    pageEmptyClass:
      "rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-500",
    tableWrapperStyle: {
      minHeight: "240px",
      height: "100%"
    }
  }
  
  export function getDashboardEmptyStateClass(extra = "") {
    return `${DASHBOARD_STYLE_THEME.emptyStateClass}${extra ? ` ${extra}` : ""}`
  }
  
  export function getDashboardControlClass(extra = "") {
    return `${DASHBOARD_STYLE_THEME.controlClass}${extra ? ` ${extra}` : ""}`
  }
  
  export function getDashboardLoadingCardClass(extra = "") {
    return `${DASHBOARD_STYLE_THEME.loadingCardClass}${extra ? ` ${extra}` : ""}`
  }
  
  export function getDashboardPageEmptyClass(extra = "") {
    return `${DASHBOARD_STYLE_THEME.pageEmptyClass}${extra ? ` ${extra}` : ""}`
  }
  
  export function getTableWrapperStyle(overrides = {}) {
    return {
      ...DASHBOARD_STYLE_THEME.tableWrapperStyle,
      ...overrides
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
  
  function getCategoryData(option = {}, isHorizontal = false) {
    const categories = isHorizontal
      ? option?.yAxis?.data || []
      : option?.xAxis?.data || []
  
    return Array.isArray(categories) ? categories : []
  }
  
  function getCategoryCount(option = {}, isHorizontal = false) {
    return getCategoryData(option, isHorizontal).length
  }
  
  function getLongestCategoryLength(option = {}, isHorizontal = false) {
    const categories = getCategoryData(option, isHorizontal)
    if (!categories.length) return 0
  
    return categories.reduce((max, value) => {
      const len = String(value ?? "").trim().length
      return Math.max(max, len)
    }, 0)
  }
  
  function formatCompactNumber(value) {
    const num = Number(value)
    if (!Number.isFinite(num)) return value
  
    const abs = Math.abs(num)
  
    if (abs >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`
    }
  
    if (abs >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
    }
  
    if (abs >= 1_000) {
      return `${(num / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
    }
  
    return `${num}`
  }
  
  function wrapAxisLabel(value, maxLineLength = 18, maxLines = 3) {
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
  
        if (lines.length <= maxLines) {
          return lines.join("\n")
        }
  
        return `${lines.slice(0, maxLines).join("\n")}`
      }
    }
  
    const lines = []
    for (let i = 0; i < text.length; i += maxLineLength) {
      lines.push(text.slice(i, i + maxLineLength))
      if (lines.length === maxLines) break
    }
  
    return lines.join("\n")
  }
  
  function getHorizontalGrid(option = {}) {
    const count = getCategoryCount(option, true)
    const longest = getLongestCategoryLength(option, true)

    if (longest > 30 || count > 20) {
      return {
        left: "3%",
        right: "4%",
        top: 56,
        bottom: 72,
        containLabel: true
      }
    }

    if (longest > 18 || count > 10) {
      return {
        left: "3%",
        right: "4%",
        top: 56,
        bottom: 72,
        containLabel: true
      }
    }

    return { ...CHART_STYLE_THEME.horizontalGrid }
  }
  
  function getVerticalGrid(option = {}) {
    const count = getCategoryCount(option, false)
    const longest = getLongestCategoryLength(option, false)
  
    if (count > 20 || longest > 18) {
      return {
        left: 0,
        right: 24,
        top: 56,
        bottom: 160,
        containLabel: true
      }
    }
  
    if (count > 10 || longest > 12) {
      return {
        left: 0,
        right: 24,
        top: 56,
        bottom: 135,
        containLabel: true
      }
    }
  
    return { ...CHART_STYLE_THEME.verticalGrid }
  }
  
  function getHorizontalAxisDefaults(option = {}) {
    const count = getCategoryCount(option, true)
    const longest = getLongestCategoryLength(option, true)
  
    let labelWidth = CHART_STYLE_THEME.horizontalLabelWidth
    let wrapLength = 22
  
    if (longest > 30 || count > 20) {
      labelWidth = 300
      wrapLength = 24
    } else if (longest > 18 || count > 10) {
      labelWidth = 260
      wrapLength = 22
    }
  
    return {
      yAxis: {
        axisLabel: {
          interval: 0,
          width: labelWidth,
          overflow: "break",
          fontSize: CHART_STYLE_THEME.axisLabelFontSize,
          lineHeight: 16,
          margin: 18,
          formatter: (value) => wrapAxisLabel(value, wrapLength, 3)
        }
      },
      xAxis: {
        axisLabel: {
          fontSize: CHART_STYLE_THEME.axisLabelFontSize,
          hideOverlap: false,
          formatter: (value) => formatCompactNumber(value)
        },
        splitLine: {
          show: true
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
          margin: 14,
          verticalAlign: "top",
          width: CHART_STYLE_THEME.verticalLabelWidth,
          overflow: "break",
          fontSize: CHART_STYLE_THEME.axisLabelFontSize,
          lineHeight: 14,
          formatter: (value) => wrapAxisLabel(value, count > 20 ? 10 : 14, 3),
          hideOverlap: false
        },
        nameTextStyle: {
          fontSize: CHART_STYLE_THEME.axisNameFontSize
        }
      },
      yAxis: {
        axisLabel: {
          fontSize: CHART_STYLE_THEME.axisLabelFontSize,
          hideOverlap: false,
          formatter: (value) => formatCompactNumber(value)
        },
        splitLine: {
          show: true
        },
        nameTextStyle: {
          fontSize: CHART_STYLE_THEME.axisNameFontSize
        }
      }
    }
  }
  
  export function getAutoChartHeight(option = {}, baseHeight = 400) {
    const isHorizontal = Boolean(option?.yAxis?.data)
    if (!isHorizontal) return baseHeight
  
    const count = getCategoryCount(option, true)
    const dynamicHeight =
      CHART_STYLE_THEME.horizontalBaseHeight +
      Math.max(0, count - 8) * CHART_STYLE_THEME.horizontalRowHeight
  
    return Math.max(baseHeight, dynamicHeight)
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