<script setup>
import { ref, onMounted } from 'vue';
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import Notification from "@/components/Notification.vue";
import DataEditorPanel from "@/components/DataEditorPanel.vue";
import ProjectsPanel from "@/components/ProjectsPanel.vue";
import ExecutionPanel from "@/components/ExecutionPanel.vue"
import { checkBackendReady, fetchSettings, fetchFileTree, fetchWorkFolderFiles } from "@/utils/functions.js";
import BackendConnectionStatusPanel from "@/components/BackendConnectionStatusPanel.vue";
import FileSelectorPanel from "@/components/FileSelectorPanel.vue";

const notify = useNotificationStore()
const settingStore = useSettingStore()
const inputFiles = ref({});
const projectFiles = ref([]);

onMounted(async () => {
  const ready = await checkBackendReady()
  if (ready) {
    await fetchSettings()
    await fetchInputFiles()
    await fetchProjectFiles()
    await fetchWorkFolderFiles()
  }
})

const fetchInputFiles = async () => {
  const data = await fetchFileTree("fetch_input_file_tree", notify)
  inputFiles.value = data.children
};

const fetchProjectFiles = async () => {
  const data = await fetchFileTree("fetch_project_file_tree", notify)
  projectFiles.value = data.children
};
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
