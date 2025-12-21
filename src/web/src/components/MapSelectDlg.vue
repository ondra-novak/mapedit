<script lang="ts" setup>
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { readFileToArrayBuffer } from '@/core/read_file';
import { computed, ref, watch } from 'vue';

const dlg = ref<HTMLDialogElement>();

const filename = defineModel<string>("filename");
const shown = defineModel<boolean>("show");

const maplist = ref<string[]>([]);

async function loadFiles() {
    const lst = await server.getDDLFiles(AssetGroup.MAPS,null)
    const maps = lst.files.filter(x=>x.name.toUpperCase().endsWith(".MAP"))
                          .map(x=>x.name);
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
}

const entered_fname = ref("");

function adjust_fname(s: string) {
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

</script>
<template>
    <dialog ref="dlg">
        <header>Load map<button class="close" @click="shown = false"></button></header>
        <div class="lst">
            <div v-for="x of maplist" :key="x">
                <input type="checkbox">
                <span @click="select_file(x)" class="linklike">{{ x }}</span>
            </div>       
            <div v-if="maplist.length == 0">
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
            <button class="left">Delete</button>
            <button class="left">Copy</button>
            <button :disabled="!valid_fname">Create</button>
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