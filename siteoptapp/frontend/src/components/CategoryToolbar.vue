<script setup>
import { ref, watch, computed } from "vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { fetchInputFiles, fetchFileContents } from "@/utils/functions.js";
import { useConfirmPrompt } from "@/composables/useConfirmPrompt.js";

const settingStore = useSettingStore()
const dataStore = useTableDataStore()
const notify = useNotificationStore()
const selected = ref(null);
const openCategory = ref(null);
const activeFilePath = ref("")
const { confirm } = useConfirmPrompt()

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
    openCategory.value = null
    selected.value = null
    await fetchInputFiles(settingStore.activeProjectName)
  }
})

/* Opens or closes categories */
function toggle(categoryName) {
  openCategory.value =
    openCategory.value === categoryName ? null : categoryName;
}

/* Asks confirmation to save current file it there are changes, downloads a new file and updates data store. */
async function confirmAndLoadFile(value, elTrigger) {
  selected.value = value
  const category = openCategory.value  // Save open category because the confirmation prompt closes it
  if (!settingStore.activeProjectPath) {
    notify.show("Project path is not initialized. Please refresh the page.", 5000, "error")
    return
  }
  await dataStore.askSaveChanges(notify)
  await downloadFile(category)
}

async function downloadFile(category) {
  let fpath = settingStore.activeProjectPath + "/" + "current_input" + "/"
  if (category === "") {
    fpath = fpath + selected.value
  }
  else {
    fpath = fpath + category + "/" + selected.value
  }
  openCategory.value = null;
  activeFilePath.value = fpath
  await fetchFileContents(selected.value, fpath)
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
               hover:bg-gray-50 text-sm font-medium cursor-pointer"
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
          @click="confirmAndLoadFile(opt.value, $event.currentTarget)"
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
