import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('settingsData', () => {
  const inputDataPath = ref(null);  // Initial value must be something else than the default value in config file
  const projectPath = ref(null);
  const workFolders = ref({});
  const workFolderFiles = ref({});
  const activeProjectIndex = ref(0);
  const creatingProjectFolder = ref(false);
  const creatingTestProjectFolder = ref(false);
  const loadingProjects = ref(false);
  const backendAvailable = ref(false);
  const backendRetryAttempts = ref(0)


  function setSettings(settings) {
    inputDataPath.value = settings["input_data_path"];
    projectPath.value = settings["project_data_path"];
    workFolders.value = settings["work_folders"]
  }

  function setInputDataPath(p) {
    inputDataPath.value = p;
  }

  function setProjectPath(p) {
    projectPath.value = p;
  }

  function setWorkFolderFiles(files) {
    workFolderFiles.value = files
  }

  function setActiveProjectIndex(ind) {
    activeProjectIndex.value = ind
  }

  return {
    inputDataPath,
    projectPath,
    workFolders,
    workFolderFiles,
    activeProjectIndex,
    creatingProjectFolder,
    creatingTestProjectFolder,
    loadingProjects,
    backendAvailable,
    backendRetryAttempts,
    setSettings,
    setInputDataPath,
    setProjectPath,
    setWorkFolderFiles,
    setActiveProjectIndex
  }
})
