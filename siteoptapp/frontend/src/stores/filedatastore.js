import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useTableDataStore = defineStore('tableData', () => {

  const daata = ref({});
  const fname = ref("");
  const fpath = ref("");
  const folderId = ref(null);
  const loading = ref(false);

  function addData(name, data, filePath = "", folderIdValue = null) {
    fname.value = name;
    daata.value = data;
    fpath.value = filePath;
    folderId.value = folderIdValue;
  }

  function toggleLoading() {
    loading.value = !loading.value;
  }

  return { daata, fname, fpath, folderId, loading, addData, toggleLoading}
})
