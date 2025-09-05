import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('settingsData', () => {
  const inputDataPath = ref(null);  // Initial value must be something else than the default value in config file
  const projectPath = ref(null);
  const workFolderPath = ref(null);

  function setSettings(settings) {
    inputDataPath.value = settings["input_data_path"];
    projectPath.value = ""
    workFolderPath.value = ""
    console.log(inputDataPath.value)
  }

  function setInputDataPath(p) {
    inputDataPath.value = p;
  }

  return { inputDataPath, projectPath, workFolderPath, setSettings, setInputDataPath}
})
