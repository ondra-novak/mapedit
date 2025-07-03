<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { MapFile, RawMapFile } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import MissingFiles from '@/components/MissingFiles.vue';

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
    console.log(m);
    const bf = m.saveToArrayBuffer();
    const rm2 = new RawMapFile();
    rm2.parseMap(bf);
    const m2 = MapFile.from(rm);
    console.log(m2);
}



async function init() {
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

</x-workspace>

<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>


<style lang="css" scoped>



</style>