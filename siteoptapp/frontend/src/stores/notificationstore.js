import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useNotificationStore = defineStore('notification', () => {
  const message = ref("");
  const duration = ref(3000);
  const type = ref('info');
  const visible = ref(false);

  function show(msg, dur = 3000, msgType = 'info') {
    message.value = msg;
    duration.value = dur;
    type.value = msgType;
    visible.value = true
    setTimeout(() => {
      visible.value = false
    }, dur)
  }

  return {message, duration, type, visible, show}
});
