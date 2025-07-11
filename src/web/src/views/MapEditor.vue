<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { MapFile, RawMapFile } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import MissingFiles from '@/components/MissingFiles.vue';
import {MapContainer, MapDraw } from '@/core/map_draw';
import type { Document } from '@/utils/document';
import  globalState from '@/utils/global';

import svg_pointer from '@/assets/toolbar/pointer.svg'
import svg_pencil from '@/assets/toolbar/pencil.svg'
import svg_eraser from '@/assets/toolbar/eraser.svg'
import svg_chest from '@/assets/toolbar/chest.svg'
import svg_enemy from '@/assets/toolbar/enemy.svg'
import PalleteEditor from '@/components/PalleteEditor.vue';

const EditMode = {
    Edit:0,
    Draw:1,
    Erase:2,
    Items:3,
    Enemies:4
} as const;

const mapview = ref<HTMLElement>();
const mapdraw :MapDraw=  new MapDraw();
const curmap = shallowRef<MapFile>(new MapFile());
const settings = reactive(globalState("mapview_settings",{
    curlevel : 0,
    edit_mode: EditMode.Edit as number,
}));
const mapcontainer = globalState("mapcontainer",()=>new MapContainer);
const layers_opened = ref(false);

const cur_palettes = reactive(globalState("palette", {
    wall:"",floor:"",ceil:"",arcs:""
}));




const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"SOUND.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"ENEMY.DAT",ovr:true}
];

function begin_edit() {
    const new_rev =StatusBar.cur_map.begin_edit();
    curmap.value = new_rev;
    return new_rev;
}

function redraw() {
    mapdraw.draw(curmap.value,settings.curlevel);
    mapcontainer.set_map(mapdraw);    
}

const layers= reactive(globalState("layers",{
    sector_basic: true,
    sector_features: true,
    walls: true,
    arcs: true,
    actions: true,
    arrows: true,
    ext_arrows: true,
    enemies: true,
    items: true
}));

watch([()=>settings.curlevel, curmap], ()=>{
    redraw();
});

function onMapLoaded() {

    function reload(doc: Document<MapFile>) {
        curmap.value = doc.get_current();
        const start = curmap.value.info.start_sector;
        settings.curlevel = curmap.value.sectors[start].level;
        redraw();
        mapcontainer.zoom_reset();
    }

    StatusBar.registerSaveAndRevert(()=>{
        console.log("save");
    }, async ()=>{
        const doc = await StatusBar.reloadMap();
        reload(doc);
    });    
    
    reload(StatusBar.cur_map);
}

async function init() {
    StatusBar.onMapOpen(onMapLoaded);
    if (mapview.value)     {
        mapcontainer.add_to_DOM(mapview.value);        
    }    
    if (!StatusBar.cur_map_name.value) {
        StatusBar.openMapDialog();
        return;
    } else {
        curmap.value = StatusBar.cur_map.get_current();
    }
    redraw();

}

function resetFloor() {
    const start = curmap.value.info.start_sector
    const s = curmap.value.sectors[start] || curmap.value.sectors[1];    
    settings.curlevel = s?.level || 0;
}

function onCreateNew() {

}

function onImported() {
    
}

const edit_modes = [
[svg_pointer,"Edit"],
[svg_pencil,"Draw"],
[svg_eraser,"Erase"],
[svg_chest,"Items/Loot"],
[svg_enemy,"Enemies"],
]

onMounted(init);
onUnmounted(StatusBar.onFinalSave)

</script>

<template>

<x-workspace>
<div class="toolbar">
    <div :class="{active: layers_opened}" @click = "layers_opened = !layers_opened"><img src="@/assets/toolbar/layers.svg"></div>
    <div v-for="(v,idx) in edit_modes" @click="settings.edit_mode = idx" :class="{active: settings.edit_mode == idx, sep: idx == 0}" :title="v[1]"><img :src="v[0]"></div>
    <div class="sep" @click="settings.curlevel++"><img src="@/assets/toolbar/go_up.svg"></div>
    <div @click="resetFloor"><img src="@/assets/toolbar/floor_reset.svg"></div>
    <div @click="settings.curlevel--"><img src="@/assets/toolbar/go_down.svg"></div>
    <div class="sep" @click="mapcontainer.zoom_rel(+ 0.2)"><img src="@/assets/toolbar/zoom_in.svg"></div>
    <div @click="mapcontainer.zoom_reset()"><img src="@/assets/toolbar/zoom_reset.svg"></div>
    <div @click="mapcontainer.zoom_rel(-0.2)"><img src="@/assets/toolbar/zoom_out.svg"></div>
    <div class="sep"><img src="@/assets/toolbar/undo.svg"></div>
    <div><img src="@/assets/toolbar/redo.svg"></div>
