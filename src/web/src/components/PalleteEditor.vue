<script setup lang="ts">
import { server, type Config } from '@/core/api';
import { ArcConfiguration, AssetConfiguration, ConfigurationPalette, FloorCeilConfiguration, FloorCeilMode, FloorCeilModeRequiredFrames, GlobalPaletteConfiguration, WallConfiguration } from '@/core/map_structs';
import { nextTick, onMounted, reactive, ref, Teleport, watch} from 'vue';
import { PCX, PCXProfile } from '@/core/pcx';
import { messageBoxAlert, messageBoxConfirm } from '@/utils/messageBox';
import globalState from '@/utils/global';
import { AssetGroup } from '@/core/asset_groups';
import type { DataListHandle } from '@/utils/datalist';

const props = defineProps<{
    type: string,
    listview: boolean,
    wall_assets: DataListHandle
}>();


const model = defineModel<AssetConfiguration|null>("selection");
const palette = defineModel<GlobalPaletteConfiguration<AssetConfiguration> >("palette");
const model_index = ref<number>(-1);
const dlg = ref<HTMLDialogElement>();

const cur_wall = ref<WallConfiguration>();
const cur_arc = ref<ArcConfiguration>();
const cur_floorceil = ref<FloorCeilConfiguration>();
const cur_frame = ref<number>(0);


const preview_place = ref<HTMLElement>();

async function getImage(image:string) {
    if (!image) image = "EMPTY.PCX";
    const buff = await server.getDDLFile(image);        
    return PCX.fromArrayBuffer(buff);
}

watch([cur_wall, cur_frame, preview_place],async ()=>{
    const cw = cur_wall.value;
    const pp = preview_place.value;
    const cf = cur_frame.value;
    if (cw && pp && cf !== undefined) {
        const rs = cw.graphics[cf].map(n=>{
            return getImage(n).then(pcx=>pcx.createCanvas(PCXProfile.wall), ()=>document.createElement("canvas"));
        })
        const [main,left,right] = await Promise.all(rs);
        pp.innerHTML = "";
        pp.appendChild(main);
        pp.appendChild(left);
        pp.appendChild(right);
    }
},{deep:true})

watch([cur_arc, preview_place],async ()=>{
    const cw = cur_arc.value;
    const pp = preview_place.value;
    if (cw && pp) {
        const rs = [cw.left, cw.right].map(n=>{
            return getImage(n).then(pcx=>pcx.createCanvas(PCXProfile.wall), ()=>document.createElement("canvas"));
        })
        const [left,right] = await Promise.all(rs);
        pp.innerHTML = "";
        pp.appendChild(document.createElement("div"));
        pp.appendChild(left);
        pp.appendChild(right);
    }
},{deep:true})

watch([cur_floorceil, cur_frame, preview_place],async ()=>{
    const cw = cur_floorceil.value;
    const pp = preview_place.value;
    if (cw && pp) {
        const c = await (getImage(cw.pixmaps[cur_frame.value]).then(pcx=>pcx.createCanvas(PCXProfile.default), ()=>document.createElement("canvas")));
        pp.innerHTML = "";
        pp.appendChild(c);
    }
},{deep:true})



function showDetail() {
    if (model.value) {
        if (props.type == "wall") cur_wall.value = model.value.clone() as WallConfiguration;
        else if (props.type == "arc") cur_arc.value = model.value.clone() as ArcConfiguration;
        else if (props.type == "floor") cur_floorceil.value = model.value.clone() as FloorCeilConfiguration;
        else if (props.type == "ceil") cur_floorceil.value = model.value.clone() as FloorCeilConfiguration;
    }
}

function getEditedConf(): AssetConfiguration | null{
    return cur_wall.value || cur_arc.value || cur_floorceil.value || null;
}

function deleteItem() {
    if (model_index.value >=0 && palette.value) {
        palette.value.list.splice(model_index.value,1);
        model_index.value = -1;
        model.value = null;
    }
    closeDlg();
}


function updateItem() {
    if (!palette.value) return;
    if (cur_floorceil.value 
            && cur_floorceil.value.mode != FloorCeilMode.ANIMATED 
            && cur_floorceil.value.pixmaps.length != (cur_floorceil.value.button?2:1)*FloorCeilModeRequiredFrames[cur_floorceil.value.mode]) {
                messageBoxAlert("Can't update item: Type of floor/ceil doesn't match to frame count");
                return;
            }

    const a = getEditedConf();
    if (a) {
        const idx = model_index.value < 0?palette.value.list.findIndex(x=>x.get_key() == a.get_key()):model_index.value;
        if (idx < 0) {
            palette.value.list.unshift(a);
        } else {
            palette.value.list[idx] = a;
        }
        model_index.value = idx;
        model.value = a;
    }
    closeDlg();
}

function cloneItem() {
    const a = getEditedConf();
    if (a && palette.value) {
        palette.value.list.unshift(a);
        model.value = a;
        model_index.value = 0;
        showDetail();
    }
}

