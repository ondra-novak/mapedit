<script setup lang="ts">
import { server } from '@/core/api';
import { IconLib } from '@/core/IconLIB';
import { PCX, PCXProfile } from '@/core/pcx';
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import SkeldalImage from './SkeldalImage.vue';
import CanvasView from './CanvasView.vue';
import { findQuantizationAndGeneratePalette, type ImageDataResult } from '@/core/image_manip';
import { ColorLUT } from '@/core/lut';
import { AssetGroup } from '@/core/asset_groups';

const emit = defineEmits<{
  (e: 'upload', name: string, done?: Promise<any>): void
}>();


const icons = shallowRef<PCX[]>();
let libs_changed:boolean[]= [];


function lib_name(idx:number): string {
    return `IKONY${idx.toString().padStart(2, '0')}.LIB`;
}

async function load() {
    let idx = 0;
    try {
        //will exit as exception;
        while (true) {
            const name = lib_name(idx);
            const file = await server.getDDLFile(name);
            const lib = IconLib.fromArrayBuffer(file);
            if (!icons.value) {
                icons.value = [];
            }
            icons.value = [...icons.value, ...lib.icons];
            libs_changed.push(false);
            idx++;
        }
    } catch (e) {
        
    }
}

function init() {
    load();    

}

function erase_last() {
    if (icons.value) {
        const len = icons.value.length;
        if (len > 0) {            
            icons.value = icons.value.slice(0, len-1);
        }

    }
}

function replace(idx: number) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event: Event) => {
        const file = (input.files && input.files[0]) ? input.files[0] : null;
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 45;
            canvas.height = 55;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, 45, 55);
                const d = ctx.getImageData(0, 0, 45, 55); 
                const imgdata:ImageDataResult = {
                    width:d.width,
                    height:d.height,
                    data:d.data,
                    colorSpace:"srgb"
                };
                const pal = findQuantizationAndGeneratePalette([imgdata],254,128,255);
                const lut = new ColorLUT(pal, 6);
                const pcx = new PCX(imgdata.width, imgdata.height);
                pal.unshift([0,0,0]);
                pcx.set_palete(pal);
                pcx.clear(0);
                pcx.convertImageData(imgdata, lut,1, 128, 255);            
                const cur = icons.value || [];
                icons.value = [...cur.slice(0,idx),pcx,...cur.slice(idx+1)];
                libs_changed[Math.floor(idx/18)] = true;                
            }
        };
        img.src = URL.createObjectURL(file);
    };
    input.click();
}

async function save() {
    const icns = icons.value;
    if (icns) {
        const changed = libs_changed;
        let idx = 0;
        while (true) {
            const start = 18*idx;
            const end = Math.min(18*(idx+1),icns.length);
            if (start >= end) break;
            if (changed[idx]) {
                const slc = icns.slice(start,end);
                while (slc.length<18) {
                    slc.push(new PCX(45,55));
                }
                const lib = new IconLib(slc);
                const abuff = lib.toArrayBuffer();
                const name = lib_name(idx);
                const prom = server.putDDLFile(name, abuff,AssetGroup.ITEMS);
                emit("upload", name, prom);
            }
            ++idx;
        }
        {
            const name = lib_name(idx);
            const prom = server.deleteDDLFile(name);
            emit("upload", name, prom);
        }

    }

}

function on_exit() {
    save();
}

onMounted(init);

onUnmounted(on_exit);

</script>


<template>
    <div class="grid">
    <div v-for="(i, index) of icons" :key = "index">
        <div>
        <CanvasView class="icon-preview":canvas="i.createCanvas(PCXProfile.transp0)" @click="replace(index)"/>
        <span>{{ index }}</span>
        </div>
    </div>
    <div>
        <div class="icon-preview" @click="replace((icons || []).length)">
        <div class="plus"></div>
        </div>
    </div>
    <div>
        <div class="minus" @click="erase_last"></div>
    </div>
    </div>
    <div class="note">Each icon is a 256-color image with transparency, sized 45x55 pixels.</div>
</template>
<style scoped>
.grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin: 1em;
    padding: 1em;
    background-color: rgb(211, 204, 189);
}
.grid .icon-preview {
    display: block;
    border: 5px inset rgb(175, 168, 153);
    background: linear-gradient(121deg, black, #0000005e);
    cursor: pointer;
    width: 45px;
    height: 55px;
}


.grid .plus , .grid .minus {
    position: relative;
    width: 45px;
    height: 55px;
    box-sizing: content-box;    
}
.grid .plus::before{
    content: "+";
    font-size: 30px;
    text-align: center;
    width: 35px;
    background-color: #00800099;
    border-radius: 35px;
    height: 35px;
    font-weight: bold;
    color: yellow;
    display:block;
    position: absolute;
    top: 5px;
    left: 5px;
    box-shadow: 0px 0px black;
}
.grid .minus::before{
    content: "\2190";
    font-size: 25px;
    text-align: center;
    width: 35px;
    background-color: rgb(216, 168, 168);
    border-radius: 5px;
    height: 35px;
    font-weight: bold;
    color: darkred;
    display:block;
    position: absolute;
    top: 10px;
    left: 5px;
    box-shadow: 0px 0px black;
    cursor: pointer;
}



</style>