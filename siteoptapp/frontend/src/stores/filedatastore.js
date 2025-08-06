import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useTableDataStore = defineStore('tableData', () => {

  const daata = ref({})
  const fname = ref("")

  function addData(name, data) {
    fname.value = name
    daata.value = data
  }

  return { daata, fname, addData }
})
