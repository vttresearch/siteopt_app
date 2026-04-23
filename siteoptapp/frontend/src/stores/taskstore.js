import { ref } from "vue";
import { defineStore } from "pinia"

export const useTaskStore = defineStore("taskData", () => {

  const currentTask = ref("")
  const currentSubtask = ref("")  // Unused
  const subtasksPending = ref([])  // Unused
  const subtasksDone = ref(0)  // Unused
  const tasks = ref(makeDefaultTasks())

  function reset() {
    currentTask.value = ""
    currentSubtask.value = ""
    subtasksPending.value = []
    subtasksDone.value = 0
    tasks.value = makeDefaultTasks()
  }

  function setCurrentTask(taskName) {
    currentTask.value = taskName
  }

  /* Attempt to guess the current project item that's been executed.
  * Not working properly and unused at the moment.
  */
  function getNextSubtask() {
    if (subtasksPending.value.length > 0) {
      currentSubtask.value = subtasksPending.value.shift()
    }
    else currentSubtask.value = ""
  }

  function setSubtasksPending(taskName) {
    const task = tasks.value.find(t => t.name === currentTask.value);
    subtasksPending.value = task.subtasks.map((t) => t.name)
  }

  function markSubtaskDone(subtaskName) {
    const task = tasks.value.find(t => t.name === currentTask.value);
    if (!task) return;
    const subtask = task.subtasks.find(s => s.name === subtaskName);
    if (!subtask) return;
    subtask.done = true;
  }

  function markSubtaskFailed(subtaskName) {
    const task = tasks.value.find(t => t.name === currentTask.value);
    if (!task) return;
    const subtask = task.subtasks.find(s => s.name === subtaskName);
    if (!subtask) return;
    subtask.error = true;
  }

  /* Clears done and error for all subtasks in current task. */
  function clearSubtasks() {
    const task = tasks.value.find(t => t.name === currentTask.value);
    if (!task) return;
    task.elapsed = 0  // Reset timer
    task.subtasks.forEach(st => {
      st.done = false
      st.error = false
    });
  }

  /* Clears done and error for all subtasks in all tasks. */
  function clearAll() {
    currentTask.value = ""
    tasks.value.forEach(task => {
      task.elapsed = 0
      task.subtasks.forEach(st => {
        st.done = false;
        st.error = false;
      });
    });
  }

  /* Increments the elapsed time of the current task by one. */
  function incrementTimer() {
    const task = tasks.value.find(t => t.name === currentTask.value);
    if (!task) return;
    task.elapsed++
  }

  function makeDefaultTasks() {
    return [
    {
      name: "Prepare input data",
      elapsed: 0,
      subtasks: [
          { name: "connections input", done: false, error: false },
          { name: "diverting units", done: false, error: false },
          { name: "storage input data", done: false, error: false },
          { name: "nodes", done: false, error: false },
          { name: "pv unit input", done: false, error: false },
          { name: "model specification", done: false, error: false },
          { name: "hp units input", done: false, error: false },
          { name: "Existing load", done: false, error: false },
          { name: "scenarios", done: false, error: false },
          { name: "Additional template", done: false, error: false },
          { name: "Load mytemplate", done: false, error: false },
          { name: "convert connections", done: false, error: false },
          { name: "Load template", done: false, error: false },
          { name: "convert diverting units (1)", done: false, error: false },
          { name: "convert storages", done: false, error: false },
          { name: "convert nodes", done: false, error: false },
          { name: "convert VRE units", done: false, error: false },
          { name: "convert hp units", done: false, error: false },
          { name: "model spec importer", done: false, error: false },
          { name: "import object parameters wide", done: false, error: false },
          { name: "scenario importer", done: false, error: false },
          { name: "Input data", done: false, error: false },
          { name: "Copy DB", done: false, error: false },
          { name: "input with repr periods", done: false, error: false },
      ]
    },
    {
      name: "Optimize full period",
      elapsed: 0,
      subtasks: [
          { name: "Input data", done: false, error: false },
          { name: "Copy DB", done: false, error: false },
          { name: "input with repr periods", done: false, error: false },
          { name: "Optimize", done: false, error: false },
          { name: "output db", done: false, error: false },
          { name: "Output recipe", done: false, error: false },
          { name: "Extract results", done: false, error: false },
      ]
    },
    {
      name: "Optimize with representative periods",
      elapsed: 0,
      subtasks: [
          { name: "Input data", done: false, error: false },
          { name: "repr periods template", done: false, error: false },
          { name: "repr period selection settings", done: false, error: false },
          { name: "Select repr periods", done: false, error: false },
          { name: "input with repr periods", done: false, error: false },
          { name: "Optimize", done: false, error: false },
          { name: "output db", done: false, error: false },
          { name: "Output recipe", done: false, error: false },
          { name: "Extract results", done: false, error: false },
      ]
    },
    /*
    {
      name: "Complete workflow",
      elapsed: 0,
      subtasks: [
          { name: "connections input", done: false, error: false },
          { name: "diverting units", done: false, error: false },
          { name: "storage input data", done: false, error: false },
          { name: "nodes", done: false, error: false },
          { name: "pv unit input", done: false, error: false },
          { name: "model specification", done: false, error: false },
          { name: "hp units input", done: false, error: false },
          { name: "Existing load", done: false, error: false },
          { name: "scenarios", done: false, error: false },
          { name: "Additional template", done: false, error: false },
          { name: "Load mytemplate", done: false, error: false },
          { name: "convert connections", done: false, error: false },
          { name: "Load template", done: false, error: false },
          { name: "convert diverting units (1)", done: false, error: false },
          { name: "convert storages", done: false, error: false },
          { name: "convert nodes", done: false, error: false },
          { name: "convert VRE units", done: false, error: false },
          { name: "convert hp units", done: false, error: false },
          { name: "model spec importer", done: false, error: false },
          { name: "import object parameters wide", done: false, error: false },
          { name: "scenario importer", done: false, error: false },
          { name: "Input data", done: false, error: false },
          { name: "Copy DB", done: false, error: false },
          { name: "input with repr periods", done: false, error: false },
          { name: "repr periods template", done: false, error: false },
          { name: "repr period selection settings", done: false, error: false },
          { name: "Select repr periods", done: false, error: false },
          { name: "input with repr periods", done: false, error: false },
          { name: "Optimize", done: false, error: false },
          { name: "output db", done: false, error: false },
          { name: "Output recipe", done: false, error: false },
          { name: "Extract results", done: false, error: false },
      ]
    },
    */
    ]
  }

  return {
    currentTask,
    tasks,
    setSubtasksPending,
    reset,
    setCurrentTask,
    markSubtaskDone,
    markSubtaskFailed,
    clearSubtasks,
    clearAll,
    incrementTimer,
  }
})
