<script setup>
import { onMounted } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import Notification from "@/components/Notification.vue";
import DataEditorPanel from "@/components/DataEditorPanel.vue";
import ProjectsPanel from "@/components/ProjectsPanel.vue";
import ExecutionPanel from "@/components/ExecutionPanel.vue"
import BackendConnectionStatusPanel from "@/components/BackendConnectionStatusPanel.vue";
import FileSelectorPanel from "@/components/FileSelectorPanel.vue";
import { checkBackendReady, fetchSettings, fetchWorkFolderFiles } from "@/utils/functions.js";

const settingStore = useSettingStore()

onMounted(async () => {
  const ready = await checkBackendReady()
  if (ready) {
    await fetchSettings()
    await fetchWorkFolderFiles()
  }
})
</script>

<template>
  <section class="bg-blue-50 px-4 py-10">
    <div class="container-xl lg:container m-auto">
      <Notification />
      <h1 class="text-2xl text-blue-500 mb-6">Welcome to SiteOptApp</h1>
      <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <template v-if="settingStore.backendAvailable">
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
