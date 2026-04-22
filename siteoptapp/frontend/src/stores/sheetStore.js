import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSheetStore = defineStore('sheetStore', () => {
  const sheetsByName = ref({})  // { sheetName: { rows: [], meta: {}, dirty: false } }
  const activeSheet = ref(null)  // string or null
  const sheetDataUpdated = ref(false)

  function toggleSheetDataUpdated() {
    sheetDataUpdated.value = !sheetDataUpdated.value
  }

  function setActiveSheet(name) {
    activeSheet.value = name
  }

  function upsertSheet(name, rows, columns, meta = {}, markDirty = false) {
    const prev = sheetsByName.value[name]
    sheetsByName.value[name] = {
      rows: rows || [],
      columns: columns || [],
      meta: meta || prev?.meta || {},
      dirty: markDirty ? true : (prev?.dirty || false)
    }
  }

  function captureFromGrid(sheetName, gridApi) {
    if (!sheetName || !gridApi) return
    const rows = []
    gridApi.forEachNode((node) => rows.push({ ...node.data }))
    let columns = []  // Extract column names in visual order
    const defs = gridApi.getColumnDefs()
    columns = defs.filter(c => c.field && c.field !== "__id").map(c => c.field)  // Skip row number
    const prev = sheetsByName.value[sheetName]
    upsertSheet(sheetName, rows, columns, prev?.meta || {}, true)
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
    toggleSheetDataUpdated,
    setActiveSheet,
    upsertSheet,
    captureFromGrid,
    markDirty,
    clearAllSheets,
    saveAllDirtySheets
  }
})
