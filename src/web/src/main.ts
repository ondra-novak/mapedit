import './assets/main.css'
import '@/assets/map.css'

import { createApp } from 'vue'
import App from './App.vue'
import autoresize from './directives/autoresize'
import watch_range from './directives/watch_range'
import { vAutoSvgSize } from './directives/autosvgsize'
import { svgEllipsis } from './directives/svgellipsis'

import 'vue-color/style.css';

const app = createApp(App);
app.directive('autoresize', autoresize);
app.directive('watch-range', watch_range);
app.directive('autosvgsize', vAutoSvgSize);
app.directive("svg-ellipsis", svgEllipsis);
app.mount('#app');


