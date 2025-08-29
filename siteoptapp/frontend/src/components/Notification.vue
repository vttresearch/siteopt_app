<script setup>
import { watch, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { useNotificationStore } from "@/stores/notificationstore.js";


const notificationStore = useNotificationStore()
const { message, duration, type, visible } = storeToRefs(notificationStore)
let timeoutId = null;

/**
 * Resets and clears all timeouts when the component is unmounted.
 */
onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
});

/**
 * Watches changes in message value. 'message' is a ref stored in notificationStore.
 */
watch(message, (newMessage) => {
  if (newMessage) {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    // Set new timeout to auto-hide
    if (duration.value > 0) {
      timeoutId = setTimeout(() => {
        visible.value = false;
        timeoutId = null;
      }, duration.value);
    }
  }
});

function close() {
  visible.value = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

</script>

<template>
  <transition
      enter-active-class="transition-opacity duration-500"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-500"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
  >
    <div v-if="visible"
      :class="[
        'fixed top-5 right-5 px-4 py-2 rounded text-white z-50 shadow-lg flex items-center justify-between gap-4 min-w-[250px]',
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        'bg-blue-500'
      ]"
    >
      <span>{{ message }}</span>
      <button
        @click="close"
        class="text-white hover:text-gray-200 focus:outline-none"
        aria-label="Close"
      >
        <font-awesome-icon class="pr-1" icon="fa-solid fa-times" fixed-width />
      </button>
    </div>
  </transition>
</template>
