<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { AssetGroup, AssetGroupLabel } from "@/core/asset_groups.ts";
import {server  } from '@/core/api.ts';
import type{ FileItem } from '@/core/api.ts';

const selectedFile = defineModel<FileItem>();
const select_model = ref<string>();
// Groups
const asset_groups = AssetGroupLabel;

defineExpose({
  reload: loadFiles
})

// Filtry
const filterType = ref(0);      // 0 = vše, 1 = něco, 2 = něco jiného (podle tvého enumu)
const filterSource = ref('');   // "" = vše, "orig", "user"



// Data
const files = ref<Record<string,FileItem> >({});
const loading = ref(false);
const error = ref<string | null>(null);


// Simulace fetch z backendu
async function fetchFilesFromBackend(type: number, source: string): Promise<FileItem[]> {
  loading.value = true;
  error.value = null;  
  try {
    const ddldata = await server.getDDLFiles(type, source);
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
  files.value = (await fetchFilesFromBackend(filterType.value, filterSource.value))
    .reduce((a:Record<string, FileItem>, b)=>{
      a[b.name] = b;
      return a;
    },{})
}

function selectFile(file: FileItem) {
  selectedFile.value = file;  
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

function updateSelectedFile (){
  if (selectedFile.value) {
    select_model.value = selectedFile.value.name    
  }
}

function updateSelectModel() {
  if (select_model.value && files.value) {
    selectedFile.value = {
        name: select_model.value,
        group: files.value[select_model.value].group,
        ovr: files.value[select_model.value].ovr,
    }
  }
}


watch([selectedFile], updateSelectedFile);
watch([select_model], updateSelectModel);
</script>

<template>
  <div class="flist">
    <div class="toolbar">
      <select v-model.number="filterType">        
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

    <select size="2" v-model="select_model" class="files">
      <option v-for="(file, key) in files" :key="key" :class="{ovr: file.ovr}">{{ file.name }}</option>
    </select>
  </div>
</template>

<style scoped>

.flist {
  width: 100%;
  height: 100%;
  position:relative;
}

.files {
  position: absolute;
  display:block;
  left:0;top:2em;right: 0;bottom: 0;
}

.files option.ovr {
  font-weight: bold;
  padding-left:0.5em;
}

.files option.ovr::before {
  content: "✏️";
  display: inline-block;
  width: 1.5em;
}

.files option {
  padding-left: 2em;
}

.toolbar > select, .toolbar > button {
  height: 2em;;
}
.toolbar >button {
  flex-grow: 1;
}
.toolbar {
  display:flex;  
}

</style>