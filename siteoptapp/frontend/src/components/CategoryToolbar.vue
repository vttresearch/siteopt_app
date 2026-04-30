<script setup>
import { ref, watch, computed } from "vue";
import { useSettingStore } from "@/stores/settingstore.js";
import { useTableDataStore } from "@/stores/filedatastore.js";
import { useNotificationStore } from "@/stores/notificationstore.js";
import { useValidationStore } from "@/stores/validationstore.js";
import { fetchInputFiles, fetchFileContents, uploadInputCsv } from "@/utils/functions.js";
import { validateTimeValueCsvText } from "@/utils/inputCsvUploadUtils.js";
import { useConfirmPrompt } from "@/composables/useConfirmPrompt.js";

const settingStore = useSettingStore()
const dataStore = useTableDataStore()
const notify = useNotificationStore()
const validationStore = useValidationStore()
const props = defineProps({
  hasValidationIssues: {
    type: Boolean,
    default: false,
  },
})
const selected = ref(null);
const openCategory = ref(null);
const activeFilePath = ref("")
const uploadInputCategory = ref("")
const uploadInputFile = ref(null)
const uploadingInputCsv = ref(false)
const { confirm } = useConfirmPrompt()

const currentInputFilePath = computed(() => {
  if (!activeFilePath.value) {
    return settingStore.activeProjectPath
  }
  else {
    return activeFilePath
  }
})

function getFilePath(categoryValue, fileName) {
  const basePath = `${settingStore.activeProjectPath}/current_input`
  return categoryValue
    ? `${basePath}/${categoryValue}/${fileName}`
    : `${basePath}/${fileName}`
}

function getFileInvalidCount(categoryValue, fileName) {
  const fullPath = getFilePath(categoryValue, fileName)
  return validationStore.getValidationSummary(fullPath).invalidCount
}

function getCategoryInvalidCount(categoryValue) {
  const category = (settingStore.currentInputFiles ?? []).find((entry) => entry.value === categoryValue)
  if (!category) return 0

  return (category.options ?? []).reduce(
    (sum, option) => sum + getFileInvalidCount(categoryValue, option.value),
    0,
  )
}

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

function handleInputCsvSelect(event) {
  uploadInputFile.value = event.target.files?.[0] ?? null;
}

async function uploadCsvToInputFolder() {
  if (!settingStore.activeProjectName) {
    notify.show("Select a project before uploading input CSV files.", 4000, "error");
    return;
  }

  if (!uploadInputFile.value) {
    notify.show("Choose a CSV file to upload.", 3000, "error");
    return;
  }

  if (!uploadInputFile.value.name.toLowerCase().endsWith(".csv")) {
    notify.show("Only .csv files can be uploaded to input data.", 4000, "error");
    return;
  }

  const validation = validateTimeValueCsvText(await uploadInputFile.value.text());
  if (!validation.valid) {
    notify.show(validation.message, 5000, "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", uploadInputFile.value);
  formData.append("project_name", settingStore.activeProjectName);
  formData.append("category", uploadInputCategory.value);

  uploadingInputCsv.value = true;
  const response = await uploadInputCsv(formData, notify);
  uploadingInputCsv.value = false;

  if (!response?.success) return;

  notify.show(`${uploadInputFile.value.name} uploaded to input data`, 4000, "info");
  uploadInputFile.value = null;
  await fetchInputFiles(settingStore.activeProjectName);
}

function getOptionClasses(opt) {
  const isSelected = selected.value === opt.value
  const isInvalidCurrentFile = props.hasValidationIssues && isSelected
  const hasProjectValidationIssues = getFileInvalidCount(openCategory.value, opt.value) > 0

  if (isInvalidCurrentFile || hasProjectValidationIssues) {
    return "block w-full border-b px-3 py-2 text-left text-sm text-red-800 last:border-0 hover:bg-red-50 data-[active=true]:bg-red-600 data-[active=true]:text-white"
  }

  return "block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b last:border-0 data-[active=true]:bg-blue-600 data-[active=true]:text-white"
}

</script>

<template>
  <p
    class="mb-1 rounded-md p-2 text-xs"
    :class="props.hasValidationIssues ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-500'"
  >
    {{ currentInputFilePath }}
  </p>

  <div class="flex gap-4 p-3 bg-gray-100 rounded-md relative">
    <!-- CATEGORIES -->
    <div
      v-for="category in settingStore.currentInputFiles"
      :key="category.name"
      class="relative"
    >
      <button
        @click="toggle(category.value)"
        class="px-4 py-2 rounded-md border shadow-sm text-sm font-medium cursor-pointer"
        :class="getCategoryInvalidCount(category.value) > 0
          ? 'bg-red-50 border-red-300 text-red-800 hover:bg-red-100'
          : 'bg-white border-gray-300 hover:bg-gray-50'"
        :title="getCategoryInvalidCount(category.value) > 0 ? `${getCategoryInvalidCount(category.value)} invalid cell${getCategoryInvalidCount(category.value) === 1 ? '' : 's'} in this category` : null"
      >
        {{ category.name }}
        <span v-if="getCategoryInvalidCount(category.value) > 0" class="ml-1 font-semibold">!</span>
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
          :class="getOptionClasses(opt)"
          :data-active="selected === opt.value"
        >
          {{ opt.label }}
          <span v-if="(props.hasValidationIssues && selected === opt.value) || getFileInvalidCount(openCategory, opt.value) > 0" class="ml-1 font-semibold">!</span>
        </button>
      </div>
    </div>
  </div>

  <div class="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-gray-100 p-3 text-sm">
    <span class="font-medium text-gray-700">Upload time series CSV</span>
    <select
      v-model="uploadInputCategory"
      class="rounded border border-gray-300 bg-white px-2 py-1"
      title="Destination folder under current_input"
    >
      <option
        v-for="category in settingStore.currentInputFiles"
        :key="category.value"
        :value="category.value"
      >
        {{ category.name }}
      </option>
    </select>
    <input
      type="file"
      accept=".csv,text/csv"
      class="block text-sm text-gray-800 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white hover:file:bg-blue-700"
      @change="handleInputCsvSelect"
    />
    <button
      class="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
      :disabled="!uploadInputFile || uploadingInputCsv"
      @click="uploadCsvToInputFolder"
    >
      {{ uploadingInputCsv ? "Uploading..." : "Upload CSV" }}
    </button>
    <span class="text-xs text-gray-500">Format: time,value</span>
  </div>
</template>