</div>
<div class="middle">
<div ref="mapview" class="mapcont" :class="{disable_sector_basic: !layers.sector_basic,
                            disable_sector_features: !layers.sector_features,
                            disable_walls: !layers.walls,
                            disable_arc: !layers.arcs,
                            disable_actions: !layers.actions,
                            disable_arrows: !layers.arrows,
                            disable_ext_arrows: !layers.ext_arrows,
                            disable_enemies: !layers.enemies,
                            disable_items:!layers.items
                            }"></div>
</div>                            
<div class="right">
    <div class="palette">
        <div><span>Wall</span><PalleteEditor :palette="curmap.wall_palette" :listview="true" v-model="cur_palettes.wall"></PalleteEditor></div>
        <div><span>Arc</span><PalleteEditor :palette="curmap.arc_palette" :listview="true" v-model="cur_palettes.arcs"></PalleteEditor></div>
        <div><span>Floor</span><PalleteEditor :palette="curmap.floor_pallete" :listview="true" v-model="cur_palettes.floor"></PalleteEditor></div>
        <div><span>Ceil</span><PalleteEditor :palette="curmap.ceil_palette" :listview="true" v-model="cur_palettes.ceil"></PalleteEditor></div>
    </div>
</div>
<div class="layers" v-if="layers_opened">
    <button class="close" @click="layers_opened=false"></button>
    <x-form>
        <label><input type="checkbox" v-model="layers.sector_basic"><span>Sector type</span></label>
        <label><input type="checkbox" v-model="layers.sector_features"><span>Sector features</span></label>
        <label><input type="checkbox" v-model="layers.walls"><span>Walls</span></label>
        <label><input type="checkbox" v-model="layers.arcs"><span>Arcs</span></label>
        <label><input type="checkbox" v-model="layers.actions"><span>Actions</span></label>
        <label><input type="checkbox" v-model="layers.arrows"><span>Connections</span></label>
        <label><input type="checkbox" v-model="layers.ext_arrows"><span>External Cnnections</span></label>
        <label><input type="checkbox" v-model="layers.enemies"><span>Enemies</span></label>
        <label><input type="checkbox" v-model="layers.items"><span>Items</span></label>
    </x-form>
</div>
</x-workspace>

<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>


<style lang="css" scoped>
x-workspace {
    display: flex;
    align-items: stretch;
    height: 100%;
}
.toolbar {
    display: flex;
    flex-direction: column;
    background-color: #aaa;
    width: 3em;
    gap:1px;
}
.toolbar > * {
    height: 1.5rem;
    text-align: center;
    padding: 0.25rem;
    background: linear-gradient(90deg, white, #ccc);
    border-radius: 2rem 0 0 2rem;
    cursor: pointer;
}

.toolbar > *.active,.toolbar > *:active {
    background: linear-gradient(90deg, #aaa, #ccc);
}
.toolbar > *:active  img {
    transform: translateX(-1px);
}

.toolbar > *.sep {
    margin-top: 4px;
}

.toolbar   img {
    height: 1.5rem;
}
.middle {
    flex-grow: 1;
    
}

.layers {
    position: absolute;
    border:1px solid;
    background-color: #eee;
    padding: 2em 1em 1em 1em;
    box-shadow: 3px 3px 5px black;
    left: 3.1rem;
}

.mapcont {
    height: 100%;
}

.right {
    width: 20rem;

}

.right .palette {
    display: flex;
    flex-direction: column;
    height: 100%;
}


.right .palette > div {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    text-align: center;
}




</style>