watch([model,palette],()=>{
    if (model.value && palette.value) {
        const k = model.value.get_key();
        model_index.value = palette.value.list.findIndex(x=>x.get_key() == k);
    } else {
        model_index.value = -1;
    }
})

watch([model_index],()=>{
    const idx = model_index.value;
    if (idx == -1) model.value = null;
    else if (idx == -2) {
        model.value = null;
        if (props.type == "wall") {
            cur_wall.value = new WallConfiguration();
        } else if (props.type == "arc") {
            cur_arc.value = new ArcConfiguration();
        } else if (props.type == "floor" || props.type == "ceil") {
            cur_floorceil.value = new FloorCeilConfiguration();
        }
    }  else {
        model.value = palette.value?.list[idx] || null;
    }
})

function closeDlg() {
    cur_arc.value = undefined;
    cur_floorceil.value = undefined;
    cur_wall.value = undefined;
    cur_frame.value = 0;
    if (model_index.value === -2) model_index.value = -1;


}

function dupFrame() {
    if (cur_wall.value) {
        const f = cur_wall.value.graphics[cur_frame.value]
        cur_wall.value.graphics.splice(cur_frame.value,0,[f[0],f[1],f[2]]);
        cur_frame.value++;
    } else if (cur_floorceil.value) {
        const f = cur_floorceil.value.pixmaps[cur_frame.value]
        cur_floorceil.value.pixmaps.splice(cur_frame.value,0,f);
        cur_frame.value++;
    }

}

function delFrame() {
    if (cur_wall.value) {
        cur_wall.value.graphics.splice(cur_frame.value,1);
        if (cur_frame.value) cur_frame.value--;    
    } else if (cur_floorceil.value) {
        cur_floorceil.value.pixmaps.splice(cur_frame.value,1);
        if (cur_frame.value) cur_frame.value--;    
    }
}

function paletteUpdate() {
    if (model.value && palette.value) {
        model_index.value = palette.value.list.findIndex(x=>x.get_key() == model.value?.get_key());
        if (model_index.value == -1) {
            model_index.value = palette.value.list.length;
            palette.value.list.push(model.value);
        }
    }
}

function init() {
    paletteUpdate();
    
}

watch([model,palette], ()=>{
    paletteUpdate();
})

watch([cur_wall,cur_floorceil, cur_arc],()=>{
    if (cur_wall.value || cur_floorceil.value || cur_arc.value) {
        dlg.value?.showModal();
    } else {
        dlg.value?.close();
    }
});

onMounted(init);
</script>
<template>
<select v-model="model_index" :size="props.listview?2:1" @dblclick="showDetail" @keydown="(ev)=>{if (ev.key=='Enter') {showDetail();ev.preventDefault();}}">
    <option value="-1">(none)</option>
    <option value="-2">Add new...</option>
    <option v-for="(val, k) of palette?.list" :key="k" :value="k"> {{ val.get_name() }}</option>
