<script setup>
import { ref, watch } from 'vue';
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
const whenOpen = ref("fa-regular fa-folder-open")
const whenClosed = ref("fa-regular fa-folder-closed")

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
  <div>
    <span
        class="flex items-baseline justify-start gap-1 font-bold hover:bg-gray-200 p-0.5 cursor-pointer"
        @click="toggle">
      <i :class="[isOpen ? whenOpen : whenClosed]"></i>
      <span>{{ folderName }}</span>
    </span>

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
