<script lang="ts" setup>
import { type KeepAliveData, server, type DDLEntry } from '@/core/api';
import type { WsRpcResult } from "@/core/wsrpc";
import { computed, onMounted, ref } from 'vue';
import StatusBar from './statusBar.ts';
import { useRouter } from 'vue-router';

const dlg = ref<HTMLDialogElement>();
const list_of_projects = ref<DDLEntry[]>();
const force_switch = ref(false);
const marked_projects = ref<Record<string, boolean> >({});
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
    dlg.value?.showModal();    
}

function server_keep_alive(st:KeepAliveData) {
    if (st.current_ddl) {
        cur_project = st.current_ddl;
        StatusBar.set_project_switch(st.current_ddl, switch_project);
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
}

async function project_selected(name: string) {
    name = name.trim();
    if (!name.endsWith(".ddl")) name = name+".ddl";
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
        <label><span>Create new project</span><input type="text" v-model="entered_name" @keydown="ev=>is_valid_name && ev.key =='enter'?project_selected(entered_name):null"></input></label>
    </x-form>
    <footer>
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