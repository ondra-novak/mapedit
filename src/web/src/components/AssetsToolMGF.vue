<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import CanvasView from './CanvasView.vue';
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { readFileToArrayBuffer, readFileToImage } from '@/core/read_file';
import { findQuantizationAndGeneratePalette } from '@/core/image_manip';
import { ColorLUT } from '@/core/lut';
import { PCX } from '@/core/pcx';
import { dosname_sanitize } from '@/core/dosname';

const MGF_Action = {
    "MGIF_EMPTY":  0,
    "MGIF_LZW":    1,
    "MGIF_DELTA":  2,
    "MGIF_PAL":    3,
    "MGIF_SOUND":  4,
    "MGIF_TEXT":   5,
    "MGIF_COPY":   6,
    "MGIF_SINIT":  7,
} as const;


const emit = defineEmits<{
  (e: 'upload', name: string): void
}>();


const filename = defineModel<string | null>();
const canvas = ref<HTMLCanvasElement>(document.createElement("Canvas") as HTMLCanvasElement);

type RGBA = number[];

let animation = new ArrayBuffer();
let animation_pos = 0;
let intnum :NodeJS.Timeout;
let palette : RGBA[] = new Array(256);

function updatePalette(frame: ArrayBuffer) {
    let c = new Uint16Array(frame);
    palette.fill([0,0,0],0,255);
    c.forEach((w:number,idx:number)=>{
        palette[idx] = [
        ((w >> 7) & 0xF8) | ((w >> 12) & 0x7),
        ((w >> 2) & 0xF8) | ((w >> 7) & 0x7), 
        ((w << 3) & 0xF8) | ((w >> 2) & 0x7),
        255
    ]});   
    palette[0][3] = 0; 

}

function copyFrameToCanvas(frame: ArrayBuffer) {
    const img = new ImageData(320,180, {colorSpace:"srgb"});    
    let c = new Uint8Array(frame);
    c.forEach((v, idx)=>{
        const col = palette[v];
        img.data[idx*4] = col[0];
        img.data[idx*4+1] = col[1];
        img.data[idx*4+2] = col[2];
        img.data[idx*4+3] = col[3];
    });
    const ctx =canvas.value.getContext("2d",{ willReadFrequently: true });
    if (!ctx) return;
    ctx.putImageData(img, 0,0 );
}

function updateCanvasByDelta(frame: ArrayBuffer) {
    const ctx =canvas.value.getContext("2d",{ willReadFrequently: true });
    if (!ctx) return;
    const img = ctx.getImageData(0,0,320,180);
    const dv = new DataView(frame);
    const offset = dv.getUint32(0, true);
    const control = new Uint8Array(frame.slice(4, offset+4));
    const graphic = new Uint8Array(frame.slice(offset+4));

    let y = 0;
    let x = 0;
    let cp = false;
    let p = 0;    
    control.forEach(v=>{
        if ((v & 0xC0) == 0xC0) {
            cp = false;
            y = y  + 1 + (v & 0x3F);
            x = 0;
        } else if (cp) {
            v = v*2;
            
            let ofs = (y * 320 + x) * 4;
            for (let z = 0; z < v; ++z) {
                const px = graphic[p++];
                const col = palette[px]
                img.data[ofs] = col[0];
                img.data[ofs+1] = col[1];
                img.data[ofs+2] = col[2];
                img.data[ofs+3] = col[3];
                ++x;
                ofs+=4;
            }
            cp = false;
        } else {
            x += v*2;
            cp = true;
        }            

    });

    ctx.putImageData(img,0,0);

}

function load_next_frame() {
    if (converting.value) return;
    if (animation_pos + 8 > animation.byteLength) {
        animation_pos = 0;
        return;
    }
    const d = new DataView(animation);
    const action = d.getUint32(animation_pos, true);
    const size = d.getUint32(animation_pos+4, true);
    animation_pos+=8;
    if (animation_pos+size > animation.byteLength) {
        animation_pos = 0;
        return;
    }
    const frame = animation.slice(animation_pos, animation_pos+size);
    animation_pos += size;
    switch (action) {
        case MGF_Action.MGIF_LZW:
        case MGF_Action.MGIF_COPY:
            copyFrameToCanvas(frame);
            break;
        case MGF_Action.MGIF_DELTA:
            updateCanvasByDelta(frame);
            break;
        case MGF_Action.MGIF_PAL:
            updatePalette(frame);
            break;
    }
}

