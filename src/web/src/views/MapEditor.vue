<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { MapFile, RawMapFile } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import MissingFiles from '@/components/MissingFiles.vue';
import { MapContainer, MapDraw } from '@/core/map_draw';
import type { Document } from '@/utils/document';

const mapview = ref<HTMLElement>();
const mapdraw :MapDraw=  new MapDraw();
const curmap = shallowRef<MapFile>(new MapFile());
const curlevel = ref<number>(0);
let mapcontainer: MapContainer | null = null;

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
    if (mapcontainer) {        
        mapdraw.draw(curmap.value,curlevel.value);
        mapcontainer.set_map(mapdraw);
    }
}

const layers= reactive({
    sector_basic: true,
    sector_features: true,
    walls: true,
    arcs: true,
    actions: true,
    arrows: true,
    enemies: true,
    items: true
})

watch([curlevel, curmap], ()=>{
    redraw();
});

function onMapLoaded() {

    function reload(doc: Document<MapFile>) {
        curmap.value = doc.get_current();
        const start = curmap.value.info.start_sector;
        curlevel.value = curmap.value.sectors[start].level;
        redraw();
        mapcontainer?.center();
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
        mapcontainer = new MapContainer(mapview.value);
    }    
    if (!StatusBar.cur_map_name.value) {
        StatusBar.openMapDialog();
        return;
    }
    

    
}

function onCreateNew() {

}

function onImported() {
    reload();
}

onMounted(init);
onUnmounted(StatusBar.onFinalSave)

</script>

<template>

<x-workspace>
<div class="toolbar">
    <div>Draw</div>
    <div>Erase</div>
    <div>Edit</div>
    <div>Items</div>
    <div>Enemies</div>
</div>
<div class="layers">
    
</div>


<div ref="mapview" class="mapview"></div>
</x-workspace>

<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>


<style lang="css" scoped>

.mapview {
    width: 800px;
    height: 600px;
    border: 1px solid;
}


</style>