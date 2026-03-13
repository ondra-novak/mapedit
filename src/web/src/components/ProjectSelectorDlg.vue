<script lang="ts" setup>
import { type KeepAliveData, server, type DDLEntry, type ModifiedFileNotify } from '@/core/api';
import type { WsRpcResult } from "@/core/wsrpc";
import { computed, onMounted, ref } from 'vue';
import StatusBar from './statusBar.ts';
import { useRouter } from 'vue-router';
import { parse_stringtable } from '@/core/string_table.ts';
import { ElementTypeName } from '@/core/common_defs.ts';
import { keybcs2string } from '@/core/keybcs2.ts';
import MaskedInput from './MaskedInput.vue';
import { messageBoxAlert } from '@/utils/messageBox.ts';

const dlg = ref<HTMLDialogElement>();
const list_of_projects = ref<DDLEntry[]>();
const force_switch = ref(false);
const marked_projects = ref<Record<string, boolean> >({});
const can_import = ref<boolean>(false);
let cur_project = "";


function switch_project() {
    server.listAllDDLs().then(x=>{        
        list_of_projects.value = x.sort((a,b)=>{
            return b.last_write.getTime() - a.last_write.getTime();
        });
        marked_projects.value = list_of_projects.value.reduce((a,b)=>{
            a[b.name] = false;
            return a;
        }, {} as Record<string, boolean>);
    });
    server.can_import_adventure().then(x=>can_import.value=x);
    dlg.value?.showModal();    
}

async function update_elements() {
    const data = await server.getDDLFile("POPISY.TXT")
    const dec = new TextDecoder();
    const txt = keybcs2string(data);
    const stable = parse_stringtable(txt);
    const ids = [22,23,24,25,26];
    ids.forEach((v,idx)=>{
        const s= stable[v];
        ElementTypeName[idx] = s;
    });
}

function server_keep_alive(st:KeepAliveData) {
    if (st.current_ddl) {
        if (cur_project != st.current_ddl) {
            cur_project = st.current_ddl;
            update_elements();
            StatusBar.set_project_switch(st.current_ddl, switch_project);
        }
    } else {
        if (!force_switch.value) {
            force_switch.value = true;
            switch_project();
        }
    }
}

async function init() {
    server.on("state",(x:WsRpcResult)=>{
        server_keep_alive(x.data);
    });
    server.on("modified", (x:WsRpcResult)=>{
        const n : ModifiedFileNotify = x.data;
        if (n.name == "POPISY.TXT") {
            update_elements();
        }
    })
}

function adjust_name(name:string) {
    name = name.trim();
    if (!name.toLowerCase().endsWith(".ddl"))  name = name + ".ddl";
    return name;
}

async function project_selected(name: string) {
    name = adjust_name(name);
    if (name == cur_project) {
        dlg.value?.close();
        return;
    }
    await server.set_current_ddl(name);
    if (force_switch.value) {
        force_switch.value = false;
        dlg.value?.close();
        StatusBar.set_project_switch(name, switch_project);        
    } else {
        await StatusBar.stop_game();
        location.reload();
    }
}

const entered_name = ref<string>("");
const is_valid_name = computed(()=>{
    const name = entered_name.value.trim();
    const hasValidExtension = name.endsWith(".ddl") || !name.includes(".");
    const hasValidCharacters = /^[a-zA-Z0-9._\-\s]+$/.test(name);
    const isNotReserved = !["con", "prn", "aux", "nul", "com1", "lpt1"].includes(name.toLowerCase());
    
    return name.length > 0 && hasValidExtension && hasValidCharacters && isNotReserved;
});
const any_marked = computed(()=>{
    for (const x in marked_projects.value) {
        if (marked_projects.value[x]) return true;
    }
    return false;
}); 

async function delete_projects() {
    const mk = Object.entries(marked_projects.value).filter(x=>x[1]).map(x=>x[0]);
    if (mk.length == 0) return;
    if (confirm("Confirm you want to delete following projects: "+mk.join(','))) {
        await Promise.all(mk.map(x=>server.delete_ddl(x)));
        switch_project();
    }
}

function on_key_down(ev: KeyboardEvent) {
    if (ev.key == "Enter" && is_valid_name.value) {
        project_selected(entered_name.value)
        ev.preventDefault();
        ev.stopPropagation();
    }
}


async function import_adventure(s:string) {
    const name = adjust_name(s);
    const r = await server.import_adventure_as(name);
    if (r == false) {
        messageBoxAlert("Failed to import adventure");
        return;
    }
    project_selected(name);
}
onMounted(init);

</script>
<template>
<dialog ref="dlg" class="white">
    <header>Select project<button v-if="!force_switch" class="close" @click="dlg?.close()"></button></header>    
    <template  v-if="list_of_projects?.length">
    <div class="lst">        
        <div  v-for="l of list_of_projects" :key="l.name">
            <span><input type="checkbox" v-model="marked_projects[l.name]" :hidden="l.name == cur_project"></input></span>
            <span><span class="linklike" @click="project_selected(l.name)" @keydown="(ev) => ev.key == 'Enter'?project_selected(l.name):null" tabindex="1">{{ l.name }}</span></span>
            <span> {{ (l.size/1024).toFixed(0) }}&nbsp;KiB</span>
            <span> {{ l.last_write.toLocaleString() }}</span>
        </div>
    </div>
    </template>    
    <div v-else class="lst">
        <span>No projects found</span>
    </div>
    <hr />
    <x-form>
        <label><span>Create new project</span><masked-input v-model="entered_name" type="text" @keydown="on_key_down":mask="/^[a-zA-Z0-9._\-]+$/" /></label>
    </x-form>
    <footer>
        <button v-if="can_import" :disabled="!is_valid_name" @click="import_adventure(entered_name)">Import last played adventure</button>
        <button :disabled="!is_valid_name" @click="project_selected(entered_name)">Create</button>
        
        <button class="left" :disabled="!any_marked" @click="delete_projects">Delete</button>

    </footer>

</dialog>

</template>
<style lang="css" scoped>

.lst {
    margin: 0.5rem 0;
    height: 10rem;
    overflow: auto;
}
.lst > div {
    display: flex;
    margin: 0.5rem 0;
}

.lst > div > * {
    display: block;    
}
.lst > div > *:nth-child(1) {
    width: 2rem;
}
.lst > div > *:nth-child(2) {
    width: 10rem;
}

.lst > div > *:nth-child(3) {
    width: 7rem;
    text-align: right;
}

.lst > div > *:nth-child(4) {
    width: 15rem;
    text-align: right;
}
dialog > .right {
    text-align: right;
}

</style>