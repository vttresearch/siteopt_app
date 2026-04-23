import { useTableDataStore } from "@/stores/filedatastore"
import { useMetadataStore } from "@/stores/metadatastore"
import { useNotificationStore } from "@/stores/notificationstore"
import { useResultStore} from "@/stores/resultstore.js"
import { useScenarioStore } from "@/stores/scenariostore.js"
import { useSettingStore } from "@/stores/settingstore"
import { useSheetStore } from "@/stores/sheetStore.js";
import { useTaskStore } from "@/stores/taskstore.js";

export function resetUserStores() {
  useTableDataStore().reset()
  useMetadataStore().reset()
  useNotificationStore().reset()
  useResultStore().reset()
  useScenarioStore().reset()
  useSettingStore().reset()
  useSheetStore().reset()
  useTaskStore().reset()
}
