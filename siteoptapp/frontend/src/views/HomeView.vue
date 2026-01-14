<script setup>
import { ref, onMounted, watch } from 'vue';
import FileTree from '@/components/FileTree.vue';
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import Notification from "@/components/Notification.vue";
import Table from "@/components/Table.vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { checkBackendReady, fetchSettings, fetchFileTree, postRemoveWorkFolder, postListExistingWorkFolders, postAddExistingWorkFolder } from "@/utils/functions.js";
import InputWorkFolder from "@/components/InputWorkFolder.vue";
import WorkSettings from "@/components/WorkSettings.vue";
import BaseButton from "@/components/ui/BaseButton.vue";

const inputFiles = ref({});
const projectFiles = ref([]);
const workFolderFiles = ref([]);
const loading = ref(true);
const backendUnavailable = ref(true);
const settingStore = useSettingStore()
const notify = useNotificationStore()
const activeProjectIndex = ref(0)
const restoreOpen = ref(false)
const restoreCandidates = ref([])
const restoring = ref(false)

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

async function removeProject(name) {
  if (!name) return
  const ok = confirm(`Remove "${name}" from view? Files stay on disk.`)
  if (!ok) return

  const r = await postRemoveWorkFolder(name, notify)
  if (r?.success) {
    await fetchSettings()
    await fetchWorkFolderFiles()
    notify.show("Removed from view", 2000, "info")
  }
}

async function openRestore() {
  restoring.value = true
  const r = await postListExistingWorkFolders(notify)
  restoring.value = false

  if (r?.success) {
    restoreCandidates.value = r.data ?? []
    restoreOpen.value = true
  }
}

async function restoreProject(c) {
  const r = await postAddExistingWorkFolder(c.name, c.path, notify)
  if (r?.success) {
    restoreOpen.value = false
    await fetchSettings()
    await fetchWorkFolderFiles()
    notify.show("Project restored", 2000, "info")
  }
}

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
                <div class="flex items-center gap-2 mb-2">
                  <div class="shrink-0">
                    <InputWorkFolder @created="fetchWorkFolderFiles" />
                  </div>
                  <BaseButton
                    :disabled="restoring"
                    @click="openRestore"
                  >
                    {{ restoring ? "Checking..." : "Open existing project" }}
                  </BaseButton>
                </div>

                <!-- Tabs row -->
              <div v-if="Array.isArray(workFolderFiles) && workFolderFiles.length" class="flex flex-wrap gap-2 mb-3">
                <div v-for="(tree, i) in workFolderFiles" :key="tree?.[0]?.name ?? i" class="flex items-stretch">
                <BaseButton
                  variant="secondary"
                  class="relative pr-8"
                  :class="i === activeProjectIndex && 'ring-2 ring-blue-500'"
                  @click="setActiveProject(i)"
                >
                  {{ tree?.[0]?.name ?? `Project ${i + 1}` }}
                  <span
                    class="absolute right-2 top-1/2 -translate-y-1/2
                          text-red-600 hover:text-red-800 cursor-pointer"
                    title="Remove from view"
                    @click.stop="removeProject(tree?.[0]?.name)"
                  >
                    ✕
                  </span>
                </BaseButton>
                </div>
              </div>
              <div v-if="restoreOpen" class="mb-3 border border-gray-300 rounded p-3 bg-gray-50">
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold text-gray-800">Restore project</div>
                <BaseButton variant="ghost" @click="restoreOpen = false">Close</BaseButton>
              </div>

              <div v-if="restoreCandidates.length === 0" class="text-sm text-gray-600">
                No hidden projects found.
              </div>
              <div v-else class="space-y-2">
                <BaseButton
                  v-for="c in restoreCandidates"
                  :key="c.path"
                  variant="secondary"
                  class="w-full justify-start text-left"
                  @click="restoreProject(c)"
                >
                  <div class="w-full">
                    <div class="font-medium">{{ c.name }}</div>
                    <div class="text-xs text-gray-500 truncate">{{ c.path }}</div>
                  </div>
                </BaseButton>
              </div>
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
                    :depth="0"
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
