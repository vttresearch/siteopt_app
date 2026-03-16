<script setup>
defineProps({
  title: {
    type: String,
    default: ""
  }
})
</script>

<template>
  <div
    class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
  >
    <div
      class="px-4 py-3 border-b border-gray-200 flex items-center justify-between"
    >
      <h3 class="text-sm font-semibold text-gray-800 truncate">
        {{ title }}
      </h3>
    </div>

    <div class="p-4">
      <slot />
    </div>
  </div>
</template>