<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { AnimationTypeIndex, AnimationTypeLetter, AnimationTypeMirror, SeqFile, type AnimationTypeIndexType } from '@/core/seqfile';
import { ref, watch, onMounted, computed,  shallowRef, onUnmounted } from 'vue';
import CanvasView from './CanvasView.vue';
import { PCXProfile, PCX } from '@/core/pcx';
import StatusBar, {type SaveRevertControl} from '@/components/statusBar'
import { EnemyFlags1, type EnemyDef } from '@/core/enemy_struct';

const emit = defineEmits<{
  (e: 'upload', name: string, done?: Promise<any>): void
}>();

const props = defineProps<{
    def?: EnemyDef
}>();


const filename = defineModel<string | null>();
const selfile = ref<string>();
const animations = ref<SeqFile>();
const cur_phase = ref<AnimationTypeIndexType>(AnimationTypeIndex.WALK_FRONT);
const cur_frame = ref<number>(0);
const cur_face = ref<string>("");
const cur_image = shallowRef<PCX>();
const cur_offset = ref<number>(0);
const cur_level = ref<number>(0);
const list_files = ref<string[]>([]);
const big=ref<boolean>(false);
let play_anim = false;
let save_control : SaveRevertControl;

async function onUpdateModel() {
    if (save_control.get_changed()) save();
    if (filename.value) {
        const f = filename.value;
        if (f.endsWith(".SEQ")) {
            selfile.value = f;
        } else {
            selfile.value = f.substring(0,6)+".SEQ";
        }
    } else {
        selfile.value = "";
    }
    const state = await server.getDDLFiles(AssetGroup.ENEMIES, null);    
    const stem = selfile.value?selfile.value.split('.')[0]:"UNKNOWN"
    const ffiles = state.files.filter((x:FileItem)=>{
        return x.name.endsWith(".PCX") && x.name.startsWith(stem);
    });
    list_files.value = ffiles.map(f=>f.name);

    
    try {
        const anim = await server.getDDLFile(selfile.value || "");
        animations.value = SeqFile.fromArrayBuffer(anim, stem);

        if (animations.value.isOldFormat() && props.def) {
            animations.value.big = (props.def.stay_strategy & EnemyFlags1.MOB_BIG) != 0;
            animations.value.hit_pos = (props.def.hit_pos-1);
            for (let i = 0; i < 6; i++) {
                const a = animations.value.animation;
                a[i] =  a[i].splice(0, props.def.anim_counts[i]);                    
                for (let j = 0; j < a[i].length; ++j) {
                    a[i][j].offset_x = props.def.adjusting[i][j+1];
                }
                if (i < 4) {
                    a[i+6][0].offset_x = props.def.adjusting[i][0];
                }
            }            
            save_control.set_changed(true);
        }

        big.value = animations.value.big;
    } catch (e) {
        console.warn(e);
        animations.value = new SeqFile([]);
    }

    onChangePhase();
}   

async function onInit() {
    save_control = await StatusBar.register_save_control();
    save_control.on_save(save);
    save_control.on_revert(onUpdateModel);
    await onUpdateModel();
}


function onChangePhase() {
    if (animations.value) {
        cur_frame.value = 0;    
        onChangeFrame();
        play_anim = false;
    }
}

async function onChangeFrame() {
    if (animations.value && cur_phase.value != undefined && cur_frame.value !== undefined) {
        const sq = animations.value;
        const fr = cur_frame.value;
        const ph = cur_phase.value;
        let pharr = sq.animation[ph];
        if (!pharr) pharr = sq.animation[ph] = [];
        const frinfo = pharr[fr];
        let w = 0;
        if (frinfo) {
            cur_face.value = frinfo.name;
            cur_image.value = PCX.fromArrayBuffer((await server.getDDLFile(frinfo.name)));
            w = cur_image.value.width ;
            if (frinfo.offset_x <= -1000) {
                frinfo.offset_x = w/2;                
            }
            cur_offset.value = frinfo.offset_x;
            cur_level.value = frinfo.offset_y;
        } else {
            cur_face.value = "";            
            cur_offset.value = 0;
            cur_level.value = 0;
        }
    }

}

function go_prev() {
    if (cur_frame.value) --cur_frame.value;
    play_anim = false;
}

