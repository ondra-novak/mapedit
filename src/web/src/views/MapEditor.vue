<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { MapFile, RawMapFile } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import MissingFiles from '@/components/MissingFiles.vue';
import { MapContainer, MapDraw } from '@/core/map_draw';

const mapview = ref<HTMLElement>();
const mapdraw :MapDraw=  new MapDraw();
let mapcontainer: MapContainer | null = null;

const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"SOUND.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"ENEMY.DAT",ovr:true}
];




async function reload() {
    const buff = await server.getDDLFile("SKRETI.MAP");
    const rm = new RawMapFile();
    rm.parseMap(buff);
    const m = MapFile.from(rm);
    mapdraw.draw(m,0);
    if (mapcontainer) {        
        mapcontainer.set_map(mapdraw);
    }

}



async function init() {
    if (mapview.value)     {
        mapcontainer = new MapContainer(mapview.value);
    }
    StatusBar.registerSaveAndRevert(()=>{
        console.log("save");
    }, async ()=>{
       return await reload();
    });
    reload();
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