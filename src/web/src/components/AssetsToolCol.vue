<script setup lang="ts">
import { COLPaletteSet } from '@/core/col_palette_set';
import { server, type FileItem } from '@/core/api';
import { PCX, PCXProfile } from '@/core/pcx';
import { onMounted, onUnmounted, ref, shallowReactive, shallowRef, watch } from 'vue';
import SkeldalImage, { type ImageModel } from './SkeldalImage.vue';
import { AssetGroup } from '@/core/asset_groups';
import { PhotoshopPicker } from 'vue-color';
import { hslToRgb, rgbToHsl, type RGB, type RGBPalette } from '@/core/colors';
import CanvasView from './CanvasView.vue';
import { messageBoxAlert, messageBoxConfirm } from '@/utils/messageBox';
import type { SaveRevertControl } from './statusBar';
import StatusBar from './statusBar';

const filename = defineModel<string | null>();
const enemy_image = shallowRef<PCX>();
const palete_col = ref<COLPaletteSet>();
const palete_col_name = ref<string>();
const selected_ciks = ref<boolean[]>([]);
const original_palette = ref<RGBPalette>();
const undo_palette = ref<RGBPalette>();
const undo_index = ref<number>();
const commbutt = ref<boolean>(false);

const average_colors = ref<RGB[]>([]);

let save_state: SaveRevertControl | null = null;


const emit = defineEmits<{
  (e: 'upload', name: string, done?:Promise<any>): void
}>();


async function save_col(name : string) {
    const col = palete_col.value;
    if (col) {
        return server.putDDLFile(name, col.toArrayBuffer(), AssetGroup.ENEMIES);        
    }
}

async function prepareImage(fname: string) {
    try {
        const data = await server.getDDLFile(fname);
        enemy_image.value = PCX.fromArrayBuffer(data);
    } catch (e) {
        alert(e);
    }
}

function do_revert() {
    save_state?.set_changed(false);
    onUpdatePalete();
}

async function do_save() {
    if (filename.value) {
        return save_col(filename.value);
    }
}

async function onUpdate() {
    if (filename.value) {

        if (filename.value.endsWith(".PCX")) {
            prepareImage(filename.value);
            palete_col_name.value = filename.value.substring(0,6)+".COL";
        } else if (filename.value.endsWith(".COL")) {
            const lst = (await server.getDDLFiles(AssetGroup.ENEMIES)).files.map(x=>x.name.toUpperCase());
            const base = filename.value.substring(0,filename.value.length-4);
            const found = lst.find(x=>x.startsWith(base) && x.endsWith(".PCX"));
            if (found) prepareImage(found);
            palete_col_name.value = filename.value;
        }
    }
}

async function onUpdatePalete() {
    if (palete_col_name.value) {

        if (save_state && save_state.get_changed()) save_state.unmount();
        save_state = null;
        save_state = await StatusBar.register_save_control();
        save_state.on_save(do_save);
        save_state.on_revert(do_revert);
        try {
            const data = await server.getDDLFile(palete_col_name.value);
            palete_col.value = COLPaletteSet.fromArrayBuffer(data);
        } catch (e) {
            palete_col.value = new COLPaletteSet();
            palete_col.value.addPalette(enemy_image.value?.get_palette());            
            commbutt.value = true;
        }
    }
}

let last_select = -1;
let last_end = -1;

function make_selection(from :number, to:number, val:boolean) {
    if (from > to) return make_selection(to, from, val);
    for (let i = from; i <= to; ++i) selected_ciks.value[i] = val;
}

function select_color(event: MouseEvent, index:number){

    if (event.shiftKey && last_select >= 0) {
        let f = last_select;
        let e = index;
        let flag = selected_ciks.value[f];
        if (last_end != -1) make_selection(f, last_end, !flag);
        last_end = e;
        make_selection(f, last_end, flag);
    } else {
        if (!event.ctrlKey) selected_ciks.value = [];
        const val = selected_ciks.value[index] || false;
        selected_ciks.value[index] = !val;
        last_select = index;
        last_end = -1;
    }

    update_selected();
    undo_palette.value = undefined;
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
        
        average_colors.value[index] = update_selected_pal(palete_col.value.palettes[index]);
        if (save_state) save_state.set_changed(true);
    }
  
}

watch([palete_col_name], onUpdatePalete);
watch([filename], onUpdate);

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

function undo(event: Event, index: number) {
    if (undo_index.value == index && undo_palette.value && palete_col.value && undo_palette.value.length == 256) {
        palete_col.value.palettes[index] = undo_palette.value.map(col => [...col] as RGB);
        update_selected();
    }
}

function clear_selection() {
    selected_ciks.value = [];
}
function init_undo(event: Event, index: number) {
    if (!palete_col.value) {
        undo_palette.value = undefined;
        return;
    }
    if (index != undo_index.value || !undo_palette.value) {
        const palette : RGBPalette = palete_col.value.palettes[index];
        undo_palette.value = palette.map(col => [...col] as RGB);
        undo_index.value = index;
    }
}

