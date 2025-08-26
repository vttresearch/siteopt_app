import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useTableDataStore = defineStore('tableData', () => {

  const daata = ref({});
  const fname = ref("");
  const loading = ref(false);

  function addData(name, data) {
    fname.value = name;
    daata.value = data;
  }

  function toggleLoading() {
    loading.value = !loading.value;
  }

  return { daata, fname, loading, addData, toggleLoading}
})
