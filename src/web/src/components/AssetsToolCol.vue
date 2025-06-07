<script setup lang="ts">
import { COLPaletteSet } from '@/core/col_palette_set';
import { server, type FileItem } from '@/core/api';
import { PCX, PCXProfile } from '@/core/pcx';
import { onMounted, ref, watch } from 'vue';
import SkeldalImage, { type ImageModel } from './SkeldalImage.vue';
import { AssetGroup } from '@/core/asset_groups';
import { PhotoshopPicker } from 'vue-color';
import { hslToRgb, rgbToHsl, type RGB, type RGBPalette } from '@/core/colors';
import CanvasView from './CanvasView.vue';

const filename = defineModel<string | null>();
const enemy_image = ref<PCX>();
const palete_col = ref<COLPaletteSet>();
const palete_col_name = ref<string>();
const selected_ciks = ref<boolean[]>([]);
const original_palette = ref<RGBPalette>();

const average_colors = ref<RGB[]>([]);

const emit = defineEmits<{
  (e: 'upload', name: string): void
}>();


async function prepareImage(fname: string) {
    try {
        const data = await server.getDDLFile(fname);
        enemy_image.value = PCX.fromArrayBuffer(data.buffer);
    } catch (e) {
        alert(e);
    }
}

function onUpdate() {
    if (filename.value) {
        if (filename.value.endsWith(".PCX")) {
            prepareImage(filename.value);
            palete_col_name.value = filename.value.substring(0,6)+".COL";
        } else if (filename.value.endsWith(".COL")) {
            prepareImage(filename.value.substring(0,6)+"F1.PCX");
            palete_col_name.value = filename.value;
        }
    }
}

function getOriginalPalette() : RGBPalette{
    if (enemy_image.value) {
        return enemy_image.value.get_palette();
    } else {
        return [];
    }
}

async function onUpdatePalete() {
    if (palete_col_name.value) {
        try {
            const data = await server.getDDLFile(palete_col_name.value);
            palete_col.value = COLPaletteSet.fromArrayBuffer(data.buffer);
        } catch (e) {
            palete_col.value = new COLPaletteSet();
            palete_col.value.addPalette(enemy_image.value?.get_palette());            
        }
    }
}

function select_color(index:number){
    const val = selected_ciks.value[index] || false;
    selected_ciks.value[index] = !val;

    update_selected();
}

function update_selected_pal(pal: RGBPalette): RGB {
{
            let r:number = 0;
            let g:number = 0;
            let b:number = 0;
            let c:number = 0;
            pal.forEach((col,idx)=>{
                if (selected_ciks.value[idx]) {
                    r += col[0];
                    g += col[1];
                    b += col[2];
                    c++;
                }
            });
            if (c) {r/=c;g/=c;b/=c};
            return [Math.floor(r),Math.floor(g),Math.floor(b)];
        }
}

function update_selected() {
    if (palete_col.value) {     
        average_colors.value = palete_col.value.palettes.map(pal=>update_selected_pal(pal));
    }
}

function clamp(num:number, min:number, max:number) {
  return num <= min 
    ? min 
    : num >= max 
      ? max 
      : num
}

function updateColors(event: Event, index: number) {
    const picker = event.target as HTMLInputElement;
    const bigint = parseInt(picker.value.slice(1), 16);
    const rgb_new : RGB= [(bigint >> 16) & 255,(bigint >> 8) & 255,bigint & 255];
    const hsl_orig = rgbToHsl(average_colors.value[index]);
    const hsl_new =  rgbToHsl(rgb_new);
    const hsl_diff = [
        (hsl_new[0] - hsl_orig[0] + 1) % 1,
        (hsl_new[1]-hsl_orig[1]),
        (hsl_new[2]-hsl_orig[2])
    ]

    if (palete_col.value) {
        palete_col.value.palettes[index] = palete_col.value.palettes[index].map((col: RGB, idx:number):RGB => {
                if (selected_ciks.value[idx]) {
                    let hsl = rgbToHsl(col);
                    hsl[0] = (hsl[0] + hsl_diff[0]) % 1;
                    hsl[1] = clamp(hsl[1]+hsl_diff[1], 0,1);
                    hsl[2] = clamp(hsl[2]+hsl_diff[2], 0,1);
                    return hslToRgb(hsl);
                } else {
                    return col;
                }
        });
        
        update_selected_pal(palete_col.value.palettes[index])
    }
  
}

watch([palete_col_name], onUpdatePalete);
watch([filename], onUpdate)

onMounted(()=>{
    onUpdate();
})

function rgb2value(rgb: RGB) {
    
    return rgb?(
        '#' +
        rgb.map((v:number) => v.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    ):"#000000";
}

function reset(event: Event, index: number) {
    if (palete_col.value && enemy_image.value) {
        palete_col.value.palettes[index] = enemy_image.value.get_palette();
    }
}

</script>   

<template>
    <div>
        <x-form>
            <label><span>File name</span><input readonly type="text" v-model="palete_col_name"></label>            
        </x-form>        
    </div>
    <div v-for="(pal , pal_index) of palete_col?.palettes" :index="pal_index">
        <p>Palette index {{ pal_index }}</p>
        <div class="panel">
        <div class="pal_view">
        <div class="grid">
            <div
                v-for="(col, col_index) of pal"
                :key="col_index"
                @click="select_color(col_index)"
                :class="{selected: selected_ciks[col_index] || false}"                
                :style="{ backgroundColor: `rgb(${col[0]}, ${col[1]}, ${col[2]})`}"
            ></div>
        </div>
        <div class="pal_actions">
            <input type="color" :value="rgb2value(average_colors[pal_index])" @input="event => updateColors(event, pal_index)">
            <button @click="event=>reset(event, pal_index)">Reset</button>
        </div>
        </div>
        <div class="preview">     
            <CanvasView :canvas="enemy_image?enemy_image.createCanvas(PCXProfile.enemy, pal):null"  />            
        </div>
        </div>
    </div>
</template>

<style scoped>
.grid {
    display:flex;
    flex-wrap: wrap;
    align-content: flex-end;
}
.grid > div {
    width: 2vw;
    height: 2vw;
    margin: 2px;
    cursor: pointer;
}
.grid > div.selected {
    border: 2px solid;
    margin: 0px;
}
.panel {
    display: flex;
}
</style>