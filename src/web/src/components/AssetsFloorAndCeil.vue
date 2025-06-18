<script lang="ts" setup>
import { createFloorCeil, t_points } from '@/core/geometry';
import { onMounted, ref, watch } from 'vue';
import CanvasView from './CanvasView.vue';
import { extractImageData, findQuantizationAndGeneratePalette, type ImageDataResult } from "@/core/image_manip";
import { PCX, PCXProfile } from '@/core/pcx';
import { ColorLUT } from '@/core/lut';
import { dosname_sanitize } from '@/core/dosname';
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';

const imgplaceholder = new URL('@/assets/noimage.svg', import.meta.url).href;

const tile1 = ref<string>(imgplaceholder);
const tile2 = ref<string>(imgplaceholder);
let tile1ImageData : ImageDataResult | null = null;
let tile2ImageData : ImageDataResult | null = null;

const emit = defineEmits<{
  (e: 'upload', name: string, prom: Promise<void>): void
}>();


const preview_canvas = ref<PCX>();
const save_as_name = ref<string>();
const cantGenerate = ref<boolean>(true);
const notGenerated = ref<boolean>(true);


onMounted(init);

function init() {
    console.log(t_points);
}


function tile_file_changed(event: Event, which: number) {
    const tfile = event.target as HTMLInputElement
    if (tfile.files?.length) {
        const file = tfile.files[0];
         if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    if (!which) {
                        tile1ImageData = await extractImageData(img);
                        tile1.value = img.src;                        
                    } else {
                        tile2ImageData = await extractImageData(img);
                        tile2.value = img.src;
                    }
                    cantGenerate.value = !tile1ImageData || !tile2ImageData;
                };            
                if (e.target && typeof e.target.result === 'string') {
                    img.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
 
        }
    }

}

async function finalize_image(imageData: ImageDataResult) {
    const pal = findQuantizationAndGeneratePalette(imageData, 253,128,256);
    const lut = new ColorLUT(pal, 6);
    const pcx = new PCX(imageData.width, imageData.height);
    pal.unshift([0,0,0]);
    pal.unshift([0,0,0]);            
    pcx.set_palete(pal);
    pcx.clear(0);
    pcx.convertImageData(imageData, lut, 2, 128, 255);
    preview_canvas.value = pcx;
    notGenerated.value = false;



}

async function generate_floor() {
    if (tile1ImageData && tile2ImageData) {
        const targetData :ImageDataResult = {
            width:640,height:199,data:new Uint8ClampedArray(640*480*4), colorSpace:"srgb"
        }        
        createFloorCeil(tile1ImageData, tile2ImageData, targetData, "floor");
        await finalize_image(targetData);
    }
}

async function generate_ceil() {
    if (tile1ImageData && tile2ImageData) {
        const targetData :ImageDataResult = {
            width:640,height:90,data:new Uint8ClampedArray(640*480*4), colorSpace:"srgb"
        }        
        createFloorCeil(tile1ImageData, tile2ImageData, targetData, "ceil");
        await finalize_image(targetData);
    }
}


function save_generated() {
    if (preview_canvas.value && save_as_name.value) {
        emit("upload",save_as_name.value, server.putDDLFile(save_as_name.value,
                                        preview_canvas.value.toArrayBuffer(),
                                        AssetGroup.WALLS));
    }
}

watch([save_as_name],()=>{
    if (save_as_name.value) {
        save_as_name.value = dosname_sanitize(save_as_name.value);
    }
});

</script>
<template>

<div>
    <div class="tiles">
        <div>
            <img :src="tile1">
            <input type="file" @change="event=>tile_file_changed(event,0)">
        </div>
        <div>
            <img :src="tile2">
            <input type="file" @change="event=>tile_file_changed(event,1)">
        </div>
    </div>
    <div class="button-panel"><button @click="generate_floor" :disabled="cantGenerate">Generate floor</button><button @click="generate_ceil" :disabled="cantGenerate">Generate ceil</button></div>        
    <div class="preview">
        <CanvasView :canvas="preview_canvas?preview_canvas.createCanvas(PCXProfile.default):null"/>        
    </div>
    <x-form>
        <label><span>Save as</span><input tyoe="text" v-model="save_as_name" maxlength="12"></label>
        <div class="button-panel"><button @click="save_generated" :disabled="notGenerated || (save_as_name?save_as_name.length:0) == 0">Save generated</button></div>                
    </x-form>
</div>

</template>


<style scoped>
.tiles {
    display:flex;
    justify-content: center;
    gap: 5vw;
}
.button-panel {
    padding: 10px;
    margin-top: 20px;
    display: flex;
    justify-content: center;
    gap: 1em;
}
.tiles >div > * {
    display:block;
}

x-form {
    width: 20em;
    margin: auto;
}

.tiles >div {
    border: 1px solid;
    width: 20vw;
    padding: 10px;
}

.tiles >div > img {
    width: 20vw;
    height: 20vw;
    border: 1px solid;;
    
}
</style>