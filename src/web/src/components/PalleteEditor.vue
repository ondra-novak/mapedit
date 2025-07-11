<script setup lang="ts">
import { server, type Config } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { ArcConfiguration, AssetConfiguration, ConfigurationPalette, FloorCeilConfiguration, WallConfiguration } from '@/core/map_structs';
import { shallowClone } from '@/utils/document';
import { nextTick, ref, Teleport, watch, type Ref } from 'vue';
import CanvasView from './CanvasView.vue';
import { PCX, PCXProfile } from '@/core/pcx';
import { messageBoxConfirm } from '@/utils/messageBox';


const model = defineModel<string>()
const add_mark = "!!!!ADD!!!";

const props = defineProps<{
    palette: ConfigurationPalette<WallConfiguration> | ConfigurationPalette<FloorCeilConfiguration> | ConfigurationPalette<ArcConfiguration>,
    listview: boolean
}>();

const emits = defineEmits<{
    (e:"add", conf: AssetConfiguration): void,
}>();

const edit_item = ref<string>();
const list_assets = ref<string[]>();
const cur_wall = ref<WallConfiguration>();
const cur_arc = ref<ArcConfiguration>();
const cur_floorceil = ref<FloorCeilConfiguration>();
const cur_frame = ref<number>(0);


const preview_place = ref<HTMLElement>();


watch(edit_item, async () => {
    cur_wall.value = undefined;
    cur_arc.value = undefined;
    cur_floorceil.value = undefined;
    if (edit_item.value) {
        if (props.palette.holds(WallConfiguration)) {
            cur_wall.value = props.palette.map[edit_item.value] as WallConfiguration;
        } else if (props.palette.holds(ArcConfiguration)) {
            cur_arc.value = props.palette.map[edit_item.value] as ArcConfiguration;
        } else if (props.palette.holds(FloorCeilConfiguration)) {
            cur_floorceil.value = props.palette.map[edit_item.value] as FloorCeilConfiguration;
        } 
    } else {
        if (props.palette.holds(WallConfiguration)) {
            cur_wall.value = new WallConfiguration();
            cur_wall.value.graphics = [["","",""]];
            cur_wall.value.anim_frames = 1;
        } else if (props.palette.holds(ArcConfiguration)) {
            cur_arc.value = new ArcConfiguration();
        } else if (props.palette.holds(FloorCeilConfiguration)) {
            cur_floorceil.value = new FloorCeilConfiguration();
        } 
    }
    cur_frame.value = 0;
    const lst = (await server.getDDLFiles(AssetGroup.WALLS, null)).files.map(x=>x.name);
    list_assets.value = lst;
})

watch([cur_wall, cur_frame, preview_place],async ()=>{
    const cw = cur_wall.value;
    const pp = preview_place.value;
    const cf = cur_frame.value;
    if (cw && pp && cf !== undefined) {
        const rs = cw.graphics[cf].map(n=>{
            if (!n) n = "EMPTY.PCX";
            return server.getDDLFile(n).then((buff)=>{
                return PCX.fromArrayBuffer(buff).createCanvas(PCXProfile.wall);
            },()=>document.createElement("canvas"));
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
            if (!n) n = "EMPTY.PCX";
            return server.getDDLFile(n).then((buff)=>{
                return PCX.fromArrayBuffer(buff).createCanvas(PCXProfile.wall);
            },()=>document.createElement("canvas"));
        })
        const [left,right] = await Promise.all(rs);
        pp.innerHTML = "";
        pp.appendChild(document.createElement("div"));
        pp.appendChild(left);
        pp.appendChild(right);
    }
},{deep:true})


function showDetail() {
    if (model.value && model.value != add_mark) {
        edit_item.value = model.value;
    }
}

function cloneWall() {
    if (cur_wall.value) {
        if (edit_item.value) {
            const w = shallowClone(cur_wall.value) as WallConfiguration;
            w.graphics = w.graphics.map(x=>shallowClone(x) as string[]);
            edit_item.value = "";
            nextTick(()=>{
                cur_wall.value = w;
            });    
        } else {
            const cw = cur_wall.value;
            cw.anim_frames = cw.graphics.length * (cw.alternate?2:1);
            emits("add", cw);
            cur_wall.value = undefined;
            edit_item.value = undefined;
        }
    } else if (cur_arc.value) {
        if (edit_item.value) {
            const w = shallowClone(cur_arc.value) as ArcConfiguration;
            edit_item.value = "";
            nextTick(()=>{
                cur_arc.value = w;
            });    
        } else {
            const cw = cur_arc.value;            
            emits("add", cw);
            cur_arc.value = undefined;
            edit_item.value = undefined;
        }

    }
}

watch([model],()=>{
    if (model.value == add_mark) {
        edit_item.value="";
    }
})