function go_next() {
    if (animations.value &&cur_phase.value !== undefined && cur_frame.value !== undefined ) {
            if(cur_frame.value < animations.value.animation[cur_phase.value].length-1) ++cur_frame.value;
            else cur_frame.value = 0;
    } 
}

function insert_frame() {
    if (animations.value && cur_phase.value !== undefined && cur_frame.value !== undefined) {
        animations.value.animation[cur_phase.value].splice(cur_frame.value,0,animations.value.animation[cur_phase.value][cur_frame.value]);
        while (animations.value.animation[cur_phase.value].length > 16) animations.value.animation[cur_phase.value].pop();
        save_control.set_changed(true);
    }
    play_anim = false;
}

function delete_frame() {
    if (animations.value && cur_phase.value !== undefined && cur_frame.value !== undefined && animations.value.animation[cur_phase.value].length>1) {
           animations.value.animation[cur_phase.value].splice(cur_frame.value,1);
           save_control.set_changed(true);
    }
    play_anim = false;
}

let dragging = false;
let dragStartX = 0;
let offsetStart = 0;

function onDragStart(e: MouseEvent | TouchEvent) {
    dragging = true;
    if (e instanceof MouseEvent) {
        dragStartX = e.clientX;
    } else {
        dragStartX = e.touches[0].clientX;
    }
    offsetStart = cur_offset.value;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    play_anim = false;
}

function setOffset(value: number) {
    let pmin = -320;
    let pmax = 320;
    if (cur_image.value) {
        const w = cur_image.value.width/2;
        pmin += w;
        pmax += w;
    }
    cur_offset.value = Math.min(pmax,Math.max(pmin, value));
}


function setLevel(value: number) {
    let pmin = 0;
    let pmax = 320;
    cur_level.value = Math.min(pmax,Math.max(pmin, value));
}

function onDragMove(e: MouseEvent | TouchEvent) {
    if (!dragging) return;
    let clientX = 0;
    if (e instanceof MouseEvent) {
        clientX = e.clientX;
    } else {
        clientX = e.touches[0].clientX;
        e.preventDefault();
    }
    setOffset(offsetStart + (dragStartX - clientX));
}

function onDragEnd() {
    dragging = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('touchmove', onDragMove);
    window.removeEventListener('touchend', onDragEnd);
    onChangeFace();
}

function onChangeFace () {
    if (cur_face.value  !== undefined  && animations.value && cur_phase.value !== undefined  && cur_frame.value  !== undefined )  {
        if (!animations.value.animation[cur_phase.value]) animations.value.animation[cur_phase.value] = [];
        animations.value.animation[cur_phase.value][cur_frame.value] = {
            name:cur_face.value,
            offset_x:cur_offset.value,
            offset_y:cur_level.value
        };
        save_control.set_changed(true);
        onChangeFrame();
    }
    play_anim = false;
}

function play_cycle() {
    setTimeout(()=>{
        if (play_anim) {
            go_next();  
            play_cycle();
        }
    },125)

}

function on_play_anim() {
    play_anim = !play_anim;
    if (play_anim) play_cycle();
}

function save() {
    play_anim = false
    if (animations.value && selfile.value) {
        let p = server.putDDLFile(selfile.value, animations.value.toArrayBuffer(), AssetGroup.ENEMIES)
        emit("upload", selfile.value, p);
    }
}

function changeOffsetDelta(delta:number) {
    setOffset((cur_offset.value || 0) + delta);
    onChangeFace();
}

watch(cur_level, ()=>{
    onChangeFace();
})

function onKeyPress(event: Event) {
    console.log(event);
}

function sethit() {
    if (animations.value) {
        if (animations.value && animations.value.hit_pos == cur_frame.value) animations.value.hit_pos = null;
        else animations.value.hit_pos = cur_frame.value;
        save_control.set_changed(true);
    }
}

function changeBig() {
    if (animations.value) {
        animations.value.big =  big.value;
        save_control.set_changed(true);
    }
}


watch([filename], onUpdateModel);
watch([cur_phase], onChangePhase);
watch([cur_frame], onChangeFrame);
onMounted(onInit);
onUnmounted(()=>save_control.unmount());


const ground_level= computed(()=>{
    const a = animations.value;
    if (!a) return 0;
    const ofs = a.animation[cur_phase.value][cur_frame.value].offset_y;
    return (cur_image.value?.height ?? 0) - (ofs ?? 0);
    
})

