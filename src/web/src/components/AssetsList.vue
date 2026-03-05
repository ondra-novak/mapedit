<script setup lang="ts">
import { ref, watch, onMounted, computed, triggerRef, onUnmounted } from 'vue';
import { AssetGroup, AssetGroupLabel,  groupFromNumber, type AssetGroupType } from "@/core/asset_groups.ts";
import {server  } from '@/core/api.ts';
import type{ FileItem, ModifiedFileNotify } from '@/core/api.ts';
import type { WsRpcResult } from '@/core/wsrpc';

const model = defineModel<FileItem>();
const select_model = ref<string>();
const opened_groups = ref(new Set<AssetGroupType>);
const filter_by_mine = ref(false);
const srch_filter = ref("");

const files_per_group = ref(new Map<AssetGroupType, FileItem[]>);

function update_list(n:ModifiedFileNotify) {
  const ng = n.group as AssetGroupType;
  for (const [g, lst] of files_per_group.value) {
      const idx = lst.findIndex(v=>v.name.toUpperCase() == n.name.toUpperCase());
      if (idx >= 0) {
          lst.splice(idx,1);
      }
  }
  let new_grp = files_per_group.value.get(ng);
  if (!new_grp) {
      new_grp = [];
      files_per_group.value.set(ng, new_grp);
  }
  const idx = new_grp.findIndex(v=>v.name.localeCompare(n.name) > 0);
  const nitm = {group: ng, name: n.name, ovr:true};
  if (idx) {
      new_grp.splice(idx,0, nitm);
  } else {
      new_grp.push(nitm);
  }
  triggerRef(files_per_group);
}


function update_files(data: WsRpcResult) {
    update_list(data.data as ModifiedFileNotify);
}

async function reload_files() {
    const all_files = await server.getDDLFiles(null, filter_by_mine.value?"user":"");
    const new_list  = new Map<AssetGroupType, FileItem[]>();
    all_files.files.forEach(f=>{
        let lst = new_list.get(f.group);
        if (!lst) new_list.set(f.group, lst = []);
        lst.push(f);
    })
    files_per_group.value = new_list;
    const m = model.value;
    if (m) {
        const lst  = new_list.get(m.group);
        if (!lst) model.value = undefined;
        else {
            const idx = lst.find(x=>x.name ==m.name);
            if (!idx) model.value = undefined;
        }
    }
}

defineExpose({
  reload: reload_files
})

onMounted(()=>{
    reload_files();
    server.on("modified", update_files);
});

onUnmounted(()=>{
    server.off("modified", update_files);
});

const group_order = [
AssetGroup.WALLS, 
AssetGroup.ITEMS, 
AssetGroup.ENEMIES, 
AssetGroup.DIALOGS, 
AssetGroup.UI, 
AssetGroup.SOUNDS, 
AssetGroup.MUSIC, 
AssetGroup.MAPS, 
AssetGroup.FONTS, 
AssetGroup.UNKNOWN];

const ordered_list = computed(()=>{
    const lst : AssetGroupType[]= [];
    for (const v of group_order) {
      if (files_per_group.value.has(v)) {
        lst.push(v);
      }
    }
    return lst;
})

function open_close(g:AssetGroupType)  {
    if (opened_groups.value.has(g)) {
      opened_groups.value.delete(g);
    } else {
      opened_groups.value.add(g);
    }
    triggerRef(ordered_list);
}


const active_element = ref<Element>();

watch(active_element, ()=>{
  if (active_element.value) {
    active_element.value.scrollIntoView({behavior:'smooth', block:'nearest'});
  }
});
watch(filter_by_mine,()=>{
    reload_files();
})

function key_control(e:KeyboardEvent ) {    
    const m = model.value;
    if (!m) return;
    const g = files_per_group.value.get(m.group);
    if (!g) return;
    let idx = g.findIndex(x=>x.name == m.name);    
    if (idx < 0) return;
    if (e.key == "ArrowUp") {
        idx = Math.max(idx-1,0);
        model.value = g[idx];
        e.preventDefault();
        e.stopPropagation();
    } else if (e.key == "ArrowDown"){
        idx = Math.min(idx+1,g.length-1);
        model.value = g[idx];
        e.preventDefault();
        e.stopPropagation();
    }
}

function filter_group(v: AssetGroupType) {
    const lst = files_per_group.value.get(v);
    if (!lst) return [] as FileItem[];
    const src = srch_filter.value.toUpperCase();
    return lst.filter(x=>x.name.toUpperCase().indexOf(src) >= 0);
}

</script>
<template>
<div v-bind="$attrs" tabindex="1" @keydown="(e:KeyboardEvent)=>key_control(e)">
  <div class="tlb">
    <div :class="{pressed: filter_by_mine}" title="Show only my files" @click="filter_by_mine = !filter_by_mine"></div>
    <input type="search" v-model="srch_filter" :placeholder="filter_by_mine?'Search my files':'Search files'">
  </div>
  <div class="tree-list" :key="srch_filter">
    <div v-for="v of ordered_list" :key="v" class="tree-node" :class="{opened: opened_groups.has(v)}" >
      <div @click="open_close(v)"> {{ AssetGroupLabel[v] }}</div>
      <div v-if="opened_groups.has(v)">
        <div class="nothing">
          <div v-for="l of filter_group(v)" 
              :key="l.name" :class="{modified: l.ovr,active: l.name == model?.name}" 
                :ref="(el)=>{ if (el && l.name == model?.name) active_element = el as Element}"
                @click="model=l"> {{ l.name }}</div>
      </div>
      </div>
    </div>
  </div>
</div>

</template>
<style lang="css" scoped>

.tree-node {padding: 0.2rem;cursor: pointer;}
.tree-node > *:first-child{ font-weight: bold;;}
.active {
  background-color: wheat;
}
.tree-node > *:nth-child(2) {
  font-style: italic;
  color: #666;
}
.modified {
  font-style: normal !important;
  color: black;
}
.tlb {
  position: sticky;
  top: 0;
  height: 2rem;
  border: 1px solid;
  display: flex;
  z-index: 1;
}
.tlb > input{
  flex-grow: 1;
  width: 1rem;
}
.tlb > div {
  width: 2rem;
  text-align: center;
  background-color: #ccc;
  position: relative;
}
.tlb > div::before {
  content: "✏️";
  display: block;
  position: absolute;
  inset: 2px;
  padding: 2px;
  width: fit-content;
  height: fit-content;
  margin: auto;
  border: 1px outset;
  cursor: pointer;
}

.tlb > div.pressed::before {
  border: 1px inset;
  background-color: #aaa;
}

.nothing:empty::before {
    content: "No files match the filter";
}
</style>
