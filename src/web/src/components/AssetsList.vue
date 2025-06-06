<script setup lang="ts">
import { ref, watch, onMounted, computed, defineEmits } from 'vue';
import { AssetGroups } from "@/core/asset_groups.ts";
import {ApiClient  } from '@/core/api.ts';
import type{ DDLFiles, FileItem } from '@/core/api.ts';

const emit = defineEmits(['update:selected']);

// Groups
const asset_groups = AssetGroups;

// Filtry
const filterType = ref(0);      // 0 = vše, 1 = něco, 2 = něco jiného (podle tvého enumu)
const filterSource = ref('');   // "" = vše, "orig", "user"

const api = new ApiClient ();

// Data
const files = ref<FileItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const selectedFile = ref<FileItem | null>(null);

// Simulace fetch z backendu
async function fetchFilesFromBackend(type: number, source: string): Promise<FileItem[]> {
  loading.value = true;
  error.value = null;  
  try {
    const ddldata = await api.getDDLFiles(type, source);
    // mock data - ve skutečnosti to přijde z backendu podle filtru
    return ddldata.files;
  } catch (e) {
    error.value = 'Nepodařilo se načíst soubory';
    return [];
  } finally {
    loading.value = false;
  }
}

async function loadFiles() {
  files.value = await fetchFilesFromBackend(filterType.value, filterSource.value);
}

function selectFile(file: FileItem) {
  selectedFile.value = file;
  emit('update:selected', { name: file.name, type: file.type });
}

// Na začátku načti data
onMounted(() => {
  loadFiles();
});

const getRowClass = computed(()=> {
  return (file:FileItem) => {
    return {
      selected: file.name == selectedFile.value?.name,
      ovr: file.ovr,
    }
  }
});

// Sleduj změny filtrů a načti soubory znovu
watch([filterType, filterSource], () => {
  loadFiles();
});
</script>

<template>
  <div class="flist">
    <div class="toolbar">
      <select v-model="filterType">        
        <option :value="0">All</option>
        <option v-for="(label, key) of asset_groups" :key="key" :value="key">{{ label }}</option>
      </select>

      <select v-model="filterSource">
        <option value="">All</option>
        <option value="orig">Original</option>
        <option value="user">User</option>
      </select>

      <button @click="loadFiles" :disabled="loading">R</button>
    </div>

    <div v-if="loading">Načítám soubory...</div>
    <div v-if="error" style="color: red">{{ error }}</div>

    <div class="content">
      <div v-for="file in files" :key="file.name" @click="selectFile(file)" :class="getRowClass(file)">{{ file.name }}</div>
    </div>
  </div>
</template>

<style scoped>


.flist {
    background-color: white;;
    overflow: auto;
    height: 100%;
    cursor: pointer;
}
.toolbar {
    background-color: gainsboro;
    position: sticky;
    top: 0;
}

.flist .content div {
    padding: 0 0.5em;
}
.flist .selected {
    background-color: blue;
    color: white;
}

</style>