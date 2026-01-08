<script setup>
import { ref, onMounted, watch } from 'vue';
import FileTree from '@/components/FileTree.vue';
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import Notification from "@/components/Notification.vue";
import Table from "@/components/Table.vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { checkBackendReady, fetchSettings, fetchFileTree } from "@/utils/functions.js";
import InputWorkFolder from "@/components/InputWorkFolder.vue";
import WorkSettings from "@/components/WorkSettings.vue";


const inputFiles = ref({});
const projectFiles = ref([]);
const workFolderFiles = ref([]);
const loading = ref(true);
const backendUnavailable = ref(true);
const settingStore = useSettingStore()
const notify = useNotificationStore()
const activeProjectIndex = ref(0)

function setActiveProject(i) {
  activeProjectIndex.value = i
}

onMounted(async () => {
  const ready = await checkBackendReady()
  if (ready) {
    await fetchSettings()
    await fetchInputFiles()
    await fetchProjectFiles()
    backendUnavailable.value = false
    loading.value = false
  }
})

watch(() => [settingStore.workFolders], ([newworkFolders], [prevworkFolders]) => {
  if (newworkFolders !== prevworkFolders) {
    loading.value = true;
    fetchWorkFolderFiles();
    loading.value = false;
  }
});

const fetchInputFiles = async () => {
  const data = await fetchFileTree("fetch_input_file_tree", notify)
  inputFiles.value = data.children
};

const fetchProjectFiles = async () => {
  const data = await fetchFileTree("fetch_project_file_tree", notify)
  projectFiles.value = data.children
  // settingStore.projectPath.value = data.children
};

const fetchWorkFolderFiles = async () => {
  if (Object.keys(settingStore.workFolders).length === 0) {
    workFolderFiles.value = []
    activeProjectIndex.value = 0
    return
  }
  workFolderFiles.value = await fetchFileTree("fetch_work_folders_tree", notify)

  if (activeProjectIndex.value >= workFolderFiles.value.length) {
    activeProjectIndex.value = Math.max(0, workFolderFiles.value.length - 1)
  }
};

</script>

<template>
  <section class="bg-blue-50 px-4 py-10">
    <div class="container-xl lg:container m-auto">
      <Notification />
      <h1 class="text-3xl text-blue-500 mb-6">Welcome to SiteOptApp</h1>
      <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Spinner v-if="loading" message="Loading..." class="col-span-1 md:col-span-3" />
          <template v-else>
            <template v-if="!backendUnavailable">
              <ContentPanel class="col-span-2" :content="Table" />
              <div class="col-span-3 bg-white rounded-xl shadow-md relative p-2 text-sm">
                <h1 class="text-black text-base mb-2 font-bold">Projects</h1>
                <InputWorkFolder class="mb-1" @created="fetchWorkFolderFiles" />
                <!-- Tabs row -->
                <div v-if="Array.isArray(workFolderFiles) && workFolderFiles.length" class="flex flex-wrap gap-2 mb-3">
                  <button
                    v-for="(tree, i) in workFolderFiles"
                    :key="tree?.[0]?.name ?? i"
                    @click="setActiveProject(i)"
                    class="px-3 py-1 rounded-md text-sm border"
                    :class="i === activeProjectIndex
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'"
                  >
                    {{ tree?.[0]?.name ?? `Project ${i + 1}` }}
                  </button>
                </div>

                <!-- Active project panel -->
                <div v-if="Array.isArray(workFolderFiles) && workFolderFiles.length" class="border border-gray-500 p-2">
                  <div class="text-gray-600 text-sm mb-2">
                    <span>
                      {{ workFolderFiles[activeProjectIndex][0].path + "\\" + workFolderFiles[activeProjectIndex][0].name }}
                    </span>
                  </div>

                  <FileTree
                    class="bg-blue-50 rounded-l shadow-md relative p-2"
                    :model="workFolderFiles[activeProjectIndex]"
                    :path="workFolderFiles[activeProjectIndex][0].path"
                    :enableOpen="true"
                  />

                  <WorkSettings class="pt-2" :workDirName="workFolderFiles[activeProjectIndex][0].name" />
                </div>

                <!-- Empty state -->
                <div v-else class="text-gray-500 text-sm p-2">
                  Create a project to begin.
                </div>
              </div>
            </template>
            <template v-else>
              <ContentPanel class="col-span-1" />
            </template>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>
