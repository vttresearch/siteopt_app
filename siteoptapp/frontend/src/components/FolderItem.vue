<script setup>
import { ref } from 'vue';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import FileItem from "@/components/FileItem.vue";
import FileTree from "@/components/FileTree.vue";


const props = defineProps ({
  folderName: String,
  children: Array,
  parentName: String,
})

const isOpen = ref(false)

function toggle() {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="py-0.5 cursor-pointer">
    <div class="cursor-pointer font-bold flex items-center" @click="toggle">
      <font-awesome-icon
        class="pr-1"
        :icon="isOpen ? 'fa-regular fa-folder-open' : 'fa-regular fa-folder-closed'"
        fixed-width
      />
      <span>{{ folderName }}</span>
    </div>
    <div v-show="isOpen" class="pl-4">
      <FileTree :model="children" :parentName="folderName" />
    </div>
  </div>
</template>
