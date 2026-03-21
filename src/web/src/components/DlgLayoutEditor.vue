<script lang="ts" setup>
import { server } from '@/core/api';
import { BinaryIterator, BinaryWriter } from '@/core/binary';
import { DialogLayout, extractRGB555, RGB555, RGB888 } from '@/core/dialog_structs';
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import StatusBar, { type SaveRevertControl } from './statusBar';
import { AssetGroup } from '@/core/asset_groups';
import { PCX, PCXProfile } from '@/core/pcx';
import { FontList } from '@/core/fonts';


const layout = reactive(new DialogLayout);
const image_url = ref<string>();
const image_width = ref<number>(0);
const image_height = ref<number>(0);

let save_status : SaveRevertControl | null = null;

async function save_all() {
    const wr = new BinaryWriter();
    wr.write(layout.getSchema(), layout);
    await server.putDDLFile("DIALOGY.LAY", wr.getBuffer(), AssetGroup.MAPS);
    save_status!.set_changed(false);    

}

async function revert() {
    save_status!.set_changed(false);
    save_status!.unmount();
    save_status = null
}

async function init() {
    var data = await server.getDDLFile("DIALOGY.LAY");
    const rd = new BinaryIterator(data);
    const obj = rd.parse(layout.getSchema());
    Object.assign(layout, obj);

    
    save_status = await StatusBar.register_save_control();

    save_status.on_save(save_all);
    save_status.on_revert(revert);

    const pcx_data = await server.getDDLFile("DIALOG.PCX");
    const pcx = PCX.fromArrayBuffer(pcx_data);
    const canvas = pcx.createCanvas(PCXProfile.default);
    image_url.value = canvas.toDataURL();
    image_width.value = canvas.width;
    image_height.value = canvas.height;

}

watch(layout, ()=>{
    if (save_status) save_status.set_changed(true);
})

