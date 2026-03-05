<script setup>
import { ref, onUnmounted, watch, computed, nextTick } from 'vue';
import AnsiToHtml from "ansi-to-html"
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { postData, fetchWorkFolder } from "@/utils/functions.js";
import { API_BASE } from "@/config.js";
import BaseButton from "@/components/ui/BaseButton.vue";
import AskNamePrompt from "@/components/AskNamePrompt.vue";
import ConfirmPrompt from "@/components/ConfirmPrompt.vue";


const notify = useNotificationStore()
const settingStore = useSettingStore()
const execType = ref("")
const executionOutput = ref([])
const executionFinished = ref(false)
const localExecutionInProgress = ref(false)
const remoteExecutionInProgress = ref(false)
const refreshingScenarios = ref(false)
let eventSource = null
const converter = new AnsiToHtml();
const outputEl = ref(null)
const selectedScenarios = ref([])
let shouldAutoScroll = true
const execTypes = {
  "all": "Complete workflow",
  "opt1": "Prepare input data",
  "opt2": "Optimize full period",
  "opt3": "Optimize with representative periods",
  "opt4": "Purge output Db",
  }
const scenarios = ref([])
const showAddScenarioPrompt = ref(false)
const confirmOpen = ref(false)
const itemToRemove = ref(null)
const confirmMessage = ref("")
const returnFocusEl = ref(null)

/* Refreshes file tree when user selects a project */
watch(() => settingStore.activeProjectIndex, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    refreshScenarios()
    selectedScenarios.value = []
    execType.value = ""
  }
})


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

const coloredOutput = computed(() => {
  return executionOutput.value.map(line => converter.toHtml(line))
})

/* Returns true when user has scrolled the output log to the bottom, return false otherwise */
function handleScroll() {
  const el = outputEl.value
  if (!el) return
  const threshold = 80 // px tolerance
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  shouldAutoScroll = atBottom
}

/* Smooth auto-scroll when new text appears and the user is scrolled to the bottom of the log */
watch(coloredOutput, async () => {
  await nextTick()
  if (shouldAutoScroll && outputEl.value) {
    outputEl.value.scrollTo({
      top: outputEl.value.scrollHeight,
      behavior: 'smooth'
    })
  }
})

watch(executionFinished, async (newExecutionFinished) => {
  if (newExecutionFinished) {
    console.log("Execution finished")
    if (workDirName.value !== null) {
      // Fetch project folder files again to see output files
      await fetchWorkFolder(workDirName.value)
    }
  }
});

function newScenarioNameIsValid(name) {
  for (let i=0; i<scenarios.value.length; i++) {
    if (scenarios.value[i].toLowerCase() === name.toLowerCase()) {
      notify.show(`Scenario ${name} already exists`, 5000, "error")
      return false
    }
  }
  // Check invalid characters
  const scenarioNameRegex = /^(\/?[a-z0-9A-Z\-]+)+$/  // No special characters allowed
  if (!scenarioNameRegex.test(name)) {
    notify.show(`Scenario ${name} contains invalid characters`, 5000, "error")
    return false
  }
  return true
}

async function refreshScenarios() {
  refreshingScenarios.value = true
  const configs = {db_key: "scenario", work_folder: workDirName.value}
  const response = await postData("fetch_input_db_data", configs, notify)
  if (!response.success) {
    console.error("fetching input db data failed")
    refreshingScenarios.value = false
    return
  }
  scenarios.value = response.data.scenarios
  refreshingScenarios.value = false
}

async function confirmAddScenario(n) {
  showAddScenarioPrompt.value = false
  let name = n.trim()
  if (name === "") {
    return  // Clicked Ok with no name given
  }
  if (!newScenarioNameIsValid(name)) {
    return false
  }
  console.log(`Adding scenario '${name}'`)
  refreshingScenarios.value = true
  const configs = {scenario_name: name, work_folder: workDirName.value}
  const response = await postData("add_scenario", configs, notify)
  if (!response.success) {
    console.error("Adding scenario failed")
    refreshingScenarios.value = false
    return
  }
  await refreshScenarios()
}

function cancelAddScenario() {
  showAddScenarioPrompt.value = false
}

function askRemoveScenario(scenario, triggerEl) {
  itemToRemove.value = scenario
  confirmMessage.value = `Are you sure you want to remove scenario ${scenario}? This cannot be undone.`
  returnFocusEl.value = triggerEl  // so focus returns to the clicked trash icon
  confirmOpen.value = true
}

async function confirmRemoveScenario() {
  if (!itemToRemove.value) {
    // user clicked cancel
    console.log("Removing scenario cancelled")
    return
  }
  console.log("Removing scenario:", itemToRemove.value)
  selectedScenarios.value = selectedScenarios.value.filter(s => s !== itemToRemove.value)
  refreshingScenarios.value = true
  const configs = {scenario_name: itemToRemove.value, work_folder: workDirName.value}
  const response = await postData("remove_scenario", configs, notify)
  if (!response.success) {
    console.error("Removing scenario failed")
    refreshingScenarios.value = false
    itemToRemove.value = null
    return
  }
  await refreshScenarios()
  itemToRemove.value = null
}

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

