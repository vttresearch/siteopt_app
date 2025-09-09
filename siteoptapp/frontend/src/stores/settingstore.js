import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('settingsData', () => {
  const inputDataPath = ref(null);  // Initial value must be something else than the default value in config file
  const projectPath = ref(null);
  const workFolderPath = ref(null);

  function setSettings(settings) {
    inputDataPath.value = settings["input_data_path"];
    projectPath.value = settings["project_data_path"];
    workFolderPath.value = ""
  }

  function setInputDataPath(p) {
    inputDataPath.value = p;
  }

  function setProjectPath(p) {
    projectPath.value = p;
  }

  return { inputDataPath, projectPath, workFolderPath, setSettings, setInputDataPath, setProjectPath}
})
