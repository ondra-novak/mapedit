<template>
    <div> {{ width}}x{{height}} </div>
    <div ref="canvas" class="checkerboard" style="display:inline-block"> </div>
</template>

<script lang="ts" setup>
import { server } from '@/core/api';
import { PCX, type PCXProfileType } from '@/core/pcx';
import HIFormat from '@/core/hiformat.ts'
import { defineProps, onMounted, ref, watch } from 'vue';
import type { AssetGroupType } from '@/core/asset_groups.ts';
import {determineProfile} from '@/core/pcx_profle.ts'

export interface ImageModel {
    name: string;
    group: AssetGroupType;
}

const model =  defineModel<ImageModel>();


const canvas = ref<HTMLDivElement | null>(null);
const width = ref<number>(0);
const height = ref<number>(0);

function set_canvas(c: HTMLCanvasElement|null) : void {
    if (canvas.value) {    
        while (canvas.value.firstChild) canvas.value.removeChild(canvas.value.firstChild);
        if (c) {            
            canvas.value.appendChild(c);
        }
    }
}

async function update() {
    if (model.value) {
        try {
            const data = await server.getDDLFile(model.value.name);
            if (PCX.isSupported(data.buffer)) {
                const pcx = PCX.fromArrayBuffer(data.buffer);
                const profile = determineProfile(model.value.name, model.value.group, pcx);
                set_canvas( pcx.createCanvas(profile));
                width.value = pcx.width;
                height.value = pcx.height;
            } else if (HIFormat.isSupported(data.buffer)) {
                const hi = HIFormat.fromArrayBuffer(data.buffer);
                set_canvas( hi.createCanvas());
                width.value = hi.width;
                height.value = hi.height;
            } else {
                canvas.value = null;
            }
    
        } catch (e) {
            canvas.value = null;
            console.warn("PCXImage load error:", e);
        }
    } else {
        canvas.value = null;
    }

}

onMounted(() => {
    update();
});

watch([model], () => {
    update();
});
</script>

<style scoped>
.pcx-image {
    display: flex;
    flex-direction: column;
    align-items: center;
}
.image-info {
    margin-top: 8px;
    font-size: 14px;
    color: #555;
}
</style>