/* Returns true if selected execution type should have at least one scenario selected, false otherwise. */
function execTypeNeedsScenario() {
  return execType.value === "all" || execType.value === "opt2" || execType.value === "opt3"
}

async function executeSelected(local) {
  if (execType.value === "") {
    notify.show("Please select execution Type", 1000, "info")
    clearExecutionInProgress()
    return
  }
  if (workDirName.value === null) {
    notify.show("Please select a project to execute", 5000, "info")
    clearExecutionInProgress()
    return
  }
  if (execTypeNeedsScenario() && selectedScenarios.value.length === 0) {
    notify.show("Please select scenario(s) to execute", 5000, "info")
    clearExecutionInProgress()
    return
  }
  notify.show(`Executing ${execTypes[execType.value]} for project ${workDirName.value}`, 5000, "info")
  const configs = {
    work_dir_name: workDirName.value,
    execution_type: execType.value,
    local_execution: local,
    scenarios: selectedScenarios.value
  }
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
  <div>

    <!-- Execution types -->
    <span class="text-gray-800 italic">Execution type</span>
    <div class="flex flex-wrap justify-start items-center gap-4 p-4">
      <BaseButton
        variant="secondary"
        @click="execType = 'opt1'"
        :class="execType === 'opt1' && 'ring-2 ring-blue-500'"
      >
        {{ execTypes["opt1"] }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'opt2'"
        :class="execType === 'opt2' && 'ring-2 ring-blue-500'"
      >
        {{ execTypes["opt2"] }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'opt3'"
        :class="execType === 'opt3' && 'ring-2 ring-blue-500'"
      >
        {{ execTypes["opt3"] }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'all'"
        :class="execType === 'all' && 'ring-2 ring-blue-500'"
      >
        {{ execTypes["all"] }}
      </BaseButton>
      <BaseButton
        variant="secondary"
        @click="execType = 'opt4'"
        :class="execType === 'opt4' && 'ring-2 ring-blue-500'"
      >
        {{ execTypes["opt4"] }}
      </BaseButton>
    </div>

    <!-- Scenarios -->
    <div>
      <div class="flex justify-start items-center gap-8">
        <span class="pr-4 text-gray-800 italic">Scenarios</span>
        <button
            class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
            type="button"
            :disabled="refreshingScenarios"
            @click="showAddScenarioPrompt = true">
          <i v-if="refreshingScenarios" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
          <i v-else class="fa-solid fa-square-plus"></i>
          <span>Add Scenario</span>
        </button>
      </div>

      <div class="flex flex-wrap justify-start items-center gap-4 p-4">
        <template v-if="refreshingScenarios">
          <div>Loading scenarios...</div>
        </template>
        <template v-else-if="scenarios.length === 0">
          <span>No scenarios found. Load default scenarios by running <i>Prepare input data</i>.</span>
        </template>
        <template v-else>
            <div v-for="(scenario, i) in scenarios"
                 :key="scenario"
                 class="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md px-2">
              <input
                  type="checkbox"
                  :id="`scenario-${i}`"
                  name="scenario"
                  :value="scenario"
                  v-model="selectedScenarios" />
              <label class=px-2 :for="`scenario-${i}`">{{ scenario }}</label>
              <button v-if="scenario.toLowerCase()!=='base'"
                  class="text-gray-400 hover:text-gray-700"
                  type="button"
                  @click="askRemoveScenario(scenario, $event.currentTarget)">
                <i class="fa-regular fa-trash-can"></i>
              </button>
            </div>
        </template>
      </div>

      <ConfirmPrompt
          v-model="confirmOpen"
          :title="'Remove scenario?'"
          :message="confirmMessage"
          :confirmText="'Remove'"
          :cancelText="'Cancel'"
          :returnFocusEl="returnFocusEl"
          @confirm="confirmRemoveScenario"
      />
      <AskNamePrompt
          :visible="showAddScenarioPrompt"
          title="Add New Scenario"
          message="Scenario name"
          placeholderText="Enter scenario name…"
          @confirm="confirmAddScenario"
          @cancel="cancelAddScenario"
      />
    </div>

    <!-- Execute buttons -->
    <div class="flex justify-start gap-4 pb-4">
      <button
          class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          type="button"
          :disabled="!execType"
          @click="executeSelectedLocal">
        <i v-if="localExecutionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute (Local)</span>
      </button>
      <button
          class="flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          type="button"
          :disabled="!execType"
          @click="executeSelectedRemote">
        <i v-if="remoteExecutionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute (Remote)</span>
      </button>
    </div>
  </div>

  <!-- Execution log -->
  <div
      class="relative bg-gray-900 text-gray-100 p-4 rounded overflow-y-auto h-80 max-h-96 font-mono text-sm shadow-inner"
      ref="outputEl"
      @scroll="handleScroll">
    <!-- Clear button -->
    <button
        class="sticky top-1 z-10 ml-auto block text-gray-300 hover:text-gray-100 bg-transparent"
        type="button"
        @click="executionOutput = []"
        aria-label="Clear output"
        title="Clear output">
      ✕
    </button>
    <div v-for="(line, index) in coloredOutput" :key="index" v-html="line" class="whitespace-pre-wrap"></div>
  </div>
</template>
