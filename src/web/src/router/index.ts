import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import EnemiesEditor from '@/views/EnemiesEditor.vue'
import AssetsManager from '@/views/AssetsManager.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/enemies',
      name: 'enemies',
      component: EnemiesEditor,
    },
    {
      path: '/assets',
      name: 'assets',
      component: AssetsManager
    },
  ],
})

export default router
