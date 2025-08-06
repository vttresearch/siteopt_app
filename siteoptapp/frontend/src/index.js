import 'vite/modulepreload-polyfill'
import * as Vue from 'vue/dist/vue.esm-bundler.js'
import { createPinia } from 'pinia';
import VueExcelEditor from 'vue3-excel-editor';
import router from './router.js';
import App from './App.vue'
import './style.css'  // This makes tailwind css available in the app created below
import { library } from '@fortawesome/fontawesome-svg-core'  /* import the fontawesome core */
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'  /* import font awesome icon component */
/* import specific icons */
import { faFileCsv, faDownload, faUpload } from '@fortawesome/free-solid-svg-icons'
import { faFolderClosed, faFolderOpen, faFileExcel, faFile } from '@fortawesome/free-regular-svg-icons';

/* add icons to the library */
library.add(faFileCsv, faDownload, faUpload, faFolderClosed, faFolderOpen, faFileExcel, faFile)
const app = Vue.createApp({})
const pinia = createPinia()
app.use(pinia)
app.use(VueExcelEditor)
app.use(router)
app.component('font-awesome-icon', FontAwesomeIcon)
app.component('siteopt_component', App)
app.mount('#siteopt_app')
