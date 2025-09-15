import 'vite/modulepreload-polyfill'
import * as Vue from 'vue';
import { createPinia } from 'pinia';
import router from './router.js';
import App from './App.vue'
import './style.css';  // This makes tailwind css available in the app created below
import { library } from '@fortawesome/fontawesome-svg-core';  /* import the fontawesome core */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';  /* import font awesome icon component */
/* import selected icons */
import { faFileCsv, faDownload, faUpload, faTimes } from '@fortawesome/free-solid-svg-icons';
import { faFolderClosed, faFolderOpen, faFileExcel, faFile, faCircleCheck } from '@fortawesome/free-regular-svg-icons';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';

/* add icons to the library */
library.add(faFileCsv, faDownload, faUpload, faFolderClosed, faFolderOpen, faFileExcel, faFile, faTimes, faCircleCheck);
ModuleRegistry.registerModules([AllCommunityModule]);
const app = Vue.createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.component('font-awesome-icon', FontAwesomeIcon);
app.mount('#app');
