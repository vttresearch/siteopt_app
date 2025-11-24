<script setup>
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {API_BASE} from "@/config.js";
import {ref} from "vue";

const props = defineProps({
  file_path: String,  // Full path to the file
  filename: String,   // Display name for the file
})

const downloading = ref(false);

async function downloadFile() {
  if (!props.file_path) return;
  
  downloading.value = true;
  
  try {
    // Construct proper URL - handle empty or "/" API_BASE
    let downloadUrl;
    if (!API_BASE || API_BASE === '' || API_BASE === '/') {
      downloadUrl = `/api/download_file/${props.file_path}`;
    } else {
      // Remove trailing slash from API_BASE if present, then add path
      const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      downloadUrl = `${baseUrl}/api/download_file/${props.file_path}`;
    }
    
    console.log(`API_BASE: "${API_BASE}"`);
    console.log(`Downloading from: ${downloadUrl}`);
    
    const response = await fetch(downloadUrl, {
      method: 'GET',
      credentials: 'include'
    });
    
    console.log('Download response status:', response.status, response.statusText);
    console.log('Download response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error('Download failed with status:', response.status);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      console.log('Download error content-type:', contentType);
      
      if (contentType && contentType.includes('application/json')) {
        try {
          const error = await response.json();
          console.error('Download JSON error:', error);
          alert(`Download failed: ${error.error}`);
        } catch (jsonError) {
          console.error('Failed to parse download error as JSON:', jsonError);
          alert(`Download failed: Server returned ${response.status} ${response.statusText}`);
        }
      } else {
        // Server returned HTML or other non-JSON response
        const errorText = await response.text();
        console.error('Download non-JSON error response:', errorText.substring(0, 200));
        alert(`Download failed: Server returned ${response.status} ${response.statusText}. Check console for details.`);
      }
      return;
    }
    
    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = props.filename || props.file_path.split('/').pop();
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    alert(`Download error: ${error.message}`);
  } finally {
    downloading.value = false;
  }
}
</script>

<template>
<button 
  class="flex-nowrap whitespace-nowrap text-white bg-green-500 hover:bg-green-700 rounded-sm p-0.5 disabled:opacity-50"
  @click="downloadFile"
  :disabled="downloading">
  <font-awesome-icon class="pr-1" icon="fa-solid fa-download" fixed-width />
  {{ downloading ? 'Downloading...' : 'Download' }}
</button>
</template>
