<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
<workspace>
<header>
  <nav>
    <RouterLink to="/assets">Assets manager</RouterLink>
    <RouterLink to="/maps">Maps</RouterLink>
    <RouterLink to="/items">Items</RouterLink>
    <RouterLink to="/enemies">Enemies</RouterLink>
    <RouterLink to="/characters">Characters</RouterLink>
    <RouterLink to="/dialogs">Dialogs</RouterLink>
    <RouterLink to="/facts">Facts</RouterLink>
  </nav>
</header>
<RouterView />
</workspace>
</template>


<style scoped>

workspace {
  position: relative;
  height: 100vh;
  padding-top: 2.25em;
  box-sizing: border-box;
  display: block;
}

header nav {
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  display: flex;
  background-color: white;
  border: 1px solid;  
}

nav > a {
  border-right: 1px solid black;
  padding: 0.5em 2em;
}

.router-link-active {
  background-color: black;
  color: white;
}


</style>
