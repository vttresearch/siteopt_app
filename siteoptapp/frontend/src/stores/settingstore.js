import { ref } from 'vue';
import { defineStore } from 'pinia'

export const useSettingStore = defineStore('settingsData', () => {
  const inputDataPath = ref("");
  const projectPath = ref("");
  const workFolderPath = ref("");

  function setSettings(settings) {
    inputDataPath.value = settings["input_data_path"];
    projectPath.value = ""
    workFolderPath.value = ""
    console.log(inputDataPath.value)
  }

  return { inputDataPath, projectPath, workFolderPath, setSettings}
})
