import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'  // Makes tailwind css available in the app created below
import router from './router.js'
import App from './App.vue'
import "@fortawesome/fontawesome-free/css/all.min.css"
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'  /* import font awesome icon component */
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';


ModuleRegistry.registerModules([AllCommunityModule]);
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.component("font-awesome-icon", FontAwesomeIcon);
app.mount("#app");
