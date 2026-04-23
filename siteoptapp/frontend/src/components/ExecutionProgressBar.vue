<script setup>
import { ref, computed, watch } from "vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useTaskStore } from "@/stores/taskstore.js";
import BaseButton from "@/components/ui/BaseButton.vue";

const settingStore = useSettingStore()
const taskStore = useTaskStore()
const showDetails = ref(false)

// All subtasks in current task
const allSubtasks = computed(() => {
  if (!taskStore.currentTask) return [];
  const currentTask = taskStore.tasks.filter((task) => task.name === taskStore.currentTask)
  return currentTask.flatMap(t => t.subtasks)
});

// Completed (non-error) subtasks
const completedSubtasks = computed(() =>
  allSubtasks.value.filter(st => st.done && !st.error).length
);

// Error exists
const hasError = computed(() =>
  allSubtasks.value.some(st => st.error)
);

// Percent
const percentage = computed(() => {
  const total = allSubtasks.value.length;
  if (total === 0) return 0;
  return Math.round((completedSubtasks.value / total) * 100);
});

const currentElapsed = computed(() => {
  const task = taskStore.tasks.find(t => t.name === taskStore.currentTask);
  if (!task) return 0;
  return task.elapsed
})

/* Closes Details... panel when active project changes */
watch(() => settingStore.activeProjectIndex, async (newVal, oldVal)=> {
  if (newVal !== oldVal) {
    showDetails.value = false
  }
})

</script>

<template>
  <div class="w-full space-y-2 font-sans pb-5">

    <div class="border-1 rounded-md border-gray-300 p-2">
    <!-- Labels -->
    <div class="space-y-1">
      <div v-if="hasError" class="text-red-600 font-semibold">
        One or more subtasks failed. See Log for details.
      </div>
    </div>

    <!-- Progress bar wrapper -->
    <div class="w-full h-4 bg-gray-300 rounded-md overflow-hidden relative">
      <!-- Progress bar -->
      <div
        class="h-full transition-all duration-300"
        :class="{
          'bg-green-500': !hasError,
          'bg-red-500': hasError
        }"
        :style="{ width: percentage + '%' }"
      ></div>
    </div>

    <!-- Task name and Percentage -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-800">
        <b>Task:</b> {{ taskStore.currentTask }}
      </div>
      <div class="text-sm text-gray-800">
        Time: {{ Math.floor(currentElapsed / 60) }}m {{ currentElapsed % 60 }}s
      </div>
      <div class="font-bold text-sm text-gray-800">
        Completed ({{ completedSubtasks }}/{{ allSubtasks.length }}) {{ percentage }}%
      </div>
    </div>
      <div class="flex items-center justify-between">
        <div v-if="!taskStore.currentTask" class="text-sm text-gray-600">
          Select a task
        </div>
        <div v-else class="text-sm text-gray-600">
          <div v-if="taskStore.currentTask === 'Prepare input data'">
            Estimated time: 3-6 minutes
          </div>
          <div v-else-if="taskStore.currentTask === 'Optimize full period'">
            Estimated time: 4+ hours
          </div>
          <div v-else-if="taskStore.currentTask === 'Optimize with representative periods'">
            Estimated time: 8-15 minutes
          </div>
        </div>
    <button
        class="my-2 p-1 cursor-pointer border rounded-md border-gray-200 text-white bg-blue-500 hover:bg-blue-700"
        @click="showDetails = !showDetails"
    >
      Details...
    </button>
      </div>
    <div class="relative">
      <div v-if="showDetails" class="absolute top-0 left-0 w-full z-50 border border-gray-300 rounded p-3 bg-gray-50 shadow-xl">
        <div class="flex items-center justify-between mb-2">
          <div class="font-semibold text-gray-800">Subtasks for {{ taskStore.currentTask }}</div>
          <BaseButton variant="ghost" @click="showDetails = false">Close</BaseButton>
        </div>

        <div v-if="allSubtasks.length === 0" class="text-sm text-gray-600">
          No Execution in progress.
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <div v-for="c in allSubtasks"
               :key="c.name"
               class="px-3 py-1 flex justify-between items-center bg-gray-100 text-gray-800 hover:bg-gray-200">
            <div class="font-medium">{{ c.name }}</div>
            <div v-if="c.done">
              <i class="fa-regular fa-square-check text-green-600"></i>
            </div>
            <div v-else-if="c.error">
              <i class="fa-solid fa-square-xmark text-red-500"></i>
            </div>
            <div v-else>
              <i class="fa-regular fa-square"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
          </div>

  </div>
</template>