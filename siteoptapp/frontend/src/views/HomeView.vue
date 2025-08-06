<script setup>
import { reactive, onMounted, ref } from 'vue';
import FileTree from '@/components/FileTree.vue';
import TableView from "@/components/TableView.vue";
import ContentPanel from "@/components/ContentPanel.vue";


defineProps({
  limit: Number,
});

const on_mounted_response = ref({})
const input_data_title = ref("")
const input_data = ref([])
const status = ref("fetching")

const state = reactive({
  contents: [],
  isLoading: false,
});

onMounted(() => {
  // async IIFE lets you use async/await syntax while still
  // mounting the component synchronously.
  (async () => {
    // Update your refs to re-render the template.
    const input_data_response = await fetch("/api/fetch_input_data")
    if (!input_data_response.ok) {
      status.value = "error fetching input data"
      throw new Error("on_mounted_response not Ok");
    }
    on_mounted_response.value = await input_data_response.text()
    on_mounted_response.value = JSON.parse(on_mounted_response.value)
    input_data_title.value = on_mounted_response.value.title
    input_data.value = on_mounted_response.value.children
    console.log(on_mounted_response.value)
    console.log(typeof(on_mounted_response.value))
    status.value = 'fetched'
  })()
})

const content = ref(
{
  "contents": [
    {},
    {},
  ]
})

</script>

<template>
  <section class="bg-blue-50 px-4 py-10">
    <div class="container-xl lg:container m-auto">
      <h1 class="text-3xl text-blue-500 mb-6">Welcome to SiteOptApp</h1>
      <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileTree :title="input_data_title" :model="input_data" />
          <ContentPanel v-for="cont in content.contents" />
        </div>
        <div>
          <TableView />
        </div>
      </div>
    </div>
  </section>
</template>