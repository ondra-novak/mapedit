<script setup lang="ts">
import StatusBar from './components/StatusBar.vue'
import MessageBoxComponent from './utils/messageBoxComponent.vue';
import MissingFiles from './components/tools/MissingFiles.vue';
import ProjectSelectorDlg from './components/ProjectSelectorDlg.vue';
import ServerConfigDlg from './components/GameClientCfgDlg.vue';
import { ref, watch } from 'vue';
import BasicInfo from './views/BasicInfo.vue';
import MapEditor from './views/MapEditor.vue';
import AssetsManager from './views/AssetsManager.vue';
import ItemsEditor from './views/ItemsEditor.vue';
import EnemiesEditor from './views/EnemiesEditor.vue';
import SpellsEditor from './views/SpellsEditor.vue';
import CharacterEditor from './views/CharacterEditor.vue';
import ShopsEditor from './views/ShopsEditor.vue';

const active_item = ref<number>(0);


const items = {
  1:"Basic",
  2:"Assets",
  3:"Map",
  4:"Items",
  5:"Enemies",
  6:"Spells",
  7:"Characters",
  8:"Shops"  
}


</script>

<template>
<div class="screen">
<menu>
  <li v-for="(n, i) of items" @click="active_item = i" :class="{active: active_item == i}"> {{ n }}</li>
</menu>
<div class="workspace-outer">
  <div class="workspace-inner">
    <div v-if="active_item == 1"><BasicInfo  /></div>
    <div v-if="active_item == 2"><AssetsManager /></div>
    <div><MapEditor :active="active_item == 3"/></div>
    <div v-if="active_item == 4"><ItemsEditor /></div>
    <div v-if="active_item == 5"><EnemiesEditor /></div>
    <div v-if="active_item == 6"><SpellsEditor /></div>
    <div v-if="active_item == 7"><CharacterEditor /></div>
    <div v-if="active_item == 8"><ShopsEditor /></div>
  </div>
</div>
<div class="statusbar">  
  <StatusBar />
</div>
</div>
<MessageBoxComponent/>
<MissingFiles />
<ProjectSelectorDlg />
<ServerConfigDlg />
</template>


<style scoped>

.screen {
  height:  100vh;
  width: 100vw;
}


.screen > menu {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  display: flex;
  background-color: #aaa;
  padding: 0 1rem ;
  margin: 0;
  gap: 1px;
}

.workspace-outer {
  position: absolute; 
  top:2.25em;
  bottom: 2em;
  left:0;
  right:0
}

.workspace-inner {
  position:relative;
  width:100%;
  height: 100%;
}

menu > li {
  padding: 0 1rem;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin: 1px 0 0 0;
  cursor: pointer;
  height: 2.25rem;
  background-color: #ccc;
  line-height: 2.25rem;  
  border-radius: 1rem 1rem 0 0;
  background: linear-gradient(-180deg, white, #ccc);
}

menu > li.active {
  background: linear-gradient(-180deg, #aaa, #ccc);
  font-weight: bold;
}

.router-link-active {
  background-color: black;
  color: white;
}

.statusbar {
  position: absolute;
  height: 2em;
  bottom: 0;
  left:0;
  right: 0;
  background: #ccc;
  border-top: 1px solid black;
}

</style>
