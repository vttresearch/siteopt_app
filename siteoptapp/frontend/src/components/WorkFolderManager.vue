<template>
  <div class="work-folder-manager bg-white rounded-xl shadow-md p-4">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-bold text-gray-800">Work Folders</h2>
      <button 
        @click="showCreateDialog = true" 
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
      >
        <span>+</span>
        <span>New Folder</span>
      </button>
    </div>

    <!-- Work Folder List -->
    <div v-if="workFolders.length === 0" class="text-gray-400 text-center py-8">
      No work folders yet. Create one to get started.
    </div>

    <div v-else class="border rounded p-2">
      <WorkFolderTreeNode
        v-for="folder in rootFolders"
        :key="folder.id"
        :folder="folder"
        :all-folders="workFolders"
        :selected-id="selectedFolderId"
        @select="selectFolder"
        @clone="cloneFolder"
        @delete="deleteFolder"
      />
    </div>

    <!-- Create Folder Dialog -->
    <div v-if="showCreateDialog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-bold mb-4">Create Work Folder</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Folder Name</label>
          <input 
            v-model="newFolderName"
            type="text" 
            class="w-full border rounded px-3 py-2"
            placeholder="Enter folder name"
            @keyup.enter="createFolder"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Create From</label>
          <select v-model="createSource" class="w-full border rounded px-3 py-2">
            <option value="input_data">Copy from Input Data</option>
            <option v-if="cloneSourceFolder" :value="`work_folder_${cloneSourceFolder.id}`">
              Clone from "{{ cloneSourceFolder.name }}"
            </option>
          </select>
        </div>

        <div class="flex gap-2 justify-end">
          <button 
            @click="cancelCreate"
            class="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button 
            @click="createFolder"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            :disabled="!newFolderName.trim()"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { buildApiUrl } from '@/utils/apiUrl.js';
import { useNotificationStore } from '@/stores/notificationstore.js';
import WorkFolderTreeNode from './WorkFolderTreeNode.vue';

const notify = useNotificationStore();
const workFolders = ref([]);
const selectedFolderId = ref(null);
const showCreateDialog = ref(false);
const newFolderName = ref('');
const createSource = ref('input_data');
const cloneSourceFolder = ref(null);

const emit = defineEmits(['folder-selected']);

// Get root folders (created from input_data or 'new')
const rootFolders = computed(() => {
  return workFolders.value.filter(f => 
    f.created_from === 'input_data' || f.created_from === 'new'
  );
});

onMounted(() => {
  loadWorkFolders();
});

async function loadWorkFolders() {
  try {
    const url = buildApiUrl('api/work_folders/');
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    const data = await response.json();
    if (data.success) {
      workFolders.value = data.folders;
    } else {
      notify.show(data.error || 'Failed to load work folders', 3000, 'error');
    }
  } catch (error) {
    console.error('Error loading work folders:', error);
    notify.show('Error loading work folders', 3000, 'error');
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) {
    return;
  }

  try {
    const csrfToken = getCookie('csrftoken');
    const url = buildApiUrl('api/work_folders/create/');
    
    let sourceType = createSource.value;
    let sourceId = null;
    
    if (sourceType.startsWith('work_folder_')) {
      sourceId = parseInt(sourceType.split('_')[2]);
      sourceType = 'work_folder';
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({
        name: newFolderName.value,
        source_type: sourceType,
        source_id: sourceId
      })
    });
    
    const data = await response.json();
    if (data.success) {
      notify.show(`Work folder "${newFolderName.value}" created`, 3000, 'success');
      await loadWorkFolders();
      cancelCreate();
    } else {
      notify.show(data.error || 'Failed to create work folder', 3000, 'error');
    }
  } catch (error) {
    console.error('Error creating work folder:', error);
    notify.show('Error creating work folder', 3000, 'error');
  }
}

function cloneFolder(folder) {
  cloneSourceFolder.value = folder;
  newFolderName.value = `${folder.name}_copy`;
  createSource.value = `work_folder_${folder.id}`;
  showCreateDialog.value = true;
}

async function deleteFolder(folderId, folderName) {
  if (!confirm(`Are you sure you want to delete "${folderName}"? This will permanently remove the folder and all its contents.`)) {
    return;
  }

  try {
    const csrfToken = getCookie('csrftoken');
    const url = buildApiUrl(`api/work_folders/${folderId}/`);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-CSRFToken': csrfToken,
      },
      credentials: 'include'
    });
    
    const data = await response.json();
    if (data.success) {
      notify.show('Work folder deleted', 3000, 'success');
      if (selectedFolderId.value === folderId) {
        selectedFolderId.value = null;
        emit('folder-selected', null);
      }
      await loadWorkFolders();
    } else {
      notify.show(data.error || 'Failed to delete work folder', 3000, 'error');
    }
  } catch (error) {
    console.error('Error deleting work folder:', error);
    notify.show('Error deleting work folder', 3000, 'error');
  }
}

function selectFolder(folderId) {
  selectedFolderId.value = folderId;
  emit('folder-selected', folderId);
}

function cancelCreate() {
  showCreateDialog.value = false;
  newFolderName.value = '';
  createSource.value = 'input_data';
  cloneSourceFolder.value = null;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
</script>

<style scoped>
.work-folder-manager {
  min-height: 300px;
}
</style>
