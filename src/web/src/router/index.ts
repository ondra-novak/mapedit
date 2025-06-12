import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import EnemiesEditor from '@/views/EnemiesEditor.vue'
import AssetsManager from '@/views/AssetsManager.vue'
import FactsDB from '@/views/FactsDB.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: HomeView,
    },
    {
      path: '/enemies',
      name: 'Enemies',
      component: EnemiesEditor,
    },
    {
      path: '/assets',
      name: 'Assets',
      component: AssetsManager
    },
    {
      path: '/facts',
      name: "Facts",
      component: FactsDB
    }
  ],
})

export default router
