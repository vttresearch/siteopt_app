import { ref } from 'vue'
import { defineStore } from 'pinia'

export function createSheetRecord({
  rows = [],
  columns = [],
  meta = {},
  validationsByColumn = {},
  dirty = false,
} = {}) {
  return {
    rows: Array.isArray(rows) ? rows : [],
    columns: Array.isArray(columns) ? columns : [],
    meta: meta && typeof meta === "object" ? meta : {},
    validationsByColumn:
      validationsByColumn && typeof validationsByColumn === "object"
        ? validationsByColumn
        : {},
    dirty: Boolean(dirty),
  }
}

export function normalizeSheetPayload(payload = {}) {
  if (Array.isArray(payload)) {
    return createSheetRecord({ rows: payload })
  }

  return createSheetRecord({
    rows: payload?.rows,
    columns: payload?.columns,
    meta: payload?.meta,
    validationsByColumn: payload?.validationsByColumn,
  })
}

export const useSheetStore = defineStore('sheetStore', () => {
  const sheetsByName = ref({})  // { sheetName: { rows, columns, meta, validationsByColumn, dirty } }
  const activeSheet = ref(null)  // string or null
  const sheetDataUpdated = ref(false)

  function reset() {
    sheetsByName.value = {}
    activeSheet.value = null
    sheetDataUpdated.value = false
  }

  function toggleSheetDataUpdated() {
    sheetDataUpdated.value = !sheetDataUpdated.value
  }

  function setActiveSheet(name) {
    activeSheet.value = name
  }

  function getSheet(name) {
    return sheetsByName.value[name] ?? null
  }

  function getActiveSheetRecord() {
    return getSheet(activeSheet.value) ?? createSheetRecord()
  }

  function upsertSheet(name, rows, columns, meta = {}, markDirty = false, validationsByColumn = undefined) {
    const prev = getSheet(name)
    const nextRecord = createSheetRecord({
      rows,
      columns,
      meta: meta || prev?.meta || {},
      validationsByColumn:
        validationsByColumn ?? prev?.validationsByColumn ?? {},
      dirty: markDirty ? true : (prev?.dirty || false),
    })
    sheetsByName.value[name] = nextRecord
  }

  function upsertSheetRecord(name, record, markDirty = false) {
    const prev = getSheet(name)
    const normalized = normalizeSheetPayload(record)
    sheetsByName.value[name] = createSheetRecord({
      rows: normalized.rows,
      columns: normalized.columns,
      meta: normalized.meta || prev?.meta || {},
      validationsByColumn:
        normalized.validationsByColumn ?? prev?.validationsByColumn ?? {},
      dirty: markDirty ? true : (prev?.dirty || false),
    })
  }

  function setWorkbookData(workbookData = {}) {
    clearAllSheets()

    for (const [sheetName, payload] of Object.entries(workbookData)) {
      upsertSheetRecord(sheetName, payload, false)
    }
  }

  function captureFromGrid(sheetName, gridApi) {
    if (!sheetName || !gridApi) return
    const rows = []
    gridApi.forEachNode((node) => rows.push({ ...node.data }))
    let columns = []  // Extract column names in visual order
    const defs = gridApi.getColumnDefs()
    columns = defs.filter(c => c.field && c.field !== "__id").map(c => c.field)  // Skip row number
    const prev = getSheet(sheetName)
    upsertSheet(
      sheetName,
      rows,
      columns,
      prev?.meta || {},
      true,
      prev?.validationsByColumn || {},
    )
  }

  function markDirty(sheetName, v = true) {
    if (sheetsByName.value[sheetName]) {
      sheetsByName.value[sheetName].dirty = v
    }
  }

  function clearAllSheets() {
    sheetsByName.value = {}
    activeSheet.value = null
  }

  async function saveAllDirtySheets(saveFn) {
    const names = Object.keys(sheetsByName.value)
    for (const n of names) {
      const sheet = sheetsByName.value[n]
      if (!sheet.dirty) continue
      await saveFn(n, sheet.rows, sheet.meta)
      sheet.dirty = false
    }
  }

  return {
    sheetsByName,
    activeSheet,
    sheetDataUpdated,
    reset,
    toggleSheetDataUpdated,
    setActiveSheet,
    getSheet,
    getActiveSheetRecord,
    upsertSheet,
    upsertSheetRecord,
    setWorkbookData,
    captureFromGrid,
    markDirty,
    clearAllSheets,
    saveAllDirtySheets
  }
})
