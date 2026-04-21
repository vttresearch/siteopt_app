import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useMetadataStore = defineStore('metadataData', () => {

  const metadata = ref(null)
  const metadataByName = ref({})  // ✅ cache for all projects
  const loadingMetadata = ref(false)

  function reset() {
    metadata.value = null
    metadataByName.value = {}
    loadingMetadata.value = false
  }

  function setMetadata(data) {
    metadata.value = data
    console.log("Metadata is now:", metadata.value)
  }

  function cacheMetadata(data) {
    if (!data?.name) return
    metadataByName.value[data.name] = data
  }

  return { metadata, metadataByName, loadingMetadata, reset, setMetadata, cacheMetadata }
})
