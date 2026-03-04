<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  visible: { type: Boolean, default: false },
});

const emit = defineEmits(["confirm", "cancel"]);

const name = ref("");
const inputEl = ref(null);

// Reset and autofocus when opened
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      name.value = "";
      await nextTick();
      inputEl.value?.focus();
    }
  },
  { immediate: true }
);

function confirm() {
  // Return trimmed value; empty string is allowed if user confirms with nothing
  emit("confirm", name.value.trim());
}

function cancel() {
  emit("cancel", null);
}
</script>


<template>
  <div
    v-if="visible"
    class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    @keydown.esc.prevent="cancel"
  >
    <!-- Click outside closes -->
    <div class="absolute inset-0" @click="cancel" aria-hidden="true"></div>

    <div
      class="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-zinc-900 dark:text-zinc-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-dialog-title"
    >
      <h3 id="scenario-dialog-title" class="text-lg font-semibold">
        Add New Scenario
      </h3>

      <label class="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
        Scenario name
        <input
          ref="inputEl"
          v-model="name"
          type="text"
          placeholder="Enter scenario name…"
          class="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none ring-2 ring-transparent transition focus:border-zinc-400 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          @keyup.enter="confirm"
        />
      </label>

      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          @click="confirm"
        >
          OK
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          @click="cancel"
        >
          Cancel
        </button>
      </div>

      <!-- Optional close button -->
      <button
        class="absolute right-3 top-3 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-zinc-800"
        aria-label="Close dialog"
        @click="cancel"
      >
        ✕
      </button>
    </div>
  </div>
</template>
