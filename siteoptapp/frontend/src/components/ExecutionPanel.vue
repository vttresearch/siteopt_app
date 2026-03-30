<script setup>
import { ref, onUnmounted, watch, computed, nextTick } from 'vue';
import AnsiToHtml from "ansi-to-html"
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useSettingStore } from "@/stores/settingstore.js";
import { useTaskStore } from "@/stores/taskstore.js";
import { useScenarioStore } from "@/stores/scenariostore.js";
import { postData, fetchResults, fetchScenarios } from "@/utils/functions.js";
import { API_BASE } from "@/config.js";
import BaseButton from "@/components/ui/BaseButton.vue";
import AskNamePrompt from "@/components/AskNamePrompt.vue";
import ConfirmPrompt from "@/components/ConfirmPrompt.vue";
import ExecutionProgressBar from "@/components/ExecutionProgressBar.vue";

const notify = useNotificationStore()
const settingStore = useSettingStore()
const taskStore = useTaskStore()
const scenarioStore = useScenarioStore()
const execType = ref("")
const executionOutput = ref([])
const executionFinished = ref(false)
const executionInProgress = ref(false)
const converter = new AnsiToHtml();
const outputEl = ref(null)
const selectedScenarios = ref([])
const showAddScenarioPrompt = ref(false)
const confirmOpen = ref(false)
const itemToRemove = ref(null)
const confirmMessage = ref("")
const returnFocusEl = ref(null)
const showLog = ref(true)
let eventSource = null
let shouldAutoScroll = true

/* Refreshes scenarios when the selected project changes */
watch(() => settingStore.activeProjectIndex, async (newVal, oldVal)=> {
  if (newVal !== oldVal) {
    await fetchScenarios(settingStore.activeProjectPath)
    selectedScenarios.value = []
    execType.value = ""
  }
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
})

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
    // TODO: Fix case if user changes the project while execution is in progress
    await fetchResults(settingStore.activeProjectName)
    await fetchScenarios(settingStore.activeProjectPath)
  }
});

