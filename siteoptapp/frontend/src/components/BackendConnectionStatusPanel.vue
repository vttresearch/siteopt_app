<script setup>
import {useSettingStore} from "@/stores/settingstore.js";
import {API_BASE} from "@/config.js";

const settingStore = useSettingStore()

</script>

<template>
  <div v-if="settingStore.backendRetryAttempts < 10">
    <div class="text-gray-400 text-base my-2">
      <p>Backend at {{API_BASE}} doesn't respond. Attempting to reconnect... ({{ settingStore.backendRetryAttempts }}/10)</p>
    </div>
    <div class="border border-gray-100 mb-5"></div>
  </div>
  <div v-else>
    <div class="text-gray-400 text-base my-2">
      <p>Backend unavailable. Please restart and try again.</p>
    </div>
    <div class="border border-gray-100 mb-5"></div>
  </div>
</template>
