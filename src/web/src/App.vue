<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import StatusBar from './views/StatusBar.vue';
import MessageBoxComponent from './utils/messageBoxComponent.vue';
</script>

<template>
<div class="screen">
<nav>
  <RouterLink to="/basic">Basic info</RouterLink>
  <RouterLink to="/assets">Assets manager</RouterLink>
  <RouterLink to="/maps">Maps</RouterLink>
  <RouterLink to="/items">Items</RouterLink>
  <RouterLink to="/spells">Spells</RouterLink>
  <RouterLink to="/enemies">Enemies</RouterLink>
  <RouterLink to="/characters">Characters</RouterLink>
  <RouterLink to="/dialogs">Dialogs</RouterLink>
  <RouterLink to="/shops">Shops</RouterLink>
  <RouterLink to="/facts">Facts</RouterLink>
  <RouterLink to="/texts">Book/Texts</RouterLink>    
  <RouterLink to="/test">Test space</RouterLink>    
</nav>
<div class="workspace-outer">
  <div class="workspace-inner">
    <RouterView />
  </div>
</div>
<div class="statusbar">  
  <StatusBar />
</div>
</div>
<MessageBoxComponent/>
</template>


<style scoped>

.screen {
  height:  100vh;
  width: 100vw;
}


.screen > nav {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  display: flex;
  background-color: white;
  border: 1px solid;  
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

nav > a {
  border-right: 1px solid black;
  padding: 0.5em 0;
  flex-grow: 1;
  text-align: center;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
