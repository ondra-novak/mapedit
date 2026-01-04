import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import EnemiesEditor from '@/views/EnemiesEditor.vue'
import AssetsManager from '@/views/AssetsManager.vue'
import FactsDB from '@/views/FactsDB.vue'
import ItemsEditor from '@/views/ItemsEditor.vue'
import SpellsEditor from '@/views/SpellsEditor.vue'
import CharacterEditor from '@/views/CharacterEditor.vue'
import ShopsEditor from '@/views/ShopsEditor.vue'
import BasicInfo from '@/views/BasicInfo.vue'
import MapEditor from '@/views/MapEditor.vue'
import TestView from '@/views/TestView.vue'

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
      path: '/items',
      name: 'Items',
      component: ItemsEditor
    },
    {
      path: '/facts',
      name: "Facts",
      component: FactsDB
    },
    {
      path: '/spells',
      name: "Spells",
      component: SpellsEditor
    },
    {
      path: "/characters",
      name: "Characters",
      component: CharacterEditor
    },
    {
      path: "/shops",
      name: "Shops",
      component: ShopsEditor
    },
    {
      path: "/basic",
      name: "Basic Info",
      component: BasicInfo
    },
    {
      path: "/maps",
      name: "Maps",
      component: MapEditor
    },
    {
      path: "/test",
      name: "Test",
      component: TestView
    }


  ],
})

export default router
