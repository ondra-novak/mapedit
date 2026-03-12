<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { ArcConfiguration, AssetConfiguration, FloorCeilConfiguration, WallConfiguration } from '@/core/map_structs';
import { PCX, PCXProfile } from '@/core/pcx';
import { create_datalist, type DataListHandle, type DataListItem } from '@/utils/datalist';
import { toRaw, watch } from 'vue';
import { ref } from 'vue';


const dlgref=ref<HTMLDialogElement>();
let resolver : ((value:AssetConfiguration|null)=>void)|null = null;


type type_enum = 'wall'|'arc'|'ceil'|'floor';

const cur_type = ref<type_enum|null>(null);
const cur_item = ref<AssetConfiguration>();
const preview_place = ref<HTMLElement>();
const cur_frame = ref<number>(0);
const assets = ref<DataListHandle>(create_datalist(()=>[] as DataListItem[]));

async function getImage(image:string) {
    if (!image) image = "EMPTY.PCX";
    const buff = await server.getDDLFile(image);        
    return PCX.fromArrayBuffer(buff);
}



watch([cur_item, cur_frame, preview_place],async ()=>{
    const itm = cur_item.value;
    const pp = preview_place.value;
    const cf = cur_frame.value;
    if (itm && pp) {
        if (itm instanceof WallConfiguration) {
            const rs = itm.graphics[cf].map(n=>{
                return getImage(n).then(pcx=>pcx.createCanvas(PCXProfile.wall), ()=>document.createElement("canvas"));
            })
            const [main,left,right] = await Promise.all(rs);
            pp.innerHTML = "";
            pp.appendChild(main);
            pp.appendChild(left);
            pp.appendChild(right);

        } else if (itm instanceof ArcConfiguration) {
            const rs = [itm.left, itm.right].map(n=>{
                return getImage(n).then(pcx=>pcx.createCanvas(PCXProfile.wall), ()=>document.createElement("canvas"));
            })
            const [left,right] = await Promise.all(rs);
            pp.innerHTML = "";
            pp.appendChild(document.createElement("div"));
            pp.appendChild(left);
            pp.appendChild(right);
        } else if (itm instanceof FloorCeilConfiguration) {
            const c = await (getImage(itm.pixmaps[cur_frame.value]).then(pcx=>pcx.createCanvas(PCXProfile.default), ()=>document.createElement("canvas")));
            pp.innerHTML = "";
            pp.appendChild(c);
        }

    }
},{deep:true})


const win_title : Record<type_enum, string> = {
    'wall': "Wall configuration",
    'arc': "Arc configuration",
    'ceil': "Ceil configuration",
    'floor': "Floor configuration"
};

const constructors: Record<type_enum, ()=>AssetConfiguration> = {
    'wall': ()=>new WallConfiguration,
    'arc': ()=>new ArcConfiguration,
    'ceil': ()=>new FloorCeilConfiguration,
    'floor': ()=>new FloorCeilConfiguration,
}

function updateDataList() {   
    assets.value = create_datalist(async ()=>{
        const lst = await server.getDDLFiles(AssetGroup.WALLS);
        return lst.files.map(x=>({value: x.name}));
    });
}

function doModal(item: AssetConfiguration | null, type:type_enum) : Promise<AssetConfiguration|null> {
    if (resolver) {
        cancel();
    }
    return new Promise<AssetConfiguration|null>(ok=>{
        resolver = ok;
        cur_type.value = type;
        cur_item.value = constructors[type]();
        if (item) {
            Object.assign(cur_item.value, item);
        } 
        dlgref.value?.showModal();      
        updateDataList();
    });
}

defineExpose({doModal});

function cancel() {
    if (resolver) resolver(null);
    resolver = null;
    dlgref.value?.close();
}

function accept(x: AssetConfiguration ) {
    if (resolver) resolver(toRaw(x));
    resolver = null;
    dlgref.value?.close();
}

function save() {
    if (cur_item.value) accept(cur_item.value);
}


function dupFrame() {
    const itm = cur_item.value;
    if (!itm) return;
    if (itm instanceof WallConfiguration) {
        const f = itm.graphics[cur_frame.value]
        itm.graphics.splice(cur_frame.value,0,[f[0],f[1],f[2]]);
        cur_frame.value++;
    } else if (itm instanceof FloorCeilConfiguration) {
        const f = itm.pixmaps[cur_frame.value]
        itm.pixmaps.splice(cur_frame.value,0,f);
        cur_frame.value++;
    }

}

function delFrame() {
    const itm = cur_item.value;
    if (!itm) return;
    if (itm instanceof WallConfiguration) {
        itm.graphics.splice(cur_frame.value,1);
        if (cur_frame.value) cur_frame.value--;    
    } else if (itm instanceof FloorCeilConfiguration) {
        itm.pixmaps.splice(cur_frame.value,1);
        if (cur_frame.value) cur_frame.value--;    
    }
}