const rgbToHex = (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const colors = (["desc_color", "text_color", "choice_color", "sel_choice_color"] as const satisfies readonly (keyof DialogLayout)[]);
const computed_colors = reactive(Object.fromEntries(colors
    .map(x=>[x,computed({
        get:() => {
            const rgbt = extractRGB555(layout[x]);
            return rgbToHex(rgbt.r,rgbt.g,rgbt.b);
        },
        set:(v:string) =>{
            const rgb = hexToRgb(v);
            if (!rgb) return;
            const org = extractRGB555(layout[x]);
            layout[x] = RGB888(rgb.r,rgb.g,rgb.b,org.a);           
        }
    })])));

const computed_transp = reactive(Object.fromEntries(colors
.map(x=>[x,computed({
    get:() => {
        const rgbt = extractRGB555(layout[x]);
        return !!rgbt.a;
    },
    set:(v:boolean) =>{
        const org = extractRGB555(layout[x]);
        layout[x] = RGB888(org.r,org.g,org.b,v?1:0);           
    }
})])));

onMounted(init);
onUnmounted(()=>{
    if (save_status) save_status.unmount();
})

</script>
<template>
<x-workspace>
    <x-section>
        <x-section-title>Dialog layout editor</x-section-title>
        <x-form>
            <label><span class="dialogarea">Dialog area X</span><input type="number" v-watch-range min="0" max="639" v-model="layout.txt_window_x"></label>
            <label><span class="dialogarea">Dialog area Y</span><input type="number" v-watch-range min="0" max="360" v-model="layout.txt_window_y"></label>
            <label><span class="dialogarea">Dialog area Width</span><input type="number" v-watch-range min="0" max="639" v-model="layout.txt_window_xs"></label>
            <label><span class="dialogarea">Dialog area Height</span><input type="number" v-watch-range min="0" max="360" v-model="layout.txt_window_ys"></label>
            <label><span class="dialogarea">Line Height</span><input type="number" v-watch-range min="0" max="360" v-model="layout.txt_window_line_height"></label>
            <label><span class="textdescarea">Description Width</span><input type="number" v-watch-range min="0" max="639" v-model="layout.txt_desc_width"></label>
            <label><span class="textdescarea">Description X</span><input type="number" v-watch-range min="0" max="639" v-model="layout.txt_desc_x"></label>
            <label><span class="textdescarea">Description Y</span><input type="number" v-watch-range min="0" max="360" v-model="layout.txt_desc_y"></label>
            <label><span class="imagearea">Picture X</span><input type="number" v-watch-range min="0" max="639" v-model="layout.pic_x"></label>
            <label><span class="imagearea">Picture Y</span><input type="number" v-watch-range min="0" max="360" v-model="layout.pic_y"></label>
            <label><span>Icon padding</span><input type="number" v-watch-range min="0" max="639" v-model="layout.icon_padding"></label>
            <label><span>Icon height</span><input type="number" v-watch-range min="0" max="360" v-model="layout.icon_height"></label>
            <label><span>Icon scale (shrink)</span><select v-model.number="layout.icon_size">
                <option :value="1">No shrink</option>
                <option :value="2">2x</option>
                <option :value="3">3x</option>
                <option :value="4">4x</option>
                <option :value="5">5x</option>
            </select></label>
            <label><span>Description font</span><select v-model.number="layout.desc_font"> 
                <option v-for="(n,idx) of FontList" :key="idx" :value="idx"> {{ n }}</option></select></label>
            <label><span>Description Color</span><input type="color"  v-model="computed_colors.desc_color"></label>
            <label><span>Enable shadow</span><input type="checkbox"  v-model="computed_transp.desc_color"></label>
            <label><span>Text font</span><select v-model.number="layout.text_font"> 
                <option v-for="(n,idx) of FontList" :key="idx" :value="idx"> {{ n }}</option></select></label>
            <label><span>Text Color</span><input type="color"  v-model="computed_colors.text_color"></label>
            <label><span>Enable shadow</span><input type="checkbox"  v-model="computed_transp.text_color"></label>
            <label><span>Choice Color</span><input type="color"  v-model="computed_colors.choice_color"></label>
            <label><span>Enable shadow</span><input type="checkbox"  v-model="computed_transp.choice_color"></label>
            <label><span>Selected Choice Color</span><input type="color"  v-model="computed_colors.sel_choice_color"></label>
            <label><span>Enable shadow</span><input type="checkbox"  v-model="computed_transp.sel_choice_color"></label>
        </x-form>
    </x-section>
    <x-section>
        <x-section-title>Preview</x-section-title>
        <svg view-box="0 0 640 480" width="640" height="480" style="border:1px solid black">
            <image :href="image_url" x="0" y="17" :width="image_width" :height="image_height"/>
            <rect :x="layout.txt_window_x" :y="layout.txt_window_y" :width="layout.txt_window_xs" :height="layout.txt_window_ys" class="dialogarea"/>
            <line :x1="layout.txt_window_x" :y1="layout.txt_window_y+layout.txt_window_line_height" :x2="layout.txt_window_x+layout.txt_window_xs" :y2="layout.txt_window_y+layout.txt_window_line_height" class="dialogarea"/>
            <rect :x="layout.txt_desc_x" :y="layout.txt_desc_y" :width="layout.txt_desc_width" :height="layout.txt_window_line_height" class="textdescarea"/>
            <line :x1="layout.txt_desc_x" :y1="layout.txt_desc_y" :x2="layout.txt_desc_x" :y2="layout.txt_desc_y+200" class="textdescarea"/>
            <line :x1="layout.txt_desc_x+layout.txt_desc_width" :y1="layout.txt_desc_y" :x2="layout.txt_desc_x+layout.txt_desc_width" :y2="layout.txt_desc_y+200" class="textdescarea"/>
            <rect :x="layout.pic_x" :y="layout.pic_y+17" :width="340" :height="200" class="imagearea"/>
        </svg>          


    </x-section>

</x-workspace>


</template>
<style lang="css" scoped>
.dialogarea {
    fill: #ffaa0080;
    stroke: #FFFF0080;
    stroke-width: 2px;
}
.imagearea {
    fill: #00FF0080;
    stroke: #00FFFF80;
    stroke-width: 2px;
    color:#008000
}
.textdescarea {
    fill: #0000FF80;
    stroke: #00FFFF80;
    stroke-width: 2px;
    color:#000080
}
x-workspace {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    flex-wrap: wrap;
    text-align: left;
}
x-workspace>* {
    flex-grow: 1;
    min-width: 30rem;    
}
x-workspace>*:nth-child(2) {
    text-align: center;
 
}
label input[type="number"] {
    width: 5rem;
    text-align: right;
}
</style>