function closeDlg() {
    edit_item.value = undefined;
    if (model.value == add_mark) model.value = "";
}

function dupFrame() {
    if (cur_wall.value) {
        const f = cur_wall.value.graphics[cur_frame.value]
        cur_wall.value.graphics.splice(cur_frame.value,0,[f[0],f[1],f[2]]);
        cur_frame.value++;
    }

}

function delFrame() {
    if (cur_wall.value) {
        cur_wall.value.graphics.splice(cur_frame.value,1);
        if (cur_frame.value) cur_frame.value--;
    }
}


</script>
<template>
<select v-model="model" :size="props.listview?2:1" @dblclick="showDetail">
    <option value="">(none)</option>
    <option :value="add_mark">Add new...</option>
    <option v-for="(val, k) of props.palette.map" :key="k" :value="k"> {{ val.get_name() }}</option>
</select>
<Teleport to="body">
<div class="popup-lb" v-if="edit_item !== undefined">
    <div class="edit-window">
        <datalist id="palette5578"><option v-for="v of list_assets" :key="v" :value="v"></option></datalist>
        <div class="content">
            <div v-if="cur_wall">
                <div class="wall-preview checkerboard" ref="preview_place">
                </div>
                <div class="control">
                    <button @click="dupFrame" :disabled="!!edit_item">+</button>
                    <button @click="cur_frame = cur_frame>0?cur_frame-1:cur_frame"
                        >&lt;&lt;</button> {{ cur_frame+1 }} / {{ cur_wall.graphics.length }} <button
                        @click = "cur_frame = cur_frame>=cur_wall.graphics.length-1?cur_wall.graphics.length-1:cur_frame+1">&gt;&gt;</button>
                    <button @click="delFrame" :disabled="!!edit_item || cur_wall.graphics.length<2">-</button>
                </div>
                <x-section>
                    <x-section-title>Configuration</x-section-title>
                    <x-form>
                        <label><span>Name:</span><input :disabled="!!edit_item" type="text" v-model="cur_wall.name"></label>
                        <label><span>Front (main):</span><input :disabled="!!edit_item" type="text" v-model="cur_wall.graphics[cur_frame][0]" list="palette5578"></label>
                        <label><span>Left :</span><input :disabled="!!edit_item"type="text" v-model="cur_wall.graphics[cur_frame][1]" list="palette5578"></label>
                        <label><span>Right :</span><input :disabled="!!edit_item"type="text" v-model="cur_wall.graphics[cur_frame][2]" list="palette5578"></label>
                        <label><span title="Specifies offset from outer edge of left/right pixmap in pixels where enemies going through the wall are clipped">Clip(?)</span><input :disabled="!!edit_item" type="text" v-model="cur_wall.lclip" v-watch-range min="1" max="16"></label>
                        <label><input :disabled="!!edit_item" type="checkbox" v-model="cur_wall.alternate"><span>Alternating</span></label>
                        <label><input :disabled="!!edit_item" type="checkbox" v-model="cur_wall.repeat_anim"><span>Repeat animation</span></label>
                        <label><input :disabled="!!edit_item" type="checkbox" v-model="cur_wall.ping_pong"><span>Ping ping animation</span></label>
                        <label><input :disabled="!!edit_item" type="checkbox" v-model="cur_wall.reverse_dir"><span>Animate reverse</span></label>
                        <label><input :disabled="!!edit_item" type="checkbox" v-model="cur_wall.allow_offset"><span>Allow offset (secondary)</span></label>
                        <label><span>Offset [X,Y]</span>
                            <div><input type="number" :disabled="!cur_wall.allow_offset || !!edit_item" v-model="cur_wall.offset_x" v-watch-range min="-255" max="+255">
                            <input type="number" :disabled="!cur_wall.allow_offset || !!edit_item"v-model="cur_wall.offset_y" v-watch-range min="-255" max="+255"></div></label>
                    </x-form>
                </x-section>
            </div>
            <div v-if="cur_arc">
                <div class="wall-preview checkerboard" ref="preview_place">
                </div>
                <x-section>
                    <x-section-title>Configuration</x-section-title>
                    <x-form>
                        <label><span>Name:</span><input :disabled="!!edit_item" type="text" v-model="cur_arc.name"></label>
                        <label><span>Left :</span><input :disabled="!!edit_item"type="text" v-model="cur_arc.left" list="palette5578"></label>
                        <label><span>Right :</span><input :disabled="!!edit_item"type="text" v-model="cur_arc.right" list="palette5578"></label>
                    </x-form>
                </x-section>
            </div>
        </div>
        <div class="buttons">
            <button v-if="edit_item" @click="cloneWall">Clone</button>
            <button v-if="!edit_item" @click="cloneWall">Create</button>
            <button @click="closeDlg">Close</button>
        </div>
        <button class="close" @click="closeDlg"></button>
    </div>
</div>
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
