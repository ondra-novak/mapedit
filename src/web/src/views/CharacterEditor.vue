<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { onMounted, onUnmounted, ref } from 'vue';
import StatusBar from '@/core/status_bar_control';
import { humanDataFromArrayBuffer, type THuman } from '@/core/character_structs';

const missing_files : FileItem[] = [
    {name:"POSTAVY.DAT",group:AssetGroup.MAPS,ovr:true},
    {name:"ITEMS.DAT",group:AssetGroup.MAPS,ovr:true},
];

const postavy = ref<THuman[]>([]);


function init() {
    function reload() {
        server.getDDLFile("POSTAVY.DAT").then(buff=>{
            postavy.value = humanDataFromArrayBuffer(buff);
            StatusBar.setChangedFlag(false);
            console.log(postavy.value);
        })
    }
    
    StatusBar.registerSaveAndRevert(()=>{
        console.log("save");
    }, () => {
        reload();
    });
    reload();
}

onMounted(init);
onUnmounted(StatusBar.onFinalSave);

</script>

<template>
<MissingFiles :files="missing_files"></MissingFiles>

</template>

<style lang="css" scoped>



</style>