function newScenarioNameIsValid(name) {
  for (let i=0; i<scenarioStore.scenarios.length; i++) {
    if (scenarioStore.scenarios[i].toLowerCase() === name.toLowerCase()) {
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
  scenarioStore.loadingScenarios = true
  const configs = {scenario_name: name, work_folder: settingStore.activeProjectPath}
  const response = await postData("add_scenario", configs, notify)
  if (!response.success) {
    console.error("Adding scenario failed")
    scenarioStore.loadingScenarios = false
    return
  }
  await fetchScenarios(settingStore.activeProjectPath)
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
  scenarioStore.loadingScenarios = true
  const configs = {scenario_name: itemToRemove.value, work_folder: settingStore.activeProjectPath}
  const response = await postData("remove_scenario", configs, notify)
  if (!response.success) {
    console.error("Removing scenario failed")
    scenarioStore.loadingScenarios = false
    itemToRemove.value = null
    return
  }
  await fetchScenarios(settingStore.activeProjectPath)
  itemToRemove.value = null
}

function clearExecutionInProgress() {
  executionInProgress.value = false
  executionFinished.value = true
}

function clearProgressBar() {
  taskStore.subtasksDone = 0
  taskStore.clearSubtasks()
}
/* Returns true if selected execution task should have at least one scenario selected, false otherwise. */
function execTypeNeedsScenario() {
  return execType.value === "Optimize full period" ||
      execType.value === "Optimize with representative periods" ||
      execType.value === "Complete workflow"
}

async function executeSelected() {
  executionInProgress.value = true
  executionFinished.value = false
  taskStore.setCurrentTask(execType.value)
  if (execType.value === "") {
    notify.show("Please select a Task to execute", 1000, "info")
    clearExecutionInProgress()
    return
  }
  if (execTypeNeedsScenario() && selectedScenarios.value.length === 0) {
    notify.show("Please select scenario(s) to execute", 5000, "info")
    clearExecutionInProgress()
    return
  }
  notify.show(`Running task ${execType.value} for project ${settingStore.activeProjectName}`, 5000, "info")
  // Clear progress bar
  clearProgressBar()
  // Get an Array of project item names to execute
  const executionTask = taskStore.tasks.filter((task) => task.name === execType.value)
  const projectItems = executionTask[0].subtasks.map((subtask) => subtask.name)
  // local_execution is hard-coded to true until it's implemented
  const configs = {
    work_dir_name: settingStore.activeProjectName,
    executed_items: projectItems,
    local_execution: true,
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
      notify.show(`Executing project ${settingStore.activeProjectName} failed`, 10000, "error")
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
  });
  eventSource.addEventListener("item_finished", (event) => {
    // This listener removes the 'Execution ... finished' message from the execution log
    let finishedSubtask = event.data
    taskStore.markSubtaskDone(finishedSubtask)
  });
  eventSource.onmessage = (event) => {
    executionOutput.value.push(event.data)
  };
}

function setCurrentTask(taskName) {
  execType.value = taskName
  taskStore.setCurrentTask(taskName)
  taskStore.setSubtasksPending(taskName)
}
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="mb-3 text-lg font-semibold text-gray-800">Execution</div>
    <button
        class="flex items-center gap-1 justify-center text-white rounded-md disabled:opacity-50 px-2 py-3 cursor-pointer"
        type="button"
        title="Recent projects"
        @click="showLog = !showLog"
        :class="showLog ? 'bg-blue-500 hover:bg-blue-700 shadow-lg' : 'bg-gray-500 hover:bg-gray-700'">
      <i class="fa-solid fa-file-lines"></i>
    </button>
  </div>

  <div>
    <!-- Task selection buttons -->
    <span class="text-gray-800 italic">Task to execute</span>
    <div class="flex flex-wrap justify-start items-center gap-4 p-4">
      <BaseButton
          v-for="task in taskStore.tasks"
          variant="secondary"
          @click="setCurrentTask(task.name)"
          :class="execType === task.name && 'ring-2 ring-blue-500'"
      >
        {{ task.name }}
      </BaseButton>
    </div>

    <!-- Scenarios -->
    <div>
      <div class="flex justify-start items-center gap-8">
        <span class="pr-4 text-gray-800 italic">Scenarios</span>
        <button
            class="cursor-pointer flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
            type="button"
            :disabled="scenarioStore.loadingScenarios"
            @click="showAddScenarioPrompt = true">
          <i v-if="scenarioStore.loadingScenarios" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
          <i v-else class="fa-solid fa-square-plus"></i>
          <span>Add Scenario</span>
        </button>
      </div>

      <div class="flex flex-wrap justify-start items-center gap-4 p-4">
        <template v-if="scenarioStore.loadingScenarios">
          <div>Loading scenarios...</div>
        </template>
        <template v-else-if="scenarioStore.scenarios.length === 0">
          <span>No scenarios found. Load default scenarios by running <i>Prepare input data</i>.</span>
        </template>
        <template v-else>
            <div v-for="(scenario, i) in scenarioStore.scenarios"
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

    <!-- Execute button -->
    <div class="flex justify-start gap-4 pb-4">
      <button
          class="cursor-pointer flex items-center gap-1 justify-center text-white bg-blue-500 hover:bg-blue-700 rounded-md px-3 py-2 disabled:opacity-50"
          type="button"
          :disabled="!execType || executionInProgress"
          title="Select a task to execute"
          @click="executeSelected">
        <i v-if="executionInProgress" class="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></i>
        <i v-else class="fa-solid fa-play"></i>
        <span class="text-nowrap">Execute</span>
      </button>
    </div>
    <ExecutionProgressBar />
  </div>

  <!-- Execution log -->
  <div v-if="showLog"
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
