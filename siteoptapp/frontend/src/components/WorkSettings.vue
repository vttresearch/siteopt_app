<script setup>
import { ref, onUnmounted, watch } from 'vue';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { postExecuteRequest } from "@/utils/functions.js";
import { API_BASE } from "@/config.js";


const props = defineProps({
  workDirName: String
})

const notify = useNotificationStore();
const execType = ref("");
const executionOutput = ref([]);
const executionFinished = ref(false);
let eventSource = null;

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
})

watch(executionFinished, (newExecutionFinished) => {
  if (executionFinished.value) {
    // Refetch props.workDirName contents
  }
  executionFinished.value = false
});

async function executeSelected() {
  console.log("executeSelected() called")
  if (execType.value === "") {
    notify.show("Please select execution Type", 1000, "info")
    return
  }
  notify.show(`Executing ${props.workDirName} ${execType.value}`, 2000, "info")
  const configs = [props.workDirName, execType.value]
  const jobId = await postExecuteRequest("execute", configs, notify)
  if (!jobId) {
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
  });
  eventSource.onmessage = (event) => {
    executionOutput.value.push(event.data)
  }
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="col-span-1">
    <!-- Execution Type Selection -->
    <div class="flex space-x-4 items-center">
      <label class="flex items-center space-x-2">
        <input type="radio" value="One" v-model="execType" />
        <span>Type 1</span>
      </label>
      <label class="flex items-center space-x-2">
        <input type="radio" value="Two" v-model="execType" />
        <span>Type 2</span>
      </label>
    </div>
    <!-- Execute Button -->
    <button
        class="mt-1 px-2 py-1 bg-blue-500 hover:bg-blue-700 text-white rounded shadow flex items-center space-x-2"
        @click="executeSelected"
    >
      <font-awesome-icon icon="fa-solid fa-play" fixed-width />
      <span>Execute</span>
    </button>
    </div>
    <!-- Execution Output -->
    <div class="col-span-2 bg-gray-900 text-gray-100 p-4 rounded overflow-y-auto h-80 max-h-96 font-mono text-sm shadow-inner">
      <div v-for="(line, index) in executionOutput" :key="index" class="whitespace-pre-wrap">
        {{ line }}
      </div>
    </div>
  </div>
</template>
