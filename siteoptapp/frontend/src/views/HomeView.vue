<script setup>
import { onMounted, ref } from 'vue';
import FileTree from '@/components/FileTree.vue';
import TableView from "@/components/TableView.vue";
import ContentPanel from "@/components/ContentPanel.vue";
import Spinner from "@/components/Spinner.vue";
import { API_BASE } from "@/config.js";
import TableWithDataProp from "@/components/TableWithDataProp.vue";


defineProps({
  limit: Number,
});

const input_data = ref([]);
const input_data_title = ref('');
const on_mounted_response = ref({});
const loading = ref(true);


onMounted(() => {
  const checkBackEndReady = async () => {
    let attempts = 0;
    const maxAttempts = 10;
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    console.log(`API BASE in HomeView: ${API_BASE}`)
    while (attempts < maxAttempts) {
      try {
        const res = await fetch(API_BASE + "api/health/");
        if (res.ok) {
          // Fetch input data files
          await fetch_input_files();
          loading.value = false;
          return;
        }
      } catch (err) {
        console.log(`Backend not ready (attempt ${attempts + 1})`);
      }
      attempts++;
      await delay(1000);  // Wait 1s before retrying
    }
    console.error("Backend did not start in time");
    // Maybe show an error message to the user
  };

  checkBackEndReady();
});

const fetch_input_files = async () => {
  try {
    const response = await fetch(`${API_BASE}api/fetch_input_data/`);
    if (!response.ok) throw new Error("Fetching input data files failed");

    const text = await response.text();
    const data = JSON.parse(text);
    on_mounted_response.value = data;
    input_data_title.value = data.title;
    input_data.value = data.children;
    console.log(data)
  } catch (err) {
    console.error("Error fetching input files:", err);
  }
};

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
      <div><TableWithDataProp /></div>
      <p><br/></p>
      <div class="grid grid-rows-1 md:grid-rows-2 gap-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Spinner v-if="loading" message="Loading..." class="col-span-1 md:col-span-3" />
          <template v-else>
            <div>
              <FileTree :title="input_data_title" :model="input_data" />
            </div>
          <ContentPanel v-for="(cont, index) in content.contents" :key="index" />
          </template>
        </div>
      </div>
    </div>
  </section>
</template>