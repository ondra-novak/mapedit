<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server } from '@/core/api';
import { MapFile, RawMapFile } from '@/core/map_structs';





async function reload() {
    const buff = await server.getDDLFile("SKRETI.MAP");
    const rm = new RawMapFile();
    rm.parseMap(buff);
    const m = MapFile.from(rm);
    console.log(m);
}



async function init() {
    StatusBar.registerSaveAndRevert(()=>{
        console.log("save");
    }, async ()=>{
       return await reload();
    });
    reload();
}


onMounted(init);
onUnmounted(StatusBar.onFinalSave)


</script>

<template>
<x-workspace>

</x-workspace>
</template>


<style lang="css" scoped>



</style>