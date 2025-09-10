import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('settingsData', () => {
  const inputDataPath = ref(null);  // Initial value must be something else than the default value in config file
  const projectPath = ref(null);
  const workFolderPaths = ref([]);

  function setSettings(settings) {
    inputDataPath.value = settings["input_data_path"];
    projectPath.value = settings["project_data_path"];
    workFolderPaths.value = settings["work_folders"]
  }

  function setInputDataPath(p) {
    inputDataPath.value = p;
  }

  function setProjectPath(p) {
    projectPath.value = p;
  }

  function addWorkFolder(name){
    //workFolderPaths.value.push(name)
  }

  return { inputDataPath, projectPath, workFolderPaths, setSettings, setInputDataPath, setProjectPath, addWorkFolder}
})
