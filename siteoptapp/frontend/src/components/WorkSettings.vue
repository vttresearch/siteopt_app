<script setup>
import { ref, onUnmounted, watch } from 'vue';
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
const execMode = ref("remote");
const remoteHost = ref("127.0.0.1");
const remotePort = ref("49152");
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
  const configs = {
    workDirName: props.workDirName,
    execType: execType.value,
    mode: execMode.value,
    host: remoteHost.value,
    port: remotePort.value,
  }
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
  eventSource.onerror = (event) => {
    console.error("Execution stream error:", event);
    executionOutput.value.push("[error] Execution stream error. Check backend logs.");
  };
  eventSource.onmessage = (event) => {
    console.log("Execution output:", event.data);
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

      <div class="mt-4">
        <div class="text-black text-sm mb-2 font-semibold">Execution Mode</div>
        <div class="flex gap-2">
          <BaseButton
            variant="secondary"
            @click="execMode = 'local'"
            :class="execMode === 'local' && 'ring-2 ring-blue-500'"
          >
            Local
          </BaseButton>
          <BaseButton
            variant="secondary"
            @click="execMode = 'remote'"
            :class="execMode === 'remote' && 'ring-2 ring-blue-500'"
          >
            Remote
          </BaseButton>
        </div>

        <div v-if="execMode === 'remote'" class="mt-3 space-y-2">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-600">Server Host</label>
            <input
              v-model="remoteHost"
              type="text"
              class="px-2 py-1 border rounded text-sm"
              placeholder="127.0.0.1"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-gray-600">Server Port</label>
            <input
              v-model="remotePort"
              type="text"
              class="px-2 py-1 border rounded text-sm"
              placeholder="49152"
            />
          </div>
        </div>
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

