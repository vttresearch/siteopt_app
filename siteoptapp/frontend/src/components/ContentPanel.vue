<script setup>
import { ref, computed } from 'vue';
import { useTableDataStore} from "@/stores/filedatastore.js";

const data_store = useTableDataStore()
const props = defineProps({
  jsonContent: Object,
});

const showFullDescription = ref(false);

const toggleFullDescription = () => {
  showFullDescription.value = !showFullDescription.value;
};

const truncatedDescription = computed(() => {
  let description = props.job.description;
  if (!showFullDescription.value) {
    description = description.substring(0, 90) + '...';
  }
  return description;
});
</script>

<template>
  <div class="bg-white rounded-xl shadow-md relative">
    <div class="p-4">
      <div class="mb-6">
        <div class="text-gray-600 my-2">Content</div>
        <h3 class="text-xl font-bold">{{ data_store.fname }}</h3>
      </div>

      <div class="mb-5">
        <div>
          <p v-if="Object.keys(data_store.daata).length !== 0">{{ data_store.daata }}</p>
        </div>
        <button
          @click="toggleFullDescription"
          class="text-blue-500 hover:text-blue-600 mb-5"
        >
          {{ showFullDescription ? 'Less' : 'More' }}
        </button>
      </div>
      <div class="border border-gray-100 mb-5"></div>
    </div>
  </div>
</template>