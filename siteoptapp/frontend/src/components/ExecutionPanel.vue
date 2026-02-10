<script setup>
import { ref, onUnmounted, watch, computed } from 'vue';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { postData, fetchWorkFolder } from "@/utils/functions.js";
import { API_BASE } from "@/config.js";
import BaseButton from "@/components/ui/BaseButton.vue";


const notify = useNotificationStore()
const settingStore = useSettingStore()
const execType = ref("all")
const executionOutput = ref([])
const executionFinished = ref(false)
const localExecutionInProgress = ref(false)
const remoteExecutionInProgress = ref(false)
let eventSource = null

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
})

const workDirName = computed(() => {
  if (settingStore.activeProjectIndex in Object.keys(settingStore.workFolderFiles)) {
    return settingStore.workFolderFiles[settingStore.activeProjectIndex].name
  }
  else return null
});

watch(executionFinished, async (newExecutionFinished) => {
  if (newExecutionFinished) {
    if (workDirName.value !== null) {
      // Fetch project folder files again to see output files
      await fetchWorkFolder(workDirName.value)
    }
  }
});

function executeSelectedLocal() {
  executionFinished.value = false
  localExecutionInProgress.value = true
  executeSelected(true)
}

function executeSelectedRemote() {
  executionFinished.value = false
  remoteExecutionInProgress.value = true
  executeSelected(false)
}

function clearExecutionInProgress() {
  executionFinished.value = true
  localExecutionInProgress.value = false
  remoteExecutionInProgress.value = false
}

async function executeSelected(local) {
  if (execType.value === "") {
    notify.show("Please select execution Type", 1000, "info")
    clearExecutionInProgress()
    return
  }
  if (workDirName.value === null) {
    notify.show("Please select a project to execute", 5000, "info")
    return
  }
  notify.show(`Executing ${workDirName.value} ${execType.value}`, 2000, "info")
  const configs = {work_dir_name: workDirName.value, execution_type: execType.value, local_execution: local}
  const response = await postData("execute", configs, notify)
  if (!response.success) {
    clearExecutionInProgress()
    return
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  const jobId = response.data.job_id
  const streamUrl = `${API_BASE}api/stream/execute/${jobId}`;
  eventSource = new EventSource(streamUrl);
  eventSource.addEventListener("done", (event) => {
    if (event.data !== "0") {
      notify.show(`Executing project ${workDirName.value} failed`, 10000, "error")
      executionOutput.value.push("Execution failed");
    }
    console.log("Execution process exit code:", event.data);
    eventSource.close();
    eventSource = null;
    clearExecutionInProgress()
  });
  eventSource.addEventListener("error", (event) => {
    executionOutput.value.push(`[error event] ${event.data}`)
    eventSource.close();
    eventSource = null;
    clearExecutionInProgress()
  })
  eventSource.onmessage = (event) => {
    executionOutput.value.push(event.data)
  }
}
</script>

<template>
  <div class="mb-3 text-lg font-semibold text-gray-800">Execution [{{ workDirName }}]</div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

    <div class="col-span-1 space-y-3">

      <div class="flex gap-2">
      <BaseButton
        variant="secondary"
        @click="execType = 'all'"
        :class="execType === 'all' && 'ring-2 ring-blue-500'"
      >
        All
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'opt1'"
        :class="execType === 'opt1' && 'ring-2 ring-blue-500'"
      >
        Load data
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'opt2'"
        :class="execType === 'opt2' && 'ring-2 ring-blue-500'"
      >
        Run model
      </BaseButton>
      </div>

      <div class="flex gap-2">
      <button
          class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          :disabled="!execType"
          @click="executeSelectedLocal">
        <i v-if="localExecutionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute (Local)</span>
      </button>
      <button
          class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          :disabled="!execType"
          @click="executeSelectedRemote">
        <i v-if="remoteExecutionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute (Remote)</span>
      </button>
      </div>
    </div>

    <div class="relative col-span-2 bg-gray-900 text-gray-100 p-4 rounded overflow-y-auto h-80 max-h-96 font-mono text-sm shadow-inner">
      <!-- Clear button -->
      <button
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 bg-transparent"
          @click="executionOutput = []"
          aria-label="Clear output">
        ✕
      </button>
      <div v-for="(line, index) in executionOutput" :key="index" class="whitespace-pre-wrap">
        {{ line }}
      </div>
    </div>
  </div>
</template>