</script>
<template>
    <div class="workspace">
        <div class="left-panel">
            <select v-model="cur_phase" size="10">
                <option value="0">Stand/Walk front</option>
                <option value="1">Stand/Walk left</option>
                <option value="3">Stand/Walk right</option>
                <option value="2">Stand/Walk back</option>
                <option value="4">Attack</option>
                <option value="5">Damaged (hit)</option>
                <option value="6">Idle front</option>
                <option value="7">Idle left</option>
                <option value="9">Idle right</option>
                <option value="8">Idle back</option>
            </select>
            <select v-model="cur_face" size="16" @change="onChangeFace">
                <option v-for="v of list_files" :value="v" :key="v">{{ v }} </option>
            </select>
        </div>
        <div class="top-panel">
            <button @click="on_play_anim">|&gt;</button>
            <button @click="go_prev">&lt;&lt;</button>            
            <div> {{  cur_frame+1 }} / {{ animations?animations.animation[cur_phase].length:0 }}</div>
            <button @click="go_next">&gt;&gt;</button>            
            <button @click="insert_frame">+</button>
            <button @click="delete_frame">-</button>
        </div>
        <div class="preview checkerboard" :class="{mirror: AnimationTypeMirror[cur_phase]}" @mousedown="event=>onDragStart(event as MouseEvent)"
            @keypress="event=>onKeyPress" tabindex="1">
            <div class="offset" :style="{left: `${320-cur_offset}px`}" >
                <CanvasView :canvas="cur_image?cur_image.createCanvas(PCXProfile.enemy):null" />
            </div>
            <div class="ruler r1"></div>
            <div class="ruler r2"></div>
            <div class="ruler r3"></div>            
            <div class="hitpos" v-if="cur_phase==4" :class="{active: animations?.hit_pos == cur_frame}" @click="sethit">Hit</div>
        </div>
        <div class="bottom-panel" >
            <button @click="changeOffsetDelta(1)">&lt;</button>
            <button @click="changeOffsetDelta(-1)">&gt;</button>
            <div class="left"><input type="checkbox" v-model="big" @change="changeBig">Big enemy (one on square)</div>
        </div>
    </div>

</template>
<style scoped>
.workspace {
    position: relative;
    padding-left: 10rem;
    padding-top: 2rem;
    min-height: 35rem;
    width: 40rem;
    margin: auto;    
}

.preview {
    border: 1px solid;
    width: 640px;
    position: relative;
    text-align: left;
    overflow: hidden;
}
.preview .ruler {
    display:block;
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-right: 1px dashed black;
    border-left: 1px dashed white;
    
}
.preview .ruler.r1 {
    left:  320px;
}
.preview .ruler.r2 {
    left:  195px;
}
.preview .ruler.r3 {
    left:  445px;
}
.preview .ruler.r4 {
    width: auto;
    height: 0px;
    bottom: auto;
    left: 0;
    right: 0;
    border-bottom: 1px dashed black;
    border-top: 1px dashed white;
}

.preview.mirror > div > div{
    transform: scaleX(-1);
}

.preview > div {
    white-space: nowrap;
}

.preview > div.offset > div {
    display:inline-block
    
}
.preview  .offset {
    width: fit-content;
    position: relative;
}

.left-panel {
    position: absolute;
    left: 0;
    top: 2em;
    display: flex;
    flex-direction: column;
    gap: 1em;
}
.top-panel {
    position: absolute;
    top: 0;
    left: 10em;
    right: 0;    
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1em;
}
.left-panel > select {
    width: 10em;
     overflow-y: auto;
}
.top-panel > div {
    width: 7em;
}

.top-panel > button {
    width: 4em;
    height: 2em;
}

.preview > .hitpos {
    position:absolute;
    right:5px;
    bottom: 5px;
    font-size: 16px;
    width: 2em;
    height: 1em;
    padding: 0.5em;
    text-align: center;
    background-color: #FFF8;
    border-radius: 1em;
    cursor: pointer;
}
.preview > .hitpos.active {
    background-color: red;
    color: yellow;
}

.bottom-panel {
    position:relative;
    text-align: center;
}
.bottom-panel .left {
    position: absolute;
    left: 0;
    top: 0;
}

</style>