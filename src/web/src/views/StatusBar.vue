<script setup lang="ts">

import { type DDLEntry, server } from "@/core/api";
import StatusBar from "@/core/status_bar_control";
import { nextTick, onMounted, ref, watch } from "vue";

const vis = StatusBar.visible;
const en = StatusBar.enabled;
const conf = ref<boolean>(false);
const current_ddl = ref(server.get_current_ddl());

const list_of_projects = ref<DDLEntry[]>();
const new_project_name = ref<string>("");



function show_confirm() {
    setTimeout(()=>{
        conf.value = true;
        const stp: Record<string,any> = {};

        const dismiss = () => {
            window.removeEventListener("click",dismiss);
            conf.value = false;
            stp.watch();
        }
        stp.watch = watch([en,vis,conf], dismiss);

        window.addEventListener("click", dismiss);
    },50);
}

function do_revert() {
    conf.value = false;
    StatusBar.triggerRevert();
}

function selectProject() {
    server.listAllDDLs().then(x=>{
        list_of_projects.value = x;
    });
}

function init() {
    if (!current_ddl.value) {
        selectProject();
    }
}

onMounted(init);

</script>
<template>
    <div class="bar">
        <div class="left">

        </div>
        <div class="right">
            <button v-if="vis" :disabled="!en" @click="show_confirm">Revert</button>
            <button v-if="vis"  :disabled="!en" @click="StatusBar.triggerSave">Save</button>
            <div class="revert-confirm" v-if="conf">
                Confirm you want to revert changes <button @click="do_revert">Confirm</button>
            </div>
        </div>
    </div>
    <div v-if="list_of_projects !== undefined" class="select-project-popup">
        <div>
            <div class="srl">
                <div class="row hdr">
                    <div>Name</div><div>Size</div><div>Last edited</div>                
                </div>
                <div class="row dta" v-for="v of list_of_projects!" :key="v.name">
                    <div>{{ v.name }}</div>
                    <div>{{ v.size }}</div>
                    <div>{{ v.last_write.toLocaleString() }}</div>
                </div>
            </div>
            <div class="nw">
                <span>Create new adventure</span>
                <input type="text" v-model="new_project_name">
                <button>Create</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
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

.select-project-popup {
    position: fixed;
    left:0;top:0;right: 0;bottom: 0;
    background-color: #0008;
}

.select-project-popup > div {
    position: absolute;
    left:0;
    right:0;
    top: 20vh;
    background-color: #ddd;
    width: 60%;
    min-width: 30rem;
    padding: 1rem;
    margin: auto;
}

.select-project-popup .srl {
    height: 50vh;
    overflow: auto;
    border: 1px inset #FFF;
}
.select-project-popup .row {
    display:flex;
}
.select-project-popup .row.hdr {
    background-color: #bbb;
    position: sticky;
    top: 0;
}

.select-project-popup .row.dta {
    cursor: pointer;
}
.select-project-popup .row.dta:hover {
    background-color: white;
}

.select-project-popup .row > * {
    padding: 0.2rem;
    border-bottom: 1px solid;
}
.select-project-popup .row > *:first-child {
    flex-grow: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.select-project-popup .row > *:nth-child(2) {
    width: 5rem;
    text-align: right;
    border-left: 1px solid;
    border-right: 1px solid;

}
.select-project-popup .row > *:last-child {
    width: 11rem;
    overflow: hidden;
    text-align: right;
    white-space: nowrap;

}
.select-project-popup .nw {
    display:flex;
    gap: 0.5rem;
    align-items: center;
}
.select-project-popup .nw input {
    flex-grow: 1;
}


</style>