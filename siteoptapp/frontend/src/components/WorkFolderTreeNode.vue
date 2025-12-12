<template>
  <div class="work-folder-tree-node">
    <div 
      class="flex justify-between items-center px-2 py-2 hover:bg-gray-50 rounded cursor-pointer"
      :class="{ 'bg-blue-50 border-l-4 border-blue-500': selectedId === folder.id }"
      @click="$emit('select', folder.id)"
    >
      <div class="flex items-center gap-2 flex-1">
        <button 
          v-if="children.length > 0"
          @click.stop="toggleExpanded"
          class="text-gray-500 hover:text-gray-700 w-4"
        >
          {{ isExpanded ? '▼' : '▶' }}
        </button>
        <span v-else class="w-4"></span>
        
        <font-awesome-icon 
          :icon="isExpanded ? 'fa-regular fa-folder-open' : 'fa-regular fa-folder-closed'" 
          class="text-blue-500" 
        />
        <span class="font-medium">{{ folder.name }}</span>
        <span v-if="!folder.exists" class="text-red-500 text-xs">⚠</span>
      </div>
      
      <div class="flex gap-1">
        <button 
          @click.stop="$emit('clone', folder)"
          class="text-blue-500 hover:text-blue-700 px-2 py-1 text-sm"
          title="Clone this folder"
        >
          📋
        </button>
        <button 
          @click.stop="$emit('delete', folder.id, folder.name)"
          class="text-red-500 hover:text-red-700 px-2 py-1 text-sm"
          title="Delete folder"
        >
          🗑️
        </button>
      </div>
    </div>
    
    <div v-if="isExpanded && children.length > 0" class="ml-6 mt-1 space-y-1">
      <WorkFolderTreeNode
        v-for="child in children"
        :key="child.id"
        :folder="child"
        :all-folders="allFolders"
        :selected-id="selectedId"
        @select="$emit('select', $event)"
        @clone="$emit('clone', $event)"
        @delete="$emit('delete', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  folder: {
    type: Object,
    required: true
  },
  allFolders: {
    type: Array,
    required: true
  },
  selectedId: {
    type: Number,
    default: null
  }
});

defineEmits(['select', 'clone', 'delete']);

const isExpanded = ref(true);

// Find child folders (those created from this folder)
const children = computed(() => {
  return props.allFolders.filter(f => {
    const createdFrom = f.created_from;
    // Check if this folder was cloned from the current folder
    return createdFrom.startsWith('work_folder_') && 
           parseInt(createdFrom.split('_')[2]) === props.folder.id;
  });
});

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<style scoped>
.work-folder-tree-node {
  user-select: none;
}
</style>
