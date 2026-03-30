<script setup>
import { onMounted, ref } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import Notification from "@/components/Notification.vue";
import ProjectsToolbar from "@/components/ProjectsToolbar.vue";
import DataEditorPanel from "@/components/DataEditorPanel.vue";
import ExecutionPanel from "@/components/ExecutionPanel.vue";
import ResultsPanel from "@/components/ResultsPanel.vue";
import BackendConnectionStatusPanel from "@/components/BackendConnectionStatusPanel.vue";
import {
  checkBackendReady,
  fetchSettings,
  fetchInputFiles,
  fetchResults,
  fetchScenarios,
} from "@/utils/functions.js";


const settingStore = useSettingStore()
const activeTab = ref("projects")

onMounted(async () => {
  const ready = await checkBackendReady()
  if (ready) {
    await fetchSettings()
    if (Object.keys(settingStore.workFolders ?? []).length > 0) {
      settingStore.setActiveProject(0)
      console.log("settingStore.workFolders:", settingStore.workFolders)
      await fetchInputFiles(settingStore.activeProjectName)
      await fetchResults(settingStore.activeProjectName)
      await fetchScenarios(settingStore.activeProjectPath)
    }
    else {
      settingStore.setActiveProject(null)
    }
  }
})
</script>

<template>
  <section class="bg-blue-50 p-6">
    <Notification />
    <ProjectsToolbar />

    <template v-if="settingStore.backendAvailable">
      <div v-if="settingStore.activeProjectIndex !== null">

        <div class="bg-blue-100 border-1 border-gray-200 p-4">
          <!-- Data & Execution and Results tabs  -->
          <div class="flex gap-1 border-b border-gray-300 mb-4">
            <button
              type="button"
              class="px-4 py-2 rounded-t font-medium transition-colors"
              :class="activeTab === 'projects' ? 'bg-white text-blue-600 border border-b-0 border-gray-300 -mb-px' : 'text-gray-600 hover:bg-white/70 cursor-pointer'"
              @click="activeTab = 'projects'"
            >
              Data &amp; Execution
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-t font-medium transition-colors"
              :class="activeTab === 'results' ? 'bg-white text-blue-600 border border-b-0 border-gray-300 -mb-px' : 'text-gray-600 hover:bg-white/70 cursor-pointer'"
              @click="activeTab = 'results'"
            >
              Results
            </button>
          </div>

          <!-- Data Editor & Execution Panels  -->
          <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div v-show="activeTab === 'projects'" class="col-span-3 flex flex-col gap-6">
                  <div class="col-span-3 bg-white rounded-xl shadow-md relative p-4">
                    <DataEditorPanel />
                  </div>
                  <div class="col-span-3 bg-white rounded-xl shadow-md relative p-4">
                    <ExecutionPanel />
                  </div>
                </div>
                <div v-if="activeTab === 'results'" class="col-span-3 bg-white rounded-xl shadow-md relative p-4">
                  <ResultsPanel />
                </div>
            </div>
          </div>
        </div>
      </div>
      <div v-else>
        <div class="bg-white rounded-xl shadow-md relative mt-10 p-4">
          <h1 class="text-3xl text-gray-800 pb-8">Welcome to SiteOptApp</h1>
          <span class="text-gray-800">Create a New Project or Open an existing one to begin.</span>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="bg-white rounded-xl shadow-md relative p-4">
        <BackendConnectionStatusPanel />
      </div>
    </template>

  </section>
</template>
