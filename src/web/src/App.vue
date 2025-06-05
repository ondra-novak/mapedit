<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
<header>
  <nav>
    <RouterLink to="/maps">Maps</RouterLink>
    <RouterLink to="/items">Items</RouterLink>
    <RouterLink to="/enemies">Enemies</RouterLink>
    <RouterLink to="/assets">Assets manager</RouterLink>
  </nav>
</header>
<RouterView />
</template>

<style scoped>
header nav {
  display: flex;
  gap: 2em;
}
</style>
