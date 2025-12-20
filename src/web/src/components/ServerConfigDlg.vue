<script lang="ts" setup>
import { server, type KeepAliveStatus } from '@/core/api';
import { onMounted, reactive, ref, watch } from 'vue';

const shown = defineModel();

const dlg = ref<HTMLDialogElement>();
const show_dlg = ref<boolean>(false);

watch([show_dlg, shown],()=>{
    if (show_dlg.value || shown.value) {
        dlg.value?.showModal();
    } else {
        dlg.value?.close();
    }
})

watch(dlg, async ()=>{
    const d = dlg.value;
    if (d) {
        const cfg = await server.get_config();
        game_folder.value = cfg.game_dir;
        Object.assign(config, game_folder.value);
    }
})

function server_keep_alive(st:KeepAliveStatus) {
    show_dlg.value = st.connected && st.need_configure;
}


function init() {
    server.on_keep_alive(server_keep_alive);
}

onMounted(init);

const game_folder = ref("");

interface SkeldalIni {
    window_width: number;
    window_height: number;
    fullscreen: boolean;
    crt_filter:string;
    composer:string;
    scale_quality: string;
    aspect_ratio: string;
    cursor_size: number;
};

const config = reactive<SkeldalIni>({
    window_width:640,
    window_height:480,
    fullscreen:false,
    crt_filter:"auto",
    composer:"auto",
    scale_quality:"best",
    aspect_ratio: "4:3",
    cursor_size:100
});
const error_game_path = ref(false);

function click_browse() {
    alert("Requires Electron");
}

async function store_config() {
    const cfg = {
        game_dir : game_folder.value,
        skeldal_ini: config
    };
    const r = await server.set_config(cfg);
    if (r) {
        show_dlg.value = false;
        shown.value = false;
    } else {
        error_game_path.value = true;
    }
}

</script>
<template>
<dialog ref="dlg">
    <header>Backend configuration</header>
    <div class="path">
        <div>Game folder</div>
        <div class="oneline"><input type="text" v-model="game_folder" @input="error_game_path = false"/><button @click="click_browse">Browse</button></div>
    </div>
    <p v-if="error_game_path" class="error">Entered path is not valid</p>
    <hr />
    <x-form>
        
        <label><input type="checkbox" v-model="config.fullscreen"/><span>Run fullscreen</span></label>
        <label><span>Window width</span><input type="number" v-model="config.window_width" :disabled="config.fullscreen" v-watch-range min="100" max="10240" /></label>        
        <label><span>Window height</span><input type="number" v-model="config.window_height" :disabled="config.fullscreen" v-watch-range min="100" max="10240" /></label>        
        <label><span>CRTFilter</span><select v-model="config.crt_filter">
            <option>none</option>
            <option>auto</option>
            <option>scanline</option>
            <option>scanline_2</option>
            <option>rgbmatrix_2</option>
            <option>rgbmatrix_3</option>
        </select></label>
        <label><span>Composer</span><select  v-model="config.composer">
            <option>auto</option>
            <option>hardware</option>
            <option>software</option>
        </select></label>
        <label><span>Scale quality</span><select  v-model="config.scale_quality">
            <option>best</option>
            <option>linear</option>
            <option>nearest</option>
        </select></label>        
        <datalist id="aspectratio_list">
            <option>none</option>
            <option>4:3</option>
        </datalist>
        <label><span>Aspect ratio</span><input type="search" list="aspectratio_list" v-model="config.aspect_ratio" /></label>
        <label><span>Cursor scale</span><input type="number" v-watch-range min="1" max="1000" v-model="config.cursor_size"/></label>
    </x-form>
    <footer>
        <button :disabled="game_folder.length == 0" @click="store_config">OK</button>
        <button :disabled="show_dlg" @click="shown = false">Cancel</button>
    </footer>
</dialog>
    
</template>
<style lang="css" scoped>
dialog {
    width: 30rem;
}
.path > .oneline {
    width: 100%;
    display: flex;
}
.path > .oneline > input {
    flex-grow: 1;
}
x-form input, x-form select {
    width: 6rem;
}
.error {
    color: red;
}

</style>