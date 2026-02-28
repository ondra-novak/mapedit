<script setup lang="ts">
import { directions, MAPGLOBAL } from '@/core/map_structs';
import { reactive, ref, watch } from 'vue';
import PlaylistEditor from './PlaylistEditor.vue';

    
const model = defineModel<{mapinfo:MAPGLOBAL, strings: string[]}>();

const emit = defineEmits<{
  (e: 'ok'): void;
  (e: 'cancel'):void;
}>()


const mapname = ref("");
const colorhex = ref("");
const start_sector = ref(0);
const start_dir = ref(0);
const environment = ref(0);
const autofog_floor_ceil = ref(false);

const backdrop_n = ref("");
const backdrop_e = ref("");
const backdrop_s = ref("");
const backdrop_w = ref("");

const fade_mult = ref(0);
const fade_end = ref(0);

const playlist = ref()

const dlg = ref<HTMLDialogElement>();

function update_from_model() {
    const mdl = model.value;
    if (mdl) {
        const m = mdl.mapinfo;
        mapname.value = m.mapname;
        colorhex.value = `#${((m.fade_r << 16) | (m.fade_g << 8) | m.fade_b).toString(16).padStart(6, '0')}`;
        start_sector.value = m.start_sector;
        start_dir.value =  m.start_direction;
        environment.value = m.map_effector;
        autofog_floor_ceil.value = m.map_autofadefc != 0;
        backdrop_n.value = m.back_fnames[0];
        backdrop_e.value = m.back_fnames[1];
        backdrop_s.value = m.back_fnames[2];
        backdrop_w.value = m.back_fnames[3];
        fade_mult.value = m.fade_mult;
        fade_end.value = m.fade_end;
        playlist.value = mdl.strings[0] ?? "";

        dlg.value?.showModal();
    } else {
        dlg.value?.close();
    }
}


function save() {
    const m = new MAPGLOBAL;
    const color = parseInt(colorhex.value.substring(1),16);
    m.fade_b = color & 0xFF;
    m.fade_g = (color >> 8) & 0xFF;
    m.fade_r = (color >> 16) & 0xFF;
    m.map_autofadefc = autofog_floor_ceil.value?1:0;
    m.map_effector = environment.value;
    m.mapname = mapname.value;
    m.start_direction = start_dir.value;
    m.start_sector = start_sector.value;        
    m.back_fnames[0] = backdrop_n.value
    m.back_fnames[1] = backdrop_e.value
    m.back_fnames[2] = backdrop_s.value
    m.back_fnames[3] = backdrop_n.value
    m.fade_end = fade_end.value;
    m.fade_mult = fade_mult.value;
    if (model.value) {
        model.value.mapinfo = m;
        model.value.strings[0] = playlist.value;
        emit("ok");
    }    
}

const envornment_types = [
    "Default (nothing special)",
    "Volcano (very hot)",
    "Cold area",
    "Underwater (needs water breathing item)",
    "City (no rest on street)"
]

watch(model, update_from_model);

</script>
<template>
<dialog ref="dlg">
    <header>Map settings<button class="close" @click="emit('cancel')"></button></header>
    <div>
        <x-section><x-section-title>Basic</x-section-title>
        <x-form>
            <label><span>Map name</span><input type="text" v-model="mapname" maxlength="29"></label>
            <label><span>Fog color</span><div class="col">
                <div><input type="color" v-model="colorhex"></div>
                <div><input type="string" v-model="colorhex"></div>
            </div></label>
            <label><span>Start sector</span><input type="number" v-model="start_sector"></label>
            <label><span>Start direction</span><select v-model="start_dir">
                <option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v }}</option>
            </select></label>
            <label><span>Environment</span><select v-model="environment">
                <option v-for="(v,idx) of envornment_types" :key="idx" :value="idx"> {{ v }}</option>
            </select></label>
            <label><input type="checkbox" v-model="autofog_floor_ceil">Generate fog for floor and ceil images (recommended)</label>
        </x-form>        
        </x-section>
        <x-section><x-section-title>Playlist</x-section-title>
            <PlaylistEditor v-model="playlist" ></PlaylistEditor>
        </x-section>        
        <x-section><x-section-title>Advanced</x-section-title>
            <x-form>
            <label><span>Backdrop north</span><input type="text" v-model="backdrop_n"></label>
            <label><span>Backdrop east</span><input type="text" v-model="backdrop_e"></label>
            <label><span>Backdrop south</span><input type="text" v-model="backdrop_s"></label>
            <label><span>Backdrop west</span><input type="text" v-model="backdrop_w"></label>
            <label><span>Brightness</span><input type="number" v-model="fade_mult"  v-watch-range min="0" max="2" step="0.1"></label>
            <label><span>Fog strength</span><input type="number" v-model="fade_end" v-watch-range min="0" max="1" step="0.1"></label>
            </x-form>
        </x-section>
    </div>
    <footer>
        <button @click="save">OK</button>
        <button @click="model = undefined">Cancel</button>
    </footer>

</dialog>
</template>
<style scoped lang="css">
dialog {
    width: 30rem;
}
.col input {
    width: 6rem;
    box-sizing: border-box;
    text-align: center;
}
input[type=number] {
    width: 6rem;
    text-align: center;
}
</style>