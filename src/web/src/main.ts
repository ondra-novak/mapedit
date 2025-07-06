import './assets/main.css'
import '@/assets/map.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import autoresize from './directives/autoresize'
import watch_range from './directives/watch_range'

import 'vue-color/style.css';

const app = createApp(App);
app.use(router);
app.directive('autoresize', autoresize);
app.directive('watch-range', watch_range);
app.mount('#app');