async function loadAnim() {
    if (filename.value) {
        try {
            const data = await server.getDDLMGFFile(filename.value);
            animation_pos = 0;
            animation = data;
        } catch (e) {
            console.warn("Failed to open MGF: ", e);
        }
    }
}

function init() {
    intnum = setInterval(() => {
        load_next_frame();
    }, 1000/16);
    loadAnim();
    canvas.value.width=320;
    canvas.value.height=180;
}

function cleanup() {
    clearInterval(intnum);
}

watch([filename], loadAnim);

onMounted(init);
onUnmounted(cleanup);

const selected_files = ref<FileList>();
const new_name = ref<string>();
const converting = ref<boolean>(false);
let stop_req:boolean = false;


function select_files(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length) {
        selected_files.value = files; 
    }
}

const progress_percent = ref<string>("0%");

function setProgress(c:number,t:number) {
    const prgs = Math.round(c/t*100);
    progress_percent.value = `${prgs}%`;
}

async function start() {
    converting.value = true;
    stop_req = false;
    progress_percent.value = "0%";
    if (!selected_files.value || !new_name.value || !canvas.value) return;
    const c = canvas.value;
    c.width=320;
    c.height=180;
    const files = selected_files.value;
    if (files.length == 0) return ;
    setProgress(1, files.length+2);
    const session = await server.mgfCreate(new_name.value,AssetGroup.ITEMS,files.length,true);
    for (let i = 0; i < files.length; ++i) {
        if (stop_req) break;
        const f = files[i];
        const img = await readFileToImage(f);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Failed to get canvas");
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img,0,0,c.width,c.height);
        const imgdata = ctx.getImageData(0,0,c.width,c.height);
        const pal = findQuantizationAndGeneratePalette([imgdata],254,128,255);
        const lut = new ColorLUT(pal, 5);
        const pcx = new PCX(imgdata.width, imgdata.height);
        pal.unshift([0,0,0]);
        pcx.set_palete(pal);
        pcx.clear(0);
        pcx.convertImageData(imgdata, lut,1, 128, 255);            
        const pcxbuff = pcx.toArrayBuffer();
        const st = await server.mgfPutImage(session,pcxbuff);
        if (!st.processed) throw new Error("Process error: "+ st.error);
        if (st.need == 'N') break;
        setProgress(i+2, files.length+2);    
    }
    try {
        const cst = await server.mgfClose(session);
        filename.value = new_name.value;   
        loadAnim();
        emit("upload", new_name.value);
        setProgress(1,1);    
    } catch (e) {
        if (!stop_req) alert(e);
    }
    converting.value = false;
}


</script>

<template>
<div class="place checkerboard">
    <CanvasView :canvas="canvas"></CanvasView>
</div>
<hr>
<h2>Create</h2>
<div>
    <div>
        <input type="file" multiple @change="event => select_files(event)" />
        <input type="text" placeholder="ANIMNAME.MGF" v-model="new_name" @input="new_name=dosname_sanitize(new_name || '')" maxlength="12"/>
    </div>
    <div>
        <button @click="start" v-if="!converting" :disabled="!new_name || !new_name.endsWith('.MGF') || !selected_files || !select_files.length ">Start</button>
        <button @click="stop_req = true" v-if="converting">Stop</button>
    </div>
    <div class="progress">
        <div :style="{width: progress_percent}"></div>
    </div>

</div>

    
</template>
<style scoped>
.progress {
    border: 1px solid;
    width: 400px;    
    height: 2em;
    margin: 2em auto;
}

.progress > div {
    background-color: green;
    height: 100%;
}
</style>