<script setup>
import { defineProps } from 'vue';
import { API_BASE } from "@/config.js";
import { useTableDataStore } from "@/stores/filedatastore.js";

//const data_store = useTableDataStore()
const props = defineProps( {
  content: {
    type: Object,
    required: false,
  },
})

</script>

<template>
  <div class="bg-white rounded-xl shadow-md relative">
    <div class="p-4">
      <div class="mb-5">
        <component v-if="content !== undefined" :is="content"></component>
        <div v-else class="text-gray-400 text-base my-2">Connection to {{ API_BASE }} failed. Please start backend and try again.</div>
        <div class="border border-gray-100 mb-5"></div>
      </div>
    </div>
  </div>
</template>
