<script setup>
defineProps({
  message: {
    type: String,
    default: 'Loading...'
  }
})
</script>

<template>
  <div class="flex flex-col items-center justify-center space-y-2 py-4">
    <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    <span class="text-blue-500 font-medium">{{ message }}</span>
  </div>
</template>
