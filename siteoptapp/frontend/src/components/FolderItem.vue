<script setup>
import { ref, watch } from 'vue';
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import FileTree from "@/components/FileTree.vue";

const props = defineProps({
  folderName: String,
  children: Array,
  parentName: String,
  base_path: String,
  enableOpen: {
    type: Boolean,
    default: false
  },
  depth: { type: Number, default: 0 }
})

// Open by default if enableOpen is true
const isOpen = ref(props.enableOpen && props.depth === 0)

function toggle() {
  isOpen.value = !isOpen.value
}

// If the tree is loaded/updated asynchronously, keep it opened initially
watch(
  () => props.children,
  () => {
    if (props.enableOpen && props.depth === 0) {
      isOpen.value = true
    }
  },
  { immediate: true }
)

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
      <FileTree
        :model="children"
        :parentName="folderName"
        :fullParents="parentName"
        :path="props.base_path"
        :enableOpen="props.enableOpen"
        :depth="props.depth + 1"
      />
    </div>
  </div>
</template>
