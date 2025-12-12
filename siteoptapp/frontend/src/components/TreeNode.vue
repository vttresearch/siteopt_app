<template>
  <div class="tree-node">
    <div 
      class="flex items-center justify-between gap-2 px-2 py-1 hover:bg-indigo-300 rounded"
    >
      <div class="flex items-center gap-2 flex-1 cursor-pointer" @click="toggle">
        <span v-if="node.type === 'folder'" class="text-gray-500">
          <font-awesome-icon :icon="isOpen ? 'fa-regular fa-folder-open' : 'fa-regular fa-folder-closed'" fixed-width />
        </span>
        <span v-else class="text-gray-500">
          <font-awesome-icon v-if="isExcel" icon="fa-regular fa-file-excel" fixed-width />
          <font-awesome-icon v-else-if="isCSV" icon="fa-solid fa-file-csv" fixed-width />
          <font-awesome-icon v-else icon="fa-regular fa-file" fixed-width />
        </span>
        <span class="text-sm">{{ node.name }}</span>
      </div>
      
      <div v-if="node.type === 'file'" class="flex gap-1" @click.stop>
        <DownloadButton 
          :file_path="getFilePath()"
          :filename="node.name"
          :folder-id="folderId"
        />
      </div>
    </div>
    
    <div v-if="isOpen && node.children" class="ml-4">
      <TreeNode 
        v-for="child in node.children"
        :key="child.name"
        :node="child"
        :path="path ? `${path}/${node.name}` : node.name"
        :folder-id="folderId"
        @file-clicked="$emit('file-clicked', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import DownloadButton from './DownloadButton.vue';

const props = defineProps({
  node: {
    type: Object,
    required: true
  },
  path: {
    type: String,
    default: ''
  },
  folderId: {
    type: Number,
    default: null
  }
});

const emit = defineEmits(['file-clicked']);

const isOpen = ref(false);

const isExcel = computed(() => props.node.name.endsWith('.xlsx'));
const isCSV = computed(() => props.node.name.endsWith('.csv'));

function toggle() {
  if (props.node.type === 'folder') {
    isOpen.value = !isOpen.value;
  } else {
    // Emit file info so parent can handle fetching
    emit('file-clicked', {
      name: props.node.name,
      path: props.path,
      folderId: props.folderId
    });
  }
}

function getFilePath() {
  let filePath = '';
  if (props.path) {
    filePath = props.path;
    if (!filePath.endsWith('/')) {
      filePath += '/';
    }
  }
  return `${filePath}${props.node.name}`;
}
</script>

<style scoped>
.tree-node {
  user-select: none;
}
</style>
