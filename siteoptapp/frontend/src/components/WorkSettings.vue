<script setup>
import { ref, onUnmounted } from 'vue';
import { useNotificationStore } from "@/stores/notificationstore.js";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { postExecuteRequest } from "@/utils/functions.js";
import { API_BASE } from "@/config.js";
import BaseButton from "@/components/ui/BaseButton.vue";


const props = defineProps({
  workDirName: String
})

const notify = useNotificationStore();
const execType = ref("");
const executionOutput = ref([]);
let eventSource = null;

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
})

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
  // TODO: Refetch work dirs
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
        @click="execType = 'opt1'"
        :class="execType === 'opt1' && 'ring-2 ring-blue-500'"
      >
        Option 1
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'opt2'"
        :class="execType === 'opt2' && 'ring-2 ring-blue-500'"
      >
        Option 2
      </BaseButton>
      </div>
      <BaseButton
        :disabled="!execType"
        @click="executeSelected"
        class="flex items-center gap-2"
      >
        <font-awesome-icon icon="fa-solid fa-play" fixed-width />
        <span>Execute</span>
      </BaseButton>
    </div>

    <div class="col-span-2 bg-gray-900 text-gray-100 p-4 rounded overflow-y-auto h-80 max-h-96 font-mono text-sm shadow-inner">
      <div v-for="(line, index) in executionOutput" :key="index" class="whitespace-pre-wrap">
        {{ line }}
      </div>
    </div>

  </div>
</template>

