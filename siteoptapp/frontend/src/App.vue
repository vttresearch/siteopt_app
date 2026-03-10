<script setup>
import NavBar from "@/components/NavBar.vue";
import ChatCopilot from "@/components/ChatCopilot.vue";
import { ENABLE_AI_ASSISTANT } from "@/config.js";

</script>

<template>
  <NavBar />
  <RouterView />
  <ChatCopilot v-if="ENABLE_AI_ASSISTANT" />
</template>
