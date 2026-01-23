import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useTableDataStore = defineStore('tableData', () => {

  const daata = ref({});
  const fname = ref("");
  const fpath = ref("");
  const loading = ref(false);
  const dirty = ref(false);

  function addData(name, path, data) {
    fname.value = name;
    fpath.value = path;
    daata.value = data;
    dirty.value = false;
  }

  function setDirty(v) {
    dirty.value = v
  }

  function setLoading(v) {
    loading.value = v
  }

  function toggleLoading() {
    loading.value = !loading.value;
  }

  function clear() {
    fname.value = "";
    fpath.value = "";
    daata.value = {};
    loading.value = false;
    dirty.value = false;
  }

  return { daata, fname, fpath, loading, dirty, addData, setDirty, setLoading, toggleLoading, clear}
})
