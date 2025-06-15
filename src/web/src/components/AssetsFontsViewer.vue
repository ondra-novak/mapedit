<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import CanvasView from './CanvasView.vue';
import { server } from '@/core/api';

const filename = defineModel<string | null>();
const canvas = ref<HTMLCanvasElement>(document.createElement("Canvas") as HTMLCanvasElement);

function getCharDim(fontraw : ArrayBuffer, i:number) : number[]{
    const font =  new Uint8Array(fontraw);
    const ofs = font[i*2]+256*font[i*2+1];
    if (ofs == 0) return [0,0];
    const x = font[ofs];
    const y = font[ofs+1];
    return [x,y];
}

const charcolors = 
[
    [0,0,0,255],
    [255,255,255,255],
    [240,240,240,255],
    [220,220,220,255],
    [200,200,200,255],
    [180,180,180,255],
    [160,160,160,255],
    [140,140,140,255],
]

function drawChar(img: ImageData , fontraw: ArrayBuffer, x: number, y:number,  code:number) {
    const font =  new Uint8Array(fontraw);


    const scr_linelen2 = img.width*4;
    let edi = (x + y * img.width) * 4;
	let esi = 0
    //int al = znak;
	//unsigned char dl,cl,ch,dh;
	//word *ebx;

	let ax = font[code*2]+256*font[code*2+1];
	if (ax == 0) return;
	esi += ax;
	let dl = 0;
	let cl = font[esi++]
	let ch = font[esi++];
    do {
        let ebx = edi;
        let dh = ch;
        do {
            if (dl != 0) {
                --dl;
            } else {
                let al = font[esi++];
                if (al) {
                    if (al >= 8) {
                        if (al == 255) return;
                        dl = al - 7;
                    } else {
                        al = al -1;
                        img.data[ebx] = charcolors[al][0];
                        img.data[ebx+1] = charcolors[al][1];
                        img.data[ebx+2] = charcolors[al][2];
                        img.data[ebx+3] = charcolors[al][3];                        
                    }
                }
            }
            ebx+=scr_linelen2;
            dh--;
        } while (dh!=0);
        edi+=4;
        cl--;
    } while (cl != 0);
}

async function loadFont() {
    if (filename.value) {
        try {
            const data = await server.getDDLFile(filename.value);
            canvas.value.width=640;
            canvas.value.height=480;
            const ctx = canvas.value.getContext('2d');            
            if (ctx) {
                ctx.fillStyle = '#666';
                ctx.fillRect(0, 0, canvas.value.width, canvas.value.height);
                const img = ctx.getImageData(0,0,canvas.value.width, canvas.value.height);
                let x = 0;
                let y = 0;
                let h = 0;
                for (let i = 0;i < 255; ++i) {
                    let [cw,ch] = getCharDim(data.buffer, i);
                    if (h < ch) h = ch;
                    if (x+cw >= canvas.value.width) {
                        x = 0;
                        y+=h;
                    }
                    drawChar(img, data, x, y, i);
                    x = x + cw+1;                    
                }
                ctx.putImageData(img,0,0);
            }

        } catch (e) {
                    console.log(e);
    }
    }
    
}

watch([filename], loadFont);
onMounted(loadFont);


</script>



<template>    
<div class="place">
    <CanvasView :canvas="canvas"></CanvasView>
</div>

</template>

<style scoped>

</style>