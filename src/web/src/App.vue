<script setup lang="ts">
import StatusBar from './components/StatusBar.vue'
import MessageBoxComponent from './utils/messageBoxComponent.vue';
import MissingFiles from './components/tools/MissingFiles.vue';
import ProjectSelectorDlg from './components/ProjectSelectorDlg.vue';
import ServerConfigDlg from './components/GameClientCfgDlg.vue';
import { onMounted, ref } from 'vue';
import BasicInfo from './views/BasicInfo.vue';
import MapEditor from './views/MapEditor.vue';
import AssetsManager from './views/AssetsManager.vue';
import ItemsEditor from './views/ItemsEditor.vue';
import EnemiesEditor from './views/EnemiesEditor.vue';
import SpellsEditor from './views/SpellsEditor.vue';
import CharacterEditor from './views/CharacterEditor.vue';
import ShopsEditor from './views/ShopsEditor.vue';
import { mainMenuControl, type EditorRef } from './core/services';
import DialogsEditor from './views/DialogsEditor.vue';
import TranslationTools from './views/TranslationTools.vue';
import type ProgressBar from './components/tools/progressBar';
import ProgressBarView from './components/tools/ProgressBarView.vue';

const version = import.meta.env.VITE_APP_VERSION;

const active_item = ref<number>(0);


const items : [number,string][]= [
  [1,"General"],
  [2,"Assets"],
  [3,"Map"],
  [4,"Items"],
  [5,"Enemies"],
  [6,"Spells"],
  [7,"Characters"],
  [8,"Shops" ],
  [9,"Dialogs"],
  [10,"Translation"]
] as const;

function open_editor(id:EditorRef) {
  active_item.value = id;  
}

onMounted(()=>{
  mainMenuControl.set_instance({
    open_editor
  });
});

</script>

<template>
<div class="screen">
<menu>
  <li v-for="n of items" @click="active_item = n[0]" :class="{active: active_item == n[0]}"> {{ n[1] }}</li>
</menu>
<div class="workspace-outer">
  <div class="workspace-inner">
    <x-workspace v-of="active_item == 0"><
      <div class="center">
        <div><img src="@/assets/logo.png"></div>
        <div>Alpa version: {{ version }}</div>
      </div>
    </x-workspace>
    <div v-if="active_item == 1"><BasicInfo  /></div>
    <div><AssetsManager :active="active_item == 2"/></div>
    <div><MapEditor :active="active_item == 3"/></div>
    <div v-if="active_item == 4"><ItemsEditor /></div>
    <div v-if="active_item == 5"><EnemiesEditor /></div>
    <div v-if="active_item == 6"><SpellsEditor /></div>
    <div v-if="active_item == 7"><CharacterEditor /></div>
    <div v-if="active_item == 8"><ShopsEditor /></div>
    <div><DialogsEditor :active="active_item == 9"/></div>
    <div v-if="active_item == 10"><TranslationTools/></div>
  </div>
</div>
<div class="statusbar">  
  <StatusBar />
</div>
</div>
<MessageBoxComponent/>
<ProgressBarView />
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

.center {
  text-align:center;
}
</style>
