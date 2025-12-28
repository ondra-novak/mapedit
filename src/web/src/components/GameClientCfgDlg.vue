<script lang="ts" setup>
import { server, type KeepAliveData } from '@/core/api';
import { onMounted, reactive, ref, watch } from 'vue';
import StatusBar from './statusBar.ts';
import type { TeleporToFlags } from './statusBar';
import type { WsRpcResult } from "@/core/wsrpc";

const show_dlg_user = ref(false);
const dlg = ref<HTMLDialogElement>();
const show_dlg = ref<boolean>(false);
let reg_ok = false;

function start() {
    server.game_client_start();
}

function stop() {
    server.game_client_stop();
}
function reload() {
    server.game_client_reload();

}

function teleport_to(map_name: string, sector: number, side: number, flags: TeleporToFlags) {
    server.game_client_teleport(map_name, sector, side);

    const console_cmds = ["ghost-form","no-hassle","iron-skin","levitation"];
    const sw = flags.ghost_form?"on":"off";
    const cmd = console_cmds.map(n=> n + " " + sw).join("~");
    server.game_client_console_exec(cmd);        
}


function configure() {
    show_dlg_user.value = true;
}





watch([show_dlg, show_dlg_user],()=>{
    if (show_dlg.value || show_dlg_user.value) {
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
        Object.assign(config, cfg.skeldal_ini);
    }
})

function on_connection_state_change(x:boolean) {
    StatusBar.update_connect_status(x);
}

function on_state_change(x: WsRpcResult) {
    const st = x.data as KeepAliveData;
    StatusBar.update_client_status(st.game_instances>0);
    if (!st.need_configure && !reg_ok) {
            StatusBar.register_game_client_cntr({
                start,
                reload,
                teleport_to,
                stop,
                configure

            })
            reg_ok = true;
    }
    show_dlg.value = st.need_configure && !!st.current_ddl;

    
}

function init() {
    server.on_connection_state_change(on_connection_state_change);
    server.on("state", on_state_change);
    
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
        show_dlg_user.value = false;
    } else {
        error_game_path.value = true;
    }
}

</script>
<template>
<dialog ref="dlg">
    <header>Game client configuration</header>
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
        <button :disabled="!game_folder?.length" @click="store_config">OK</button>
        <button :disabled="show_dlg" @click="show_dlg_user = false">Cancel</button>
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