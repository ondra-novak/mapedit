<script lang="ts" setup>
import StatusBar, { type IGameClientControl, type SaveRevertControl } from '@/components/statusBar.ts';
import svg_gear from '@/assets/toolbar/gear.svg'

import { onMounted, ref, watch } from 'vue';
import { messageBoxAlert } from '@/utils/messageBox';

const current_project = ref<string>();
const current_map = ref<string>();
let current_project_click = ()=>{};
let current_map_click = ()=>{};



class SaveState {

    #stack: SaveStateStack;
    #on_save: (()=>any)|null =  null;
    #on_revert: (()=>any)|null =  null;
    #changed = false;

    constructor(stack: SaveStateStack) {
        this.#stack = stack;
    }
    on_save(cb:()=>any) {
        this.#on_save = cb;
    }
    on_revert(cb:()=>any) {
        this.#on_revert = cb;
    }
    async do_save() : Promise<any>{
        if (this.#on_save) {
            const res = await Promise.resolve(this.#on_save());
            if (res == undefined || res) {
                this.#changed = false;
                this.#stack.notify_me(this);
            }
        }
    }
    async do_revert() : Promise<any> {        
        if (this.#on_revert) {
            await Promise.resolve(this.#on_revert());
            this.#changed = false;
            this.#stack.notify_me(this);
        }
    }
    set_changed(chg: boolean) {
        this.#changed = chg;
        this.#stack.notify_me(this);
    }
    unmount() {
        if (this.#changed && this.#on_save) {
            this.#on_save();
        }
        this.#stack.remove_me(this);
    }
    can_save() : boolean {
        return !!(this.#changed && this.#on_save);
    }
    can_revert():boolean {
        return !!(this.#changed && this.#on_revert);
    }
    get_changed() {
        return this.#changed
    }
}

class SaveStateStack {

    #stack: SaveState[] = [];
    #notify: ()=>void;

    constructor(notify: ()=>void) {
        this.#notify = notify;
    }

    remove_me(me: SaveState) {
        const idx = this.#stack.findIndex(x=>x === me);
        if (idx >=0) {
            this.#stack = [...this.#stack.slice(0,idx),...this.#stack.slice(idx+1)];
        if (idx == this.#stack.length) this.#notify();
        }
    }
    notify_me(me: SaveState) {
        if (this.#stack[this.#stack.length-1]  == me) {
            this.#notify();
        }
    }

    create() : SaveState {
        const s = new SaveState(this);
        this.#stack.push(s);
        this.#notify();
        return s;
    }

    get_last() {
        return this.#stack[this.#stack.length-1];
    }

    show_ui() {
        return this.get_last() !== undefined;
    }

    can_save() {
        const l = this.get_last();
        return l && l.can_save();
    }
    can_revert() {
        const l = this.get_last();
        return l && l.can_revert();
    }
    do_save() {
        const l = this.get_last();
        return l && l.do_save();
    }
    do_revert() {
        const l = this.get_last();
        return l && l.do_revert();
    }
}



const can_save=ref(false);
const can_revert = ref(false);
const show_save_ui = ref(false);

let save_state_stack = new SaveStateStack(updateSaveUI);

function updateSaveUI() {  
    can_save.value = save_state_stack.can_save();
    can_revert.value = save_state_stack.can_revert();
    show_save_ui.value = save_state_stack.show_ui();
}


const connect_status = ref(true);
const client_status = ref(false);
const ghost_form = ref(false);
const confirm_shown = ref(false);

type Location = {
    sector: number;
    side: number;
    map_save_cb: ()=>Promise<boolean>;    
}

const current_dialog = ref<number|null>(null);


const location = ref<Location>();


const game_client_cntr = ref<IGameClientControl>();

function register_save_control() : SaveRevertControl{
    return  save_state_stack.create();

}


async function save_clicked() {
    can_save.value = false;
    can_revert.value = false;
    await save_state_stack.do_save();
}

async function revert_clicked() {
    can_save.value = false;
    can_revert.value = false;
    await save_state_stack.do_revert();
}

function set_project_switch (name: string, on_click: ()=>void) {
    if (current_project.value != name) {
        unset_current_sector();
    }
    current_project.value = name;
    current_project_click = on_click;
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
function invoke_teleport() {
    if (client_status.value) {
        teleport();
    }
}
function invoke_reload() {
    if (client_status.value) {
        reload_client();
    }
}

function set_current_dialog(id : number|null ){
    current_dialog.value = id;
}

function get_project_name() {
    return current_project.value ?? null
}

onMounted(()=>{
    StatusBar.attach_component({
        register_save_control,
        set_project_switch,
        set_map_switch,
        register_game_client_cntr,
        unset_current_sector,
        set_current_sector,
        update_connect_status,
        update_client_status,
        stop_game: stop_client,
        invoke_teleport,
        invoke_reload,
        set_current_dialog,
        get_project_name
    })
})

function stop_client() {
    if (game_client_cntr.value) {
        game_client_cntr.value.stop();
        client_status.value = false;
    }
}

async function reload_client() {
    const gcc = game_client_cntr.value;
    if (!gcc) return;
    const lc = location.value;
    if (lc) {
        const cont = await lc.map_save_cb();
        if (!cont) return;
    }
    if (can_save.value) {
        save_clicked();
    }
    gcc.reload();
}


async function start_client() {
    if (game_client_cntr.value) {
        try {
            await game_client_cntr.value.start();
            client_status.value = true;
        } catch (e) {
            messageBoxAlert(`Failed to run game: ${(e as Error).message}`);
        }
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
        stp.watch = watch([can_revert,can_revert,show_save_ui,confirm_shown], dismiss);

        window.addEventListener("click", dismiss);
    },50);
}

function test_dialog() {
    const id = current_dialog.value;
    if (id === null) return;
    if (!game_client_cntr.value) return;
    game_client_cntr.value.test_dialog(id);
}

function gear_clicked() {
    if (game_client_cntr.value) {
        game_client_cntr.value.configure();        
    }

}

const error_dlg = ref<HTMLDialogElement>();
watch(connect_status, ()=>{
    if (!connect_status.value) {
        error_dlg.value?.showModal();
    } else {
        error_dlg.value?.close();
    }
})

</script>
<template>
    <div class="bar">
        <div class="left">
            <div class="butt project" v-if="current_project" @click="current_project_click"> {{ current_project }}</div>
            <div class="butt map" v-if="current_map" @click="current_map_click"> {{ current_map }}</div>            
            <template v-if="game_client_cntr">
                <div class="game" :class="{running:client_status}"></div>
                <template v-if="client_status">
                    <div><button @click="stop_client">Stop</button></div>
                    <div><button @click="reload_client">Reload</button></div>
                    <div><button @click="teleport" :disabled="!location || !current_map">Teleport</button></div>
                    <div><label><input type="checkbox" v-model="ghost_form">Ghost form</input></label></div>
                    <div><button @click="test_dialog" :disabled="current_dialog == null">Test dialog</button></div>
                </template>
                <template v-else>
                    <div>
                        <button @click="start_client">Start game</button>
                    </div>
                </template>
            </template>
            <div class="butt" @click="gear_clicked">
                <img :src="svg_gear">
            </div>
        </div>
        <div class="right">
            <template v-if="show_save_ui">
                <button  :disabled="!can_save" @click="show_confirm">Revert</button>
                <button  :disabled="!can_revert" @click="save_clicked">Save</button>
                <div class="revert-confirm" v-if="confirm_shown">
                    Confirm you want to revert changes <button @click="revert_clicked">Confirm</button>
                </div>
            </template>
        </div>
    </div>
    <dialog ref="error_dlg">
        <header>Connection lost</header>
        <p>Connection to backend server has been lost.</p>
        <p>The backend server was probably killed or crashed</p>
        <p>The application can no longer work, please close this window</p>
    </dialog>
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
    align-items: stretch;
    height: 2rem;
    
}

.left > * {
    border-right: 1px solid;
    background-color: #ccc;
    line-height: 2rem;
    padding: 0 0.5rem;
}

.left > .butt {
    cursor: pointer;
}
.left > .butt:hover {
    cursor: pointer;;
    background-color: white;
}

.left > .project::before {
    content: "Project: ";
}
.left > .map::before {
    content: "Map: ";
}

.butt > img {
    width: 1rem;
    vertical-align: text-top;
   
}
.game::before {
    content: "Game: ";
}
.game.running::after{
    content: "running";
}
.game::after{
    content: "stopped";
}


</style>