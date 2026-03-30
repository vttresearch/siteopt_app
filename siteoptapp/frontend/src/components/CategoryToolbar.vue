<script setup>
import { ref, watch, computed } from "vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { postData, fetchInputFiles } from "@/utils/functions.js";

const settingStore = useSettingStore()
const dataStore = useTableDataStore()
const notify = useNotificationStore()
const selected = ref(null);
const openCategory = ref(null);
const activeFilePath = ref("")

const currentInputFilePath = computed(() => {
  if (!activeFilePath.value) {
    return settingStore.activeProjectPath
  }
  else {
    return activeFilePath
  }
})

/* Fetches the contents of selected projects current input files */
watch(() => settingStore.activeProjectIndex, async (newIndex, oldIndex) => {
  if (newIndex !== oldIndex) {
    activeFilePath.value = ""
    await fetchInputFiles(settingStore.activeProjectName)
  }
})

// open/close categories
function toggle(categoryName) {
  openCategory.value =
    openCategory.value === categoryName ? null : categoryName;
}

// selecting one option closes the dropdown
function select(value) {
  selected.value = value;
  console.log("Category", openCategory.value)
  console.log("Filename", selected.value)
  if (!settingStore.activeProjectPath) {
    notify.show("Project path is not initialized. Please refresh the page.", 5000, "error")
    return
  }
  let fpath = settingStore.activeProjectPath + "/" + "current_input" + "/"
  if (openCategory.value === "") {
    fpath = fpath + selected.value
  }
  else {
    fpath = fpath + openCategory.value + "/" + selected.value
  }
  openCategory.value = null;
  activeFilePath.value = fpath
  fetchFileContents(selected.value, fpath)
}

async function fetchFileContents(fname, fpath) {
  console.log(`Requesting file: ${fpath}`)
  dataStore.clear()
  dataStore.toggleLoading()
  const response = await postData("fetch_data", {full_path: fpath}, notify)
  if (!response.success) {
    dataStore.toggleLoading()
    return
  }
  dataStore.addData(fname, fpath, response.data)
  dataStore.toggleLoading()
}

</script>

<template>
  <p class="text-xs text-gray-500 rounded-md p-2 mb-1 bg-gray-100">{{ currentInputFilePath }}</p>

  <div class="flex gap-4 p-3 bg-gray-100 rounded-md relative">
    <!-- CATEGORIES -->
    <div
      v-for="category in settingStore.currentInputFiles"
      :key="category.name"
      class="relative"
    >
      <button
        @click="toggle(category.value)"
        class="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm
               hover:bg-gray-50 text-sm font-medium"
      >
        {{ category.name }}
      </button>

      <!-- OPTIONS DROPDOWN -->
      <div
        v-if="openCategory === category.value"
        class="absolute left-0 mt-2 w-60 bg-white border border-gray-200
               rounded-md shadow-lg z-50"
      >
        <button
          v-for="opt in category.options"
          :key="opt.value"
          @click="select(opt.value)"
          class="block w-full text-left px-3 py-2 text-sm
                hover:bg-gray-100 border-b last:border-0
                data-[active=true]:bg-blue-600
                data-[active=true]:text-white"
          :data-active="selected === opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </div>
</template>
