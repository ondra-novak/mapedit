<script setup lang="ts">
import { directions, MAPGLOBAL } from '@/core/map_structs';
import { ref, watch } from 'vue';

    
const model = defineModel<MAPGLOBAL>();

const mapname = ref("");
const colorhex = ref("");
const start_sector = ref(0);
const start_dir = ref(0);
const environment = ref(0);
const autofog_floor_ceil = ref(false);


const dlg = ref<HTMLDialogElement>();

function update_from_model() {
    const m = model.value;
    if (m) {
        mapname.value = m.mapname;
        colorhex.value = `#${((m.fade_r << 16) | (m.fade_g << 8) | m.fade_b).toString(16).padStart(6, '0')}`;
        start_sector.value = m.start_sector;
        start_dir.value =  m.start_direction;
        environment.value = m.map_effector;
        autofog_floor_ceil.value = m.map_autofadefc != 0;

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
    model.value = m;
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
    <header>Map settings<button class="close" @click="model = undefined"></button></header>
    <div>
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