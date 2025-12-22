<script lang="ts" setup>
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { readFileToArrayBuffer } from '@/core/read_file';
import { computed, ref, watch } from 'vue';

const dlg = ref<HTMLDialogElement>();

const filename = defineModel<string>("filename");
const shown = defineModel<boolean>("show");

const maplist = ref<Record<string,boolean> >({});

async function loadFiles() {
    const lst = await server.getDDLFiles(AssetGroup.MAPS,null)
    const maps = Object.fromEntries(lst.files.filter(x=>x.name.toUpperCase().endsWith(".MAP"))
                          .map(x=>[x.name,false]));
    maplist.value = maps;
}

watch(shown, (nw)=>{
    if (nw) {
        loadFiles();
        dlg.value?.showModal();
    } else {
        dlg.value?.close();
    }
})

async function import_map(ev: Event) {
    const finput = ev.target as HTMLInputElement;
    if (finput.files?.length == 1) {
        const f = finput.files[0];
        if (f) {
            if (f.name.toUpperCase().endsWith(".MAP")) {
                const data = await readFileToArrayBuffer(f);
                const n = dosname_sanitize(f.name);
                if (await server.putDDLFile(dosname_sanitize(n), data, AssetGroup.MAPS, true)) {
                    filename.value = n;
                    shown.value = false;
                }
            }
        }
    }
}

function select_file(x:string) {
    filename.value = x;
    shown.value = false;
    entered_fname.value="";
}

const entered_fname = ref("");

function adjust_fname(s: string) {
    if (!s) return s;
    if (!s.toUpperCase().endsWith(".MAP")) {
        s = s+".MAP";
    }
    return s;
}

function is_valid_fname(s:string) {    
    const d= dosname_sanitize(s);
    return d.length>0 && d.length <= 12;
}

const valid_fname = computed(()=>{
    return is_valid_fname(adjust_fname(entered_fname.value));
})
const empty_list = computed(()=>{
    for (const x in maplist.value) {
        return false;
    }
    return true;
})
const any_selected = computed(()=>{
    return !!Object.values(maplist.value).find(x=>x);
});

const one_selected = computed(()=>{
    return Object.values(maplist.value).filter(x=>x).length == 1;
});

async function delete_selection() {
    const flt = Object.entries(maplist.value).filter(x=>x[1]).map(x=>x[0]);
    if (confirm("Confirm you want delete selected maps: " + flt.join(","))) {
        await Promise.all(flt.map(x=>server.deleteDDLFile(x)));
        loadFiles();
    }
}

async function copy_selected() {
    const f = Object.entries(maplist.value).filter(x=>x[1]).map(x=>x[0])[0];
    const n = entered_fname.value;
    if (f && n && n.toUpperCase() != f.toUpperCase()) {
        if (await server.putDDLFile(n, await server.getDDLFile(f), AssetGroup.MAPS, true)) {
            const ftxt = f.replace(/.MAP$/,".TXT");
            const ntxt = n.replace(/.MAP$/,".TXT");
            await server.putDDLFile(ntxt, await server.getDDLFile(ftxt), AssetGroup.MAPS,false);
            loadFiles();
        }
        entered_fname.value="";
    }
}

</script>
<template>
    <dialog ref="dlg">
        <header>Load map<button class="close" @click="shown = false"></button></header>
        <div class="lst">
            <div v-for="(_,x) of maplist" :key="x">
                <input type="checkbox" v-model="maplist[x]">
                <span @click="select_file(x)" class="linklike">{{ x }}</span>
            </div>       
            <div v-if="empty_list">
                Hic sunt dracones...
            </div>
        </div>

        <hr />
        <x-form>
            <label><span>Import map: </span><input type="file"  @change="ev=>import_map(ev)" accept=".MAP"/></label>
        </x-form>
        <hr />
        <x-form>
            <label><span>Create new map:</span><input type="text" v-model="entered_fname" @change="entered_fname=dosname_sanitize(adjust_fname(entered_fname))"></label>
        </x-form>
        <footer>
            <button class="left" :disabled="!any_selected" @click="delete_selection">Delete</button>
            <button class="left" :disabled="!one_selected || !valid_fname"  @click="copy_selected">Copy</button>
            <button :disabled="!valid_fname" @click="select_file(dosname_sanitize(adjust_fname(entered_fname)))">Create</button>
        </footer>
    </dialog>

</template>
<style lang="css" scoped>

.lst {
    padding: 0.2rem;
    height: 15rem;
    overflow: auto;
    width: 40rem;
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
}
.lst > * > *:first-child {
    width: 2rem;
}
</style>