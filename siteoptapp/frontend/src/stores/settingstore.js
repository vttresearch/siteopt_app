import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('settingsData', () => {
  const inputDataPath = ref(null);  // Initial value must be something else than the default value in config file
  const projectPath = ref(null);
  const workFolders = ref([]);
  const activeProjectIndex = ref(null);
  const activeProjectName = ref("");
  const activeProjectPath = ref("");
  const projectIndexUpdated = ref(null);
  const creatingProjectFolder = ref(false);
  const loadingProjects = ref(false);
  const currentInputFiles = ref({})
  const currentInputValidationByPath = ref({})
  const backendAvailable = ref(false);
  const backendRetryAttempts = ref(0);
  const executionInProgress = ref(false)

  function reset() {
    inputDataPath.value = null
    projectPath.value = null
    workFolders.value = []
    activeProjectIndex.value = null
    activeProjectName.value = ""
    activeProjectPath.value = ""
    projectIndexUpdated.value = null
    creatingProjectFolder.value = false
    loadingProjects.value = false
    currentInputFiles.value = {}
    currentInputValidationByPath.value = {}
    backendAvailable.value = false
    backendRetryAttempts.value = 0
    executionInProgress.value = false
  }

  function setSettings(settings) {
    inputDataPath.value = settings["input_data_path"];
    projectPath.value = settings["project_data_path"];
    workFolders.value = Object.entries(settings["work_folders"]).map(([name, path]) => ({
      name, path
    }));
  }

  function setInputDataPath(p) {
    inputDataPath.value = p;
  }

  function setProjectPath(p) {
    projectPath.value = p;
  }

  function setActiveProject(ind) {
    if (ind === null) {
      activeProjectIndex.value = null
      activeProjectName.value = ""
      activeProjectPath.value = ""
      return
    }
    activeProjectIndex.value = ind
    activeProjectName.value = workFolders.value[ind].name
    activeProjectPath.value = workFolders.value[ind].path
  }

  function setActiveProjectIndex(ind) {
    activeProjectIndex.value = ind
  }

  function setActiveProjectName(name) {
    activeProjectName.value = name
  }

  function setActiveProjectPath(path) {
    activeProjectPath.value = path
  }

  function setCurrentInputFiles(data) {
    currentInputFiles.value = data
  }

  function setCurrentInputValidationByPath(data) {
    currentInputValidationByPath.value = data ?? {}
  }

  function setCurrentInputValidationEntry(path, summary) {
    if (!path) return
    currentInputValidationByPath.value = {
      ...currentInputValidationByPath.value,
      [path]: summary ?? { invalidCount: 0, filetype: null, sheets: {} },
    }
  }

  return {
    inputDataPath,
    projectPath,
    workFolders,
    activeProjectIndex,
    activeProjectName,
    activeProjectPath,
    projectIndexUpdated,
    creatingProjectFolder,
    loadingProjects,
    currentInputFiles,
    currentInputValidationByPath,
    backendAvailable,
    backendRetryAttempts,
    executionInProgress,
    reset,
    setSettings,
    setInputDataPath,
    setProjectPath,
    setActiveProject,
    setActiveProjectIndex,
    setActiveProjectName,
    setActiveProjectPath,
    setCurrentInputFiles,
    setCurrentInputValidationByPath,
    setCurrentInputValidationEntry,
  }
})
