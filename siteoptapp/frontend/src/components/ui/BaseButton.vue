<script setup>
import { computed } from "vue";

const props = defineProps({
  variant: {
    type: String,
    default: "primary", // primary | secondary | danger | ghost
  },
  disabled: Boolean,
});

const base =
  "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition " +
  "focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: "bg-blue-500 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-blue-500 cursor-pointer",
  danger: "bg-red-500 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300",
};

const classes = computed(() => `${base} ${variants[props.variant]}`);
</script>

<template>
  <button :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>
