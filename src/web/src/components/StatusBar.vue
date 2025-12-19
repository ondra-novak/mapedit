<script lang="ts" setup>
import StatusBar, { type IGameClientControl, type ISaveRevert } from '@/components/statusBar.ts';
import { onMounted, ref, watch } from 'vue';

const current_project = ref<string>();
const current_map = ref<string>();
let current_project_click = ()=>{};
let current_map_click = ()=>{};

const save_ifc = ref<ISaveRevert>();
const changed_flag = ref(false);
const connect_status = ref(false);
const client_status = ref(false);
const ghost_form = ref(false);
const confirm_shown = ref(false);

type Location = {
    sector: number;
    side: number;
    map_save_cb: ()=>Promise<boolean>;    
}

const location = ref<Location>();


const game_client_cntr = ref<IGameClientControl>();


function remove_save_and_revert() {
    if (save_ifc.value  && changed_flag.value) {
        save_ifc.value.save();
        save_ifc.value = undefined;        
    }
}

function register_save_and_revert (ifc: ISaveRevert) {
    remove_save_and_revert();
    save_ifc.value = ifc;
    changed_flag.value = false;
}
function set_changed(changed:boolean) {
    changed_flag.value = changed;
}
function final_save() {
    remove_save_and_revert();
}

function save_clicked() {
    if (save_ifc.value) {
        Promise.resolve(save_ifc.value.save()).then(b=>{            
            if (b === undefined || b) changed_flag.value=false;
        });
    }
}

function revert_clicked() {
    if (save_ifc.value) {
        save_ifc.value.revert();
        changed_flag.value = false;
    }
}

function set_project_switch (name: string, on_click: ()=>void) {
    current_project.value = name;
    current_map_click = on_click;
    unset_current_sector();
}
function set_map_switch (name: string, on_click: ()=>void) {
    current_map.value = name;
    current_map_click = on_click;
    unset_current_sector();
}
function register_game_client_cntr (ifc: IGameClientControl) {
    game_client_cntr.value = ifc;
}
function set_current_sector(sector: number, side: number, map_save_cb: ()=>Promise<boolean>) {
    location.value = {sector,side,map_save_cb};
}
function update_connect_status(st: boolean) {
    connect_status.value = st;
}
function update_client_status(st:boolean) {
    client_status.value = st;
}
function unset_current_sector() {
    location.value = undefined;
}


onMounted(()=>{
    StatusBar.attach_component({
        register_save_and_revert,
        set_changed,
        set_project_switch,
        set_map_switch,
        register_game_client_cntr,
        unset_current_sector,
        set_current_sector,
        final_save,
        update_connect_status,
        update_client_status
    })
})

function stop_client() {
    if (game_client_cntr.value) {
        game_client_cntr.value.stop();
        client_status.value = false;
    }
}

function reload_client() {
    if (game_client_cntr.value) {
        game_client_cntr.value.restart();
    }
}

function start_client() {
    if (game_client_cntr.value) {
        game_client_cntr.value.start();
        client_status.value = true;
    }
}

function teleport() {
    const gcc = game_client_cntr.value;
    const lc = location.value;
    const cm = current_map.value;
    if (gcc && lc && cm) {
        lc.map_save_cb().then(cont=>{
            if (cont) {
                gcc.teleport_to(cm, lc.sector, lc.side, {ghost_form:ghost_form.value});
            }
        });
    }
}

function show_confirm() {
    setTimeout(()=>{
        confirm_shown.value = true;
        const stp: Record<string,any> = {};

        const dismiss = () => {
            window.removeEventListener("click",dismiss);
            confirm_shown.value = false;
            stp.watch();
        }
        stp.watch = watch([save_ifc,changed_flag,confirm_shown], dismiss);

        window.addEventListener("click", dismiss);
    },50);
}


</script>
<template>
    <div class="bar">
        <div class="left">
            <div class="project" v-if="current_project" @click="current_project_click"> {{ current_project }}</div>
            <div class="map" v-if="current_map" @click="current_map_click"> {{ current_map }}</div>            
            <template v-if="game_client_cntr">
                <div class="game" :class="{running:client_status}"></div>
                <template v-if="client_status">
                    <div><button @click="stop_client">Stop</button></div>
                    <div><button @click="reload_client">Reload</button></div>
                    <div><button @click="teleport" :disabled="!location || !current_map">Teleport</button></div>
                    <div><label><input type="checkbox" v-model="ghost_form">Ghost form</input></label></div>
                </template>
                <template v-else>
                    <div>
                        <button @click="start_client">Start game</button>
                    </div>
                </template>
            </template>
        </div>
        <div class="right">
            <template v-if="save_ifc">
                <button  :disabled="!changed_flag" @click="show_confirm">Revert</button>
                <button  :disabled="!changed_flag" @click="save_clicked">Save</button>
                <div class="revert-confirm" v-if="confirm_shown">
                    Confirm you want to revert changes <button @click="revert_clicked">Confirm</button>
                </div>
            </template>
        </div>
    </div>
</template>
<style lang="css" scoped>
.bar {
    display:flex;
    justify-content: space-between;
}

.right {
    display: flex;
    gap: 0.2rem;
    height: 2rem;
}

.right > button {
    width: 6rem;
    font-size: 1.1rem;
}

.revert-confirm {
    position: absolute;
    right: 7em;
    bottom: 2.5em;
    border: 1px solid;
    background-color: white;
    padding: 1rem;
}
.left {
    display:flex;
    gap: 0.5rem;
    align-items: stretch;
    height: 2rem;
    
}

.left > * {
    border-right: 1px solid;
    background-color: #ccc;
    line-height: 2rem;
    padding: 0 0.5rem;
}

.left > .project,.left > .map {
    cursor: pointer;
}
.left > .project:hover,.left > .map:hover {
    cursor: pointer;;
    background-color: white;
}

.left > .project::before {
    content: "Project: ";
}
.left > .map::before {
    content: "Map: ";
}




</style>