</select>
<Teleport to="body">
<dialog ref="dlg">
    <header>Define resource<button class="close" @click="closeDlg"></button></header>
            <div v-if="cur_wall">
                <div class="wall-preview checkerboard" ref="preview_place">
                </div>
                <div class="control">
                    <button @click="dupFrame" >+</button>
                    <button @click="cur_frame = cur_frame>0?cur_frame-1:cur_frame"
                        >&lt;&lt;</button> {{ cur_frame+1 }} / {{ cur_wall.graphics.length }} <button
                        @click = "cur_frame = cur_frame>=cur_wall.graphics.length-1?cur_wall.graphics.length-1:cur_frame+1">&gt;&gt;</button>
                    <button @click="delFrame" :disabled="cur_wall.graphics.length<2">-</button>
                </div>
                <x-section>
                    <x-section-title>Configuration</x-section-title>
                    <x-form>
                        <label><span>Name:</span><input  type="text" v-model="cur_wall.name"></label>
                        <label><span>Front (main):</span><input  type="text" v-model="cur_wall.graphics[cur_frame][0]" :list="props.wall_assets.id"></label>
                        <label><span>Left :</span><input type="text" v-model="cur_wall.graphics[cur_frame][1]" :list="props.wall_assets.id"></label>
                        <label><span>Right :</span><input type="text" v-model="cur_wall.graphics[cur_frame][2]" :list="props.wall_assets.id"></label>
                        <label><span title="Specifies offset from outer edge of left/right pixmap in pixels where enemies going through the wall are clipped">Clip(?)</span><input  type="text" v-model="cur_wall.lclip" v-watch-range min="1" max="16"></label>
                        <label><input  type="checkbox" v-model="cur_wall.transparent"><span>Transparent (can see through)</span></label>
                        <label><input  type="checkbox" v-model="cur_wall.alternate"><span>Alternating</span></label>
                        <label><input  type="checkbox" v-model="cur_wall.repeat_anim"><span>Repeat animation</span></label>
                        <label><input  type="checkbox" v-model="cur_wall.ping_pong"><span>Ping ping animation</span></label>
                        <label><input  type="checkbox" v-model="cur_wall.forward_dir"><span>Animate forward</span></label>
                        <label><input  type="checkbox" v-model="cur_wall.secondary_front"><span>If secondary, draw as sector's backdrop</span></label>
                        <label><span>Offset [X,Y]</span>
                            <div><input type="number" :disabled="!cur_wall.allow_offset" v-model="cur_wall.offset_x" v-watch-range min="-255" max="+255">
                            <input type="number" v-model="cur_wall.offset_y" v-watch-range min="-255" max="+255"></div></label>
                        <label><input  type="checkbox" v-model="cur_wall.allow_offset"><span>Use offset when viewed from the side (secondary)</span></label>
                        <label><span>Primary wall position</span><select v-model="cur_wall.position">
                            <option :value="0">Normal (default)</option>
                            <option :value="1">Above</option>
                            <option :value="2">Below</option>
                        </select></label>
                    </x-form>
                </x-section>
            </div>
            <div v-if="cur_arc">
                <div class="wall-preview checkerboard" ref="preview_place">
                </div>
                <x-section>
                    <x-section-title>Configuration</x-section-title>
                    <x-form>
                        <label><span>Name:</span><input  type="text" v-model="cur_arc.name"></label>
                        <label><span>Left :</span><input type="text" v-model="cur_arc.left" :list="props.wall_assets.id"></label>
                        <label><span>Right :</span><input type="text" v-model="cur_arc.right" :list="props.wall_assets.id"></label>
                    </x-form>
                </x-section>
            </div>
            <div v-if="cur_floorceil">
                <div class="floor-preview" ref="preview_place">
                </div>
                <div class="control">
                    <button @click="dupFrame" :disabled="cur_floorceil.pixmaps.length>=8">+</button>
                    <button @click="cur_frame = cur_frame>0?cur_frame-1:cur_frame"
                        >&lt;&lt;</button> {{ cur_frame+1 }} / {{ cur_floorceil.pixmaps.length }} <button
                        @click = "cur_frame = cur_frame>=cur_floorceil.pixmaps.length-1?cur_floorceil.pixmaps.length-1:cur_frame+1">&gt;&gt;</button>
                    <button @click="delFrame" :disabled="cur_floorceil.pixmaps.length<2">-</button>
                </div>
                <x-section>
                    <x-section-title>Configuration</x-section-title>
                    <x-form>
                        <label><span>Name:</span><input  type="text" v-model="cur_floorceil.name"></label>
                        <label><span>Bitmap :</span><input type="text" v-model="cur_floorceil.pixmaps[cur_frame]" :list="props.wall_assets.id"></label>
                        <label><span>Mode: </span><select v-model="cur_floorceil.mode">
                            <option :value="-1">Animated</option>
                            <option :value="0">Single (1 frame)</option>
                            <option :value="1">Alternate (2 frames)</option>
                            <option :value="2">Two directions (2 frames)</option>
                            <option :value="3">Two directions alternating (4 frames)</option>
                            <option :value="4">Four directions (4 frames)</option>
                            <option :value="5">Four directions alternating (8 frames)</option>
                        </select></label>
                        <template v-if="!cur_floorceil.is_ceil">
                            <label><input type="checkbox" v-model="cur_floorceil.button" /><span>Button off/on (x2 frames)</span></label>
                            <label><input type="checkbox" v-model="cur_floorceil.fog_to_black" /><span>Interior (fog to black) </span></label>
                        </template>
                    </x-form>
                </x-section>
            </div>
        <footer>
            <button v-if="model_index < 0" @click="updateItem">Add</button>
            <button v-if="model_index >= 0" @click="deleteItem">Delete</button>
            <button v-if="model_index >= 0" @click="cloneItem">Clone</button>
            <button v-if="model_index >= 0" @click="updateItem">Update</button>
            <button @click="closeDlg">Close</button>        
        </footer>
</dialog>
</Teleport>
</template>

<style scoped>
select {
    height: 100%;
}
div.wall-preview {
    position:relative;
    width: 500px;    
    height: 320px;
    overflow: auto;
}

div.wall-preview >:nth-child(2) {
    position: absolute;
    bottom: 0;
    left: 0;
}

div.wall-preview > :nth-child(1) {
    position: absolute;
    right: 0;
    bottom: 64px;
    transform: scale(0.7,0.7);
    transform-origin: bottom;
    left: 0;
    display: block;
    width: fit-content;
    margin: auto;
    
}

div.wall-preview > :nth-child(3) {
    position: absolute;
    right: 0;
    bottom: 0;
    transform: scaleX(-1);
}

div.content {
    padding: 0.5rem;
}

input[type=number] {
    width: 5rem;
    text-align: center;
}

input {
    text-align: center;
}

</style>
