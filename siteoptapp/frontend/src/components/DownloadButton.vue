<script setup>

const props = defineProps({
  fname: String,
})

async function open_excel_file(fname) {
  console.log("Opening file", fname)
  const path = "open_excel/".concat(fname)
  const response = await fetch(path);
  console.log(response.text());
}
</script>

<template>
<button class="flex-nowrap whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-0.5"
        @click="open_excel_file(props.fname)">
  <i class="fa-solid fa-download"></i>Download
</button>
</template>
