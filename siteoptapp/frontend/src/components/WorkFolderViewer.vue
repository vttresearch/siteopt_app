<template>
  <div class="work-folder-viewer bg-white rounded-xl shadow-md p-4">
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <div class="text-gray-600 mt-2">Loading folder contents...</div>
    </div>

    <div v-else-if="error" class="text-red-500 text-center py-8">
      {{ error }}
    </div>

    <div v-else-if="tree">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-bold text-gray-800">{{ tree.title || tree.name }}</h3>
        <div class="flex gap-2">
          <button
            @click="downloadZip"
            class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition"
            title="Download entire folder as ZIP"
          >
            <font-awesome-icon icon="fa-solid fa-file-zipper" class="mr-1" />
            Download ZIP
          </button>
          <button
            @click="triggerZipUpload"
            class="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            title="Upload and extract ZIP file"
          >
            <font-awesome-icon icon="fa-solid fa-upload" class="mr-1" />
            Upload ZIP
          </button>
          <input
            ref="zipFileInput"
            type="file"
            accept=".zip"
            style="display: none"
            @change="handleZipUpload"
          />
          <button
            @click="triggerDirectoryUpload"
            class="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
            title="Upload entire directory"
          >
            <font-awesome-icon icon="fa-solid fa-folder-open" class="mr-1" />
            Upload Folder
          </button>
          <input
            ref="directoryInput"
            type="file"
            webkitdirectory
            directory
            multiple
            style="display: none"
            @change="handleDirectoryUpload"
          />
          <UploadButton 
            :folder-id="folderId" 
            folder_path="" 
            @uploaded="refreshTree" 
          />
          <button 
            @click="refreshTree"
            class="text-blue-500 hover:text-blue-700 text-sm px-2"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      <div class="border rounded p-2 max-h-96 overflow-y-auto">
        <TreeNode 
          v-for="child in tree.children" 
          :key="child.name"
          :node="child"
          path=""
          :folder-id="folderId"
          @file-clicked="onFileClicked"
        />
      </div>
    </div>

    <div v-else class="text-gray-400 text-center py-8">
      Select a work folder to view its contents
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import TreeNode from './TreeNode.vue';
import UploadButton from './UploadButton.vue';
import { buildApiUrl } from '@/utils/apiUrl.js';
import { useNotificationStore } from '@/stores/notificationstore.js';
import { useTableDataStore } from '@/stores/filedatastore.js';

const props = defineProps({
  folderId: {
    type: Number,
    default: null
  }
});

const notify = useNotificationStore();
const tableDataStore = useTableDataStore();
const loading = ref(false);
const error = ref(null);
const tree = ref(null);
const zipFileInput = ref(null);
const directoryInput = ref(null);

watch(() => props.folderId, (newId) => {
  if (newId) {
    loadTree(newId);
  } else {
    tree.value = null;
    error.value = null;
  }
});

async function loadTree(folderId) {
  if (!folderId) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const url = buildApiUrl(`api/work_folders/${folderId}/tree/`);
    const response = await fetch(url, {
      credentials: 'include'
    });
    
    const data = await response.json();
    if (data.success) {
      tree.value = data.tree;
    } else {
      error.value = data.error || 'Failed to load folder contents';
      notify.show(error.value, 3000, 'error');
    }
  } catch (err) {
    console.error('Error loading tree:', err);
    error.value = 'Error loading folder contents';
    notify.show(error.value, 3000, 'error');
  } finally {
    loading.value = false;
  }
}

function refreshTree() {
  if (props.folderId) {
    loadTree(props.folderId);
  }
}

async function onFileClicked(fileInfo) {
  console.log('File clicked:', fileInfo);
  
  // Build the file path relative to work folder root
  let filePath = '';
  if (fileInfo.path) {
    filePath = fileInfo.path;
    if (!filePath.endsWith('/')) {
      filePath += '/';
    }
  }
  filePath += fileInfo.name;
  
  // Use work folder specific API
  const apiPath = `api/work_folders/${props.folderId}/file/${filePath}`;
  const url = buildApiUrl(apiPath);
  
  console.log(`Fetching work folder file from ${url}`);
  tableDataStore.toggleLoading();
  
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      console.error('Failed to fetch file');
      notify.show('Failed to load file data', 3000, 'error');
    } else {
      const jsonData = await response.json();
      console.log('File data received:', jsonData);
      tableDataStore.addData(fileInfo.name, jsonData, filePath, props.folderId);
    }
  } catch (err) {
    console.error('Error fetching file:', err);
    notify.show('Error loading file data', 3000, 'error');
  } finally {
    tableDataStore.toggleLoading();
  }
}

async function downloadZip() {
  if (!props.folderId) return;
  
  try {
    const url = buildApiUrl(`api/work_folders/${props.folderId}/download-zip/`);
    const response = await fetch(url, { credentials: 'include' });
    
    if (!response.ok) {
      const error = await response.json();
      notify.show(`Download failed: ${error.error}`, 3000, 'error');
      return;
    }
    
    // Create blob and download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${tree.value.name}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    
    notify.show('Folder downloaded successfully', 2000, 'success');
  } catch (err) {
    console.error('Error downloading zip:', err);
    notify.show('Error downloading folder', 3000, 'error');
  }
}

function triggerZipUpload() {
  zipFileInput.value.click();
}

async function handleZipUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (!file.name.endsWith('.zip')) {
    notify.show('Please select a ZIP file', 3000, 'error');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const url = buildApiUrl(`api/work_folders/${props.folderId}/upload-zip/`);
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    
    const result = await response.json();
    if (result.success) {
      notify.show('ZIP file uploaded and extracted successfully', 3000, 'success');
      refreshTree();
    } else {
      notify.show(`Upload failed: ${result.error}`, 3000, 'error');
    }
  } catch (err) {
    console.error('Error uploading zip:', err);
    notify.show('Error uploading ZIP file', 3000, 'error');
  } finally {
    // Reset file input
    event.target.value = '';
  }
}

function triggerDirectoryUpload() {
  directoryInput.value.click();
}

async function handleDirectoryUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  
  if (!confirm(`This will replace all folder contents with ${files.length} files from the selected directory. Continue?`)) {
    event.target.value = '';
    return;
  }
  
  try {
    notify.show('Uploading directory...', 0, 'info');
    
    // First, clear the work folder
    const clearUrl = buildApiUrl(`api/work_folders/${props.folderId}/clear/`);
    await fetch(clearUrl, {
      method: 'POST',
      credentials: 'include'
    });
    
    // Upload files one by one or in batches
    let uploaded = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      // Get relative path from the file's webkitRelativePath
      const relativePath = file.webkitRelativePath || file.name;
      // Extract the folder path (remove the first folder name and filename)
      const parts = relativePath.split('/');
      parts.shift(); // Remove root folder name
      parts.pop(); // Remove filename
      const folderPath = parts.join('/');
      
      if (folderPath) {
        formData.append('folder_path', folderPath);
      }
      
      const url = buildApiUrl(`api/work_folders/${props.folderId}/upload/`);
      await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      uploaded++;
      if (uploaded % 10 === 0) {
        notify.show(`Uploaded ${uploaded}/${files.length} files...`, 0, 'info');
      }
    }
    
    notify.show(`Successfully uploaded ${files.length} files`, 3000, 'success');
    refreshTree();
  } catch (err) {
    console.error('Error uploading directory:', err);
    notify.show('Error uploading directory', 3000, 'error');
  } finally {
    event.target.value = '';
  }
}
</script>
