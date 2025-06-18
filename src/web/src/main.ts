import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import autoresize from './directives/autoresize'

import 'vue-color/style.css';

const app = createApp(App)
app.use(router)
app.directive('autoresize', autoresize)
app.mount('#app')