</script>
<template>
    <dialog ref="dlgref">
        <template v-if="cur_type && cur_item">
            <header> {{ win_title[cur_type]  }}<div class="close" @click="cancel"></div></header>
                <div v-if="(cur_item instanceof WallConfiguration)">
                    <div class="wall-preview checkerboard" ref="preview_place"></div>
                    <div class="control">
                        <button @click="dupFrame" >+</button>
                        <button @click="cur_frame = cur_frame>0?cur_frame-1:cur_frame"
                            >&lt;&lt;</button> {{ cur_frame+1 }} / {{ cur_item.graphics.length }} <button
                            @click = "cur_frame = cur_frame>=cur_item.graphics.length-1?cur_item.graphics.length-1:cur_frame+1">&gt;&gt;</button>
                        <button @click="delFrame" :disabled="cur_item.graphics.length<2">-</button>
                    </div>
                    <x-section>
                        <x-section-title>Configuration</x-section-title>
                        <x-form>
                            <label><span>Name:</span><input  type="text" v-model="cur_item.name"></label>
                            <label><span>Front (main):</span><input  type="text" v-model="cur_item.graphics[cur_frame][0]" :list="assets.id"></label>
                            <label><span>Left :</span><input type="text" v-model="cur_item.graphics[cur_frame][1]" :list="assets.id"></label>
                            <label><span>Right :</span><input type="text" v-model="cur_item.graphics[cur_frame][2]" :list="assets.id"></label>
                            <label><span title="Specifies offset from outer edge of left/right pixmap in pixels where enemies going through the wall are clipped">Clip(?)</span><input  type="text" v-model="cur_item.lclip" v-watch-range min="1" max="16"></label>
                            <label><input  type="checkbox" v-model="cur_item.transparent"><span>Transparent (can see through)</span></label>
                            <label><input  type="checkbox" v-model="cur_item.alternate"><span>Alternating</span></label>
                            <label><input  type="checkbox" v-model="cur_item.repeat_anim"><span>Repeat animation</span></label>
                            <label><input  type="checkbox" v-model="cur_item.ping_pong"><span>Ping ping animation</span></label>
                            <label><input  type="checkbox" v-model="cur_item.forward_dir"><span>Animate forward</span></label>
                            <label><input  type="checkbox" v-model="cur_item.secondary_front"><span>If secondary, draw as sector's backdrop</span></label>
                            <label><span>Offset [X,Y]</span>
                                <div><input type="number" :disabled="!cur_item.allow_offset" v-model="cur_item.offset_x" v-watch-range min="-255" max="+255">
                                <input type="number" v-model="cur_item.offset_y" v-watch-range min="-255" max="+255"></div></label>
                            <label><input  type="checkbox" v-model="cur_item.allow_offset"><span>Use offset when viewed from the side (secondary)</span></label>
                            <label><span>Primary wall position</span><select v-model="cur_item.position">
                                <option :value="0">Normal (default)</option>
                                <option :value="1">Above</option>
                                <option :value="2">Below</option>
                            </select></label>
                        </x-form>
                    </x-section>
                </div>
                <div v-else-if="(cur_item instanceof ArcConfiguration)">
                    <div class="wall-preview checkerboard" ref="preview_place"></div>
                    <x-section>
                        <x-section-title>Configuration</x-section-title>
                        <x-form>
                            <label><span>Name:</span><input  type="text" v-model="cur_item.name"></label>
                            <label><span>Left :</span><input type="text" v-model="cur_item.left" :list="assets.id"></label>
                            <label><span>Right :</span><input type="text" v-model="cur_item.right" :list="assets.id"></label>
                        </x-form>
                    </x-section>                        
                </div>
                <div v-else-if="(cur_item instanceof FloorCeilConfiguration)">
                    <div class="floor-preview" ref="preview_place">
                    </div>
                    <div class="control">
                        <button @click="dupFrame" :disabled="cur_item.pixmaps.length>=8">+</button>
                        <button @click="cur_frame = cur_frame>0?cur_frame-1:cur_frame"
                            >&lt;&lt;</button> {{ cur_frame+1 }} / {{ cur_item.pixmaps.length }} <button
                            @click = "cur_frame = cur_frame>=cur_item.pixmaps.length-1?cur_item.pixmaps.length-1:cur_frame+1">&gt;&gt;</button>
                        <button @click="delFrame" :disabled="cur_item.pixmaps.length<2">-</button>
                    </div>
                    <x-section>
                        <x-section-title>Configuration</x-section-title>
                        <x-form>
                            <label><span>Name:</span><input  type="text" v-model="cur_item.name"></label>
                            <label><span>Bitmap :</span><input type="text" v-model="cur_item.pixmaps[cur_frame]" :list="assets.id"></label>
                            <label><span>Mode: </span><select v-model="cur_item.mode">
                                <option :value="-1">Animated</option>
                                <option :value="0">Single (1 frame)</option>
                                <option :value="1">Alternate (2 frames)</option>
                                <option :value="2">Two directions (2 frames)</option>
                                <option :value="3">Two directions alternating (4 frames)</option>
                                <option :value="4">Four directions (4 frames)</option>
                                <option :value="5">Four directions alternating (8 frames)</option>
                            </select></label>
                            <template v-if="cur_type == 'floor'">
                                <label><input type="checkbox" v-model="cur_item.button" /><span>Button off/on (x2 frames)</span></label>
                                <label><input type="checkbox" v-model="cur_item.fog_to_black" /><span>Interior (fog to black) </span></label>
                            </template>
                        </x-form>
                    </x-section>   
                </div>

            <footer>
                <button @click="save">Save</button>
                <button @click="cancel">Cancel</button>
            </footer>
        </template>
    </dialog>
</template>

<style lang="css" scoped>

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

</style>