function add() {
    if (palete_col.value) {
        palete_col.value.addPalette(enemy_image.value?.get_palette());
        if (save_state) save_state.set_changed(true);
    }
}
async function delete_pal(index: number) {
    if (await messageBoxConfirm("Are you sure delete this palette?")) {
        palete_col.value?.palettes.splice(index,1);
        if (save_state) save_state.set_changed(true);
    }
}

function select_color_from_image(event: Event) {
    const canvas = (event.target as HTMLCanvasElement);
    if (canvas && event instanceof MouseEvent && enemy_image.value) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.floor(event.clientX - rect.left);
        const y = Math.floor(event.clientY - rect.top);
        // x and y are the coordinates where the mouse was clicked on the canvas
        const index = enemy_image.value.getPixel(x,y);
        
        if (!event.ctrlKey) selected_ciks.value = [];
        selected_ciks.value[index] = !event.shiftKey;

        update_selected();
        undo_palette.value = undefined;

    }
}

onUnmounted(()=>{
    if (save_state) save_state.unmount();
});


async function create_common_palette() {
    const col = palete_col_name.value;
    if (!col) return;
    const base = col.substring(0,col.length-4);
    if (!await messageBoxConfirm("This creates common palette for all frames of the enemy. This requires to regenerate all frames. This may take a time. Continue?")){
        return;
    }
    const lst =(await server.getDDLFiles(AssetGroup.ENEMIES)).files.map(x=>x.name)
        .filter(x=>x.startsWith(base) && x.toUpperCase().endsWith('.PCX'));

    if (lst.length == 0) {
        await messageBoxAlert("No images found");
        return;
    }
    const imgs : PCX[] = [];
    for (const x of lst) {
        const data = await server.getDDLFile(x);
        const pcx = PCX.fromArrayBuffer(data);
        imgs.push(pcx);
    }
    const new_imgs = await PCX.createCommonPalette(imgs, PCXProfile.enemy);
    let id = 0;
    for (const x of new_imgs) {
        await server.putDDLFile(lst[id], x.toArrayBuffer(), AssetGroup.ENEMIES);
        ++id;
    }
    palete_col.value = new COLPaletteSet();
    palete_col.value.addPalette(new_imgs[0].get_palette());            
    commbutt.value = false;
    save_col(col);
    filename.value = col;

}


</script>   



<template>
    <div>
        <x-form>
            <label><span>File name</span><input readonly type="text" v-model="palete_col_name"></label>            
        </x-form>        
    </div>
    <div class="palette" v-for="(pal , pal_index) of palete_col?.palettes" :key="pal_index">
        <p>Palette index {{ pal_index }}</p>
        <button class="right-button" @click="delete_pal(pal_index)">Delete</button>
        <div class="panel">
        <div class="pal_view">
        <div class="grid">
            <div
                v-for="(col, col_index) of pal"
                :key="col_index"
                @click="event => select_color(event, col_index)"
                :class="{selected: selected_ciks[col_index] || false, alpha: col_index>=128}"                
                :style="{ backgroundColor: `rgb(${col[0]}, ${col[1]}, ${col[2]})`}"
            ></div>
        </div>
        <div class="pal_actions">
            <input type="color" :value="rgb2value(average_colors[pal_index])" @input="event => updateColors(event, pal_index)" @click="event => init_undo(event, pal_index)">
            <button :disabled="!undo_palette || pal_index != undo_index" @click="event=>undo(event, pal_index)">Undo</button>
            <button  @click="clear_selection">Clear selection</button>
        </div>
        </div>
        <div class="preview">     
            <CanvasView class="checkerboard cross" :canvas="enemy_image?enemy_image.createCanvas(PCXProfile.enemy, pal):null"  @click="event => select_color_from_image(event)"/>            
        </div>
        </div>
    </div>
     <div class="palette"><button class="right-button" @click="add">Add</button></div>

     <div class="ccpal" v-if="commbutt">
        <button @click="create_common_palette">Create new palette</button>
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
    position: relative;
}
.grid > div.selected {
    border: 2px solid blue;
    margin: 0px;
    
}
.grid > div.selected::after {
    display: block;
    position: absolute;
    content: "";
    border: 2px solid yellow;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
}

.panel {
    display: flex;
}

.pal_actions {
    text-align: center;
}
.palette {
    position: relative;
    text-align: left;
    border: 1px solid;
    padding: 0.5em;
    margin: 1em;
    background-color: rgb(209, 197, 181);
}
.right-button {
    position: absolute;
    right: 0;
    top: 0;
    width: 5em;;
}
.cross {
    cursor: crosshair;
}
.alpha::before {
    position: absolute;
    inset: 0;
    width: fit-content;
    height: fit-content;
    margin: auto;
    content: "a";
    color:white;
    text-shadow: 0px 0px 2px  black;
}
</style>