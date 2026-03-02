<script setup>
import { onMounted, ref } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import Notification from "@/components/Notification.vue";
import DataEditorPanel from "@/components/DataEditorPanel.vue";
import ProjectsPanel from "@/components/ProjectsPanel.vue";
import ExecutionPanel from "@/components/ExecutionPanel.vue";
import ResultsPanel from "@/components/ResultsPanel.vue";
import BackendConnectionStatusPanel from "@/components/BackendConnectionStatusPanel.vue";
import FileSelectorPanel from "@/components/FileSelectorPanel.vue";
import { checkBackendReady, fetchSettings, fetchWorkFolderFiles } from "@/utils/functions.js";

const settingStore = useSettingStore()
const activeTab = ref("projects")

onMounted(async () => {
  const ready = await checkBackendReady()
  if (ready) {
    await fetchSettings()
    await fetchWorkFolderFiles()
    settingStore.setActiveProjectIndex(0)
  }
})
</script>

<template>
  <section class="bg-blue-50 px-4 py-10">
    <div class="container-xl lg:container m-auto">
      <Notification />
      <h1 class="text-2xl text-blue-500 mb-6">Welcome to SiteOptApp</h1>

      <!-- Tabs when backend is available -->
      <div v-if="settingStore.backendAvailable" class="flex gap-1 border-b border-gray-300 mb-4">
        <button
          type="button"
          class="px-4 py-2 rounded-t font-medium transition-colors"
          :class="activeTab === 'projects' ? 'bg-white text-blue-600 border border-b-0 border-gray-300 -mb-px' : 'text-gray-600 hover:bg-white/70'"
          @click="activeTab = 'projects'"
        >
          Projects &amp; Execution
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-t font-medium transition-colors"
          :class="activeTab === 'results' ? 'bg-white text-blue-600 border border-b-0 border-gray-300 -mb-px' : 'text-gray-600 hover:bg-white/70'"
          @click="activeTab = 'results'"
        >
          Results
        </button>
      </div>

      <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template v-if="settingStore.backendAvailable">
            <div v-show="activeTab === 'projects'" class="col-span-3 flex flex-col gap-6">
              <div class="col-span-2 bg-white rounded-xl shadow-md relative p-4">
                <DataEditorPanel />
              </div>
              <div class="col-span-3 bg-white rounded-xl shadow-md relative p-4">
                <ProjectsPanel />
                <FileSelectorPanel />
              </div>
              <div class="col-span-3 bg-white rounded-xl shadow-md relative p-4">
                <ExecutionPanel />
              </div>
            </div>
            <div v-show="activeTab === 'results'" class="col-span-3 bg-white rounded-xl shadow-md relative p-4">
              <ResultsPanel />
            </div>
          </template>
          <template v-else>
            <div class="bg-white rounded-xl shadow-md relative p-4">
              <BackendConnectionStatusPanel />
            </div>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
