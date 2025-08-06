<script setup>
import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";

const props = defineProps({
  fname: String,
})

async function submit_file(fname) {
  console.log("Submitting file", fname)
}
</script>

<template>
<button class="flex-nowrap whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-0.5"
        @click="submit_file(props.fname)">
    <font-awesome-icon class="pr-1" icon="fa-solid fa-upload" fixed-width />Upload
</button>
</template>
