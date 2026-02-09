<script setup>
import { computed } from "vue"
import FileTree from "@/components/FileTree.vue";
import { useSettingStore } from "@/stores/settingstore.js";


const settingStore = useSettingStore()
const selectedProjectPath = computed(() => {
  return settingStore.workFolderFiles[settingStore.activeProjectIndex].path + "\\" + settingStore.workFolderFiles[settingStore.activeProjectIndex].name
});

</script>

<template>
  <div v-if="Array.isArray(settingStore.workFolderFiles) && settingStore.workFolderFiles.length"
       class="border border-gray-500 p-2">
    <div class="text-gray-600 text-sm mb-2">
      <span> {{ selectedProjectPath }} </span>
    </div>
    <FileTree
      class="bg-blue-50 rounded-l shadow-md relative p-2 text-sm"
      :model="settingStore.workFolderFiles[settingStore.activeProjectIndex].children"
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
