<script setup>
import { ref, computed } from "vue";
import { useTaskStore } from "@/stores/taskstore.js";
import BaseButton from "@/components/ui/BaseButton.vue";

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

</script>

<template>
  <div class="w-full space-y-2 font-sans pb-5">

    <!-- Labels -->
    <div class="space-y-1">
      <div v-if="hasError" class="text-red-600 font-semibold">
        Error detected — one or more subtasks failed
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
      <div class="font-bold text-sm text-gray-800">
        Completed ({{ completedSubtasks }}/{{ allSubtasks.length }}) {{ percentage }}%
      </div>
    </div>
    <button
        class="cursor-pointer border rounded-md border-gray-200 bg-black text-white p-1 hover:bg-gray-600"
        @click="showDetails = !showDetails"
    >
      Details...
    </button>
    <div class="relative">
      <div v-if="showDetails" class="absolute top-0 left-0 w-full z-50 border border-gray-300 rounded p-3 bg-gray-50 shadow-xl">
        <div class="flex items-center justify-between mb-2">
          <div class="font-semibold text-gray-800">Project items</div>
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
            <div v-if="c.done !== c.error">
              <i class="fa-regular fa-square-check text-green-600"></i>
            </div>
            <div v-else-if="c.error">
              <i class="fa-regular fa-circle-xmark text-black"></i>
            </div>
            <div v-else>
              <i class="fa-regular fa-square"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>