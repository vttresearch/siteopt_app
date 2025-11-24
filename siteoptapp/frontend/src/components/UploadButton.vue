<script setup>
import {FontAwesomeIcon} from "@fortawesome/vue-fontawesome";
import {API_BASE} from "@/config.js";
import {ref} from "vue";

const props = defineProps({
  folder_path: String,  // Current folder path for upload
})

const emit = defineEmits(['uploaded']);
const fileInput = ref(null);
const uploading = ref(false);

function triggerFileInput() {
  fileInput.value.click();
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  uploading.value = true;
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (props.folder_path) {
      formData.append('folder_path', props.folder_path);
    }
    
    // Get CSRF token
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
    
    // Get client_id from cookies
    const clientId = document.cookie
      .split('; ')
      .find(row => row.startsWith('client_id='))
      ?.split('=')[1];
    
    // Construct proper URL - handle empty or "/" API_BASE
    let uploadUrl;
    if (!API_BASE || API_BASE === '' || API_BASE === '/') {
      uploadUrl = '/api/upload_file/';
    } else {
      // Remove trailing slash from API_BASE if present, then add path
      const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      uploadUrl = `${baseUrl}/api/upload_file/`;
    }
    
    console.log(`API_BASE: "${API_BASE}"`);
    console.log(`Uploading to: ${uploadUrl}`);
    console.log(`Client ID from cookie: ${clientId}`);
    console.log(`CSRF token: ${csrfToken}`);
    console.log(`All cookies: ${document.cookie}`);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRFToken': csrfToken || '',
      },
      credentials: 'include'
    });
    
    console.log(`Upload response status: ${response.status}`);
    console.log(`Upload response headers:`, response.headers);
    
    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Upload failed with status ${response.status}:`, errorText);
      alert(`Upload failed: HTTP ${response.status} - ${errorText.substring(0, 200)}`);
      return;
    }
    
    // Check content type before parsing JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error('Expected JSON response but got:', contentType, responseText);
      alert(`Upload error: Server returned ${contentType} instead of JSON. Response: ${responseText.substring(0, 200)}`);
      return;
    }
    
    const result = await response.json();
    
    if (result.success) {
      alert(`File uploaded successfully: ${result.message}`);
      emit('uploaded'); // Refresh file tree
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Upload error:', error);
    alert(`Upload error: ${error.message}`);
  } finally {
    uploading.value = false;
    event.target.value = ''; // Reset file input
  }
}
</script>

<template>
<div>
  <button 
    class="flex-nowrap whitespace-nowrap text-white bg-blue-500 hover:bg-blue-700 rounded-sm p-0.5 disabled:opacity-50"
    @click="triggerFileInput"
    :disabled="uploading">
    <font-awesome-icon class="pr-1" icon="fa-solid fa-upload" fixed-width />
    {{ uploading ? 'Uploading...' : 'Upload' }}
  </button>
  <input 
    ref="fileInput"
    type="file" 
    @change="handleFileUpload"
    style="display: none"
    accept=".xlsx,.csv,.json,.txt"
  />
</div>
</template>
