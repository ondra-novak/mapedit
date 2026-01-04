<script setup lang="ts">
import { onMounted, ref, shallowRef, triggerRef } from 'vue';
import { registerMissingFilesUI, type IMissingFiles } from './missingFiles';
import type { ApiClient } from '@/core/api';
import type { AssetGroupType } from '@/core/asset_groups';
import { loadBinaryContent } from '@/core/binary';
import { readFileToArrayBuffer } from '@/core/read_file';

class MissingFile {
    public readonly api: ApiClient;
    public readonly filename: string;
    public readonly group: AssetGroupType;
    public readonly prom: Promise<boolean>;
    public readonly resolve: (x:boolean)=>void;    

    constructor(api: ApiClient,filename: string,group: AssetGroupType) {
        this.api = api;
        this.filename = filename;
        this.group = group;
        let resolv = (x:boolean)=>{};
        this.prom = new Promise<boolean>(ok=>resolv = ok);
        this.resolve = resolv;
    }    
};

const missingFiles = shallowRef<Record<string, MissingFile > >({});
const dialogRef = ref<HTMLDialogElement>();

    

function isListEmpty() {
    for (const k in missingFiles.value) {
        return false;
    }
    return true;
}

function resolveItem(f:MissingFile, r: boolean) {
    f.resolve(r);
    delete missingFiles.value[f.filename];
    triggerRef(missingFiles);
    if (isListEmpty()) {
        dialogRef.value!.close();
    }

}


async function reportMissingFile(api: ApiClient, filename: string, group: AssetGroupType): Promise<boolean> {
    const probe = missingFiles.value[filename];
    if (probe) return probe.prom;        
    const show = isListEmpty();
    const inst = new MissingFile(api,filename,group);
    missingFiles.value[filename] = inst;
    triggerRef(missingFiles);
    if (show) {
        dialogRef.value!.showModal();
    }
    return inst.prom;
}

const ifc : IMissingFiles = {
    reportMissingFile
}

function getExtension(n: string) {
    const idx = n.lastIndexOf('.');
    return n.substring(idx);
}

async function import_file(ev: Event, f: MissingFile) {
    const fev = ev as InputEvent;
    const el =  fev.target as  HTMLInputElement;
    if (el.files?.length === 1) {
        const blob = el.files[0];
        if (blob.name.toUpperCase() != f.filename.toUpperCase()) {
            return;
        }
        el.disabled = true;
        try {
            const data =  await readFileToArrayBuffer(blob);
            const r = await f.api.putDDLFile(f.filename, data, f.group);
            if (r) {
                resolveItem(f, true);
            } 
        } catch (e) {
            console.error(e);
        }
        el.disabled = false;
        el.value="";
    }
}


function reject_import(f:MissingFile) {
    resolveItem(f, false);

}

onMounted(()=>{
    registerMissingFilesUI(ifc);
})

function skipAll() {
    Object.values(missingFiles.value).forEach(x=>resolveItem(x,false));
}

</script>
<template>
<dialog ref="dialogRef">
    <header>Missing files<button class="close" @click="skipAll"></button></header>
    <p>Following files are missing, please import them from game's original location</p>
    <div class="list">
        <div v-for="(f,n) of missingFiles" :key="n">
            <div> {{ n }}</div>
            <div><input type="file" @change="event =>import_file(event, f)" :accept="getExtension(n)"></input></div>
            <div><button @click="reject_import(f)">Skip</button></div>
        </div>
    </div>
    <footer></footer>
</dialog>
</template>
<style lang="css" scoped>
    .list > div {
        display: flex;        
    }
    .list {
        margin-bottom: 1rem;
    }

    .list > div > *:nth-child(1) {
        width: 10rem;
        padding: 0.4rem;
    }
    .list > div > * {
        border: 1px dotted;
        margin-right: -1px;
        margin-bottom: -1px;
        padding: 0.2rem;
    }
    
</style>