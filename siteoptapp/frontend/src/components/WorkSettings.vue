<script setup>
import { ref, onUnmounted, watch } from 'vue';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postExecuteRequest } from "@/utils/functions.js";
import { API_BASE } from "@/config.js";
import BaseButton from "@/components/ui/BaseButton.vue";


const props = defineProps({
  workDirName: String
})

const notify = useNotificationStore()
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

watch(executionFinished, (newExecutionFinished) => {
  if (executionFinished.value) {
    // TODO: Refetch props.workDirName contents
  }
  executionFinished.value = false
});

function executeSelectedLocal() {
  localExecutionInProgress.value = true
  executeSelected(true)
}

function executeSelectedRemote() {
  remoteExecutionInProgress.value = true
  executeSelected(false)
}

function clearExecutionInProgress() {
  localExecutionInProgress.value = false
  remoteExecutionInProgress.value = false
}

async function executeSelected(local) {
  console.log("executeSelected() called")
  if (execType.value === "") {
    notify.show("Please select execution Type", 1000, "info")
    clearExecutionInProgress()
    return
  }
  notify.show(`Executing ${props.workDirName} ${execType.value} local:${local}`, 2000, "info")
  const configs = [props.workDirName, execType.value, local]
  const jobId = await postExecuteRequest("execute", configs, notify)
  if (!jobId) {
    clearExecutionInProgress()
    return
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  console.log(`Got job_id:${jobId}`)
  const streamUrl = `${API_BASE}api/stream/execute/${jobId}`;
  eventSource = new EventSource(streamUrl);
  eventSource.addEventListener("done", (event) => {
    console.log("Final message:", event.data);
    executionOutput.value.push(`[done] ${event.data}`);
    eventSource.close();
    eventSource = null;
    executionFinished.value = true;
    clearExecutionInProgress()
  });
  eventSource.onmessage = (event) => {
    executionOutput.value.push(event.data)
  }
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

    <div class="col-span-1 space-y-3">

      <div class="text-black text-base mb-2 font-bold">
        Execution
      </div>

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
        @click="executeSelectedLocal"
      >
        <i v-if="localExecutionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute (Local)</span>
      </button>
      <button
        class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
        :disabled="!execType"
        @click="executeSelectedRemote"
      >
        <i v-if="remoteExecutionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute (Remote)</span>
      </button>
      </div>

    </div>

    <div class="col-span-2 bg-gray-900 text-gray-100 p-4 rounded overflow-y-auto h-80 max-h-96 font-mono text-sm shadow-inner">
      <div v-for="(line, index) in executionOutput" :key="index" class="whitespace-pre-wrap">
        {{ line }}
      </div>
    </div>

  </div>
</template>

