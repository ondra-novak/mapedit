<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar from '@/core/status_bar_control';
import { humanDataFromArrayBuffer, type THuman } from '@/core/character_structs';
import { PCX, PCXProfile } from '@/core/pcx';

const missing_files : FileItem[] = [
    {name:"POSTAVY.DAT",group:AssetGroup.MAPS,ovr:true},
    {name:"ITEMS.DAT",group:AssetGroup.MAPS,ovr:true},
];

const postavy = ref<THuman[]>([]);
const selected = ref<number>();


function init() {
    function reload() {
        server.getDDLFile("POSTAVY.DAT").then(buff=>{
            postavy.value = humanDataFromArrayBuffer(buff).characters;
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

const portraits = ref<HTMLElement[]>([]);
const portrait_cache =new  Map<number, HTMLCanvasElement>();

function reload_portraits() {
    if (portraits.value) {
        portraits.value.forEach(async (el:HTMLElement)=>{
            const sx = el.dataset.xicht;
            if (!sx) return;
            const xicht = parseInt(sx);
            if (xicht ===undefined || isNaN(xicht)) return;
            let canvas : HTMLCanvasElement| null= null;
            if (!portrait_cache.has(xicht)) {

                try {
                    const img = PCX.fromArrayBuffer(await server.getDDLFile(`XICHT${xicht.toString(16).toUpperCase().padStart(2, '0')}.PCX`));
                    canvas = img.createCanvas(PCXProfile.default);
                    portrait_cache.set(xicht, canvas);
                } catch (e) {
                    return;
                }

            } else {
                canvas = portrait_cache.get(xicht) as HTMLCanvasElement;
            }
            el.innerHTML = '';
            el.appendChild(canvas)
        })
    }
}


watch(portraits, reload_portraits,{deep:true});

</script>

<template>
    <x-workspace>
    <div class="top-panel">
        <div v-for="(p,idx) of postavy" :key="idx" @click="selected = idx" :class="{selected: selected == idx}">
            <div class="portrait" :data-xicht="p.xicht" ref="portraits">

            </div>
            <div class="desc">
                {{ p.jmeno }}
            </div>          
        </div>
        <div>
            <div class="portrait add" >

            </div>
            <div>
                ...
            </div>
        </div>
    </div>
    </x-workspace>


<MissingFiles :files="missing_files"></MissingFiles>

</template>

<style lang="css" scoped>

.portrait {
    height: 75px;
    width: 54px;
    box-sizing: border-box;
    overflow: hidden;
    display: inline-block;
    line-height: 75px;
}
.portrait.add::before {
    content: "+";
    display: inline-block;
    vertical-align: middle;
    font-size: 45px;
    line-height: 45px;
    background-color: green;
    color: #ddd;
    width: 45px;
    height: 45px;
    border-radius: 45px;
}
.top-panel {
    display: flex;
    padding: 0.5rem;
    justify-content: space-evenly;
    text-align: center;
    border-bottom: 1px solid;

}
.top-panel > div {
    cursor: pointer;
    border: 1px solid;
    padding: 0.5rem;
    background-color: rgb(247, 238, 224);

}
.top-panel > div:hover {
    background-color: #ffffff;
}

.top-panel > div.selected {
    background-color: rgb(69, 81, 148);
    color: white;
}

</style>