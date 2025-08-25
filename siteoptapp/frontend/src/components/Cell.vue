<script setup>
import { ref } from 'vue';

const props = defineProps({
  v: String,
})

const editing = ref(false)

/**
 * Triggered by clicking a cell.
 *
 * @param e {FocusEvent} Attached event
 */
function update(e) {
  console.log(`updating cell e.target.value:${e.target.value}`)
  //editing.value = false
  //cells[props.c][props.r] = e.target.value.trim()
}
</script>

<template>
  <div class="cell" @click="editing = true">
    <input
      v-if="editing"
      :value="v"
      @change="update"
      @blur="update"
      @vue:mounted="({ el }) => el.focus()"
    >
    <span v-else>{{ v }}</span>
  </div>
</template>
