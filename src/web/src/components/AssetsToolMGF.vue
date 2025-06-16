<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import CanvasView from './CanvasView.vue';
import { server } from '@/core/api';

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


const filename = defineModel<string | null>();
const canvas = ref<HTMLCanvasElement>(document.createElement("Canvas") as HTMLCanvasElement);

let animation = new ArrayBuffer();
let animation_pos = 0;
let intnum = 0
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
    ctx.putImageData(img, 0,0 );
}

function updateCanvasByDelta(frame: ArrayBuffer) {
    const ctx =canvas.value.getContext("2d",{ willReadFrequently: true });
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
    animation_pos = 0;
    if (filename.value) {
        try {
            const data = await server.getDDLMGFFile(filename.value);
            animation = data.buffer;
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

</script>

<template>
<div class="place checkerboard">
    <CanvasView :canvas="canvas"></CanvasView>
</div>
<p>Create animation: TBD</p>

    
</template>