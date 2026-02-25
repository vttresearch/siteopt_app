<script setup>
import { ref, watch } from "vue"
import FileTree from "@/components/FileTree.vue";
import { useSettingStore } from "@/stores/settingstore.js";


const settingStore = useSettingStore()
const selectedProjectPath = ref("")
const fileTreeModel = ref({})

watch(() => settingStore.activeProjectIndex, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    const basePath = settingStore.workFolderFiles[newVal].path
    const name = settingStore.workFolderFiles[newVal].name
    if (!basePath) {
      selectedProjectPath.value = name
    }
    selectedProjectPath.value = `${basePath.replace(/\/+$/, "")}/${name}`
    fileTreeModel.value = settingStore.workFolderFiles[newVal].children
  }
})

</script>

<template>
  <div v-if="Array.isArray(settingStore.workFolderFiles) && settingStore.workFolderFiles.length"
       class="border border-gray-500 p-2">
    <div class="text-gray-600 text-sm mb-2">
      <span> {{ selectedProjectPath }} </span>
    </div>
    <FileTree
      class="bg-blue-50 rounded-l shadow-md relative p-2 text-sm"
      :model="fileTreeModel"
      :path="selectedProjectPath"
      :enableOpen="true"
      :depth="1"
    />
  </div>
  <!-- When loading existing projects or no projects available -->
  <div v-else class="text-gray-500 text-sm p-2">
    <div v-if="settingStore.loadingProjects">
      <span>Loading projects...</span>
    </div>
    <div v-else>
      <span>Create a project to begin.</span>
    </div>
  </div>
</template>
