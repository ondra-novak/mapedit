<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { keybcs2_from_string, string_from_keybcs2 } from '@/core/keybcs2';
import { AssetGroup } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { humanDataFromArrayBuffer, humanDataToArrayBuffer, Runes, type THumanData } from '@/core/character_structs';
import MissingFiles from '@/components/MissingFiles.vue';

const missing_files : FileItem[] = [
    {name:"POSTAVY.DAT",group:AssetGroup.MAPS,ovr:true},
];



class BasicInfoData {
    name:string = "My new adventure";
    desc:string = "some description of adventure";
    characters:number = 3;
    start_map: string = "START.MAP";

};

const basic_info = ref<BasicInfoData>(new BasicInfoData);
const postavy_dat = ref<THumanData>()
const runes = ref<Runes>(new Runes());

function reload() {
    server.getDDLFile("_ADV.JSON").then(buff=>{
        const dec = new TextDecoder();
        const s = dec.decode(buff);
        const data = JSON.parse(s);
        Object.assign(basic_info.value, data);
        nextTick(()=>StatusBar.setChangedFlag(false));
    })
    server.getDDLFile("POSTAVY.DAT").then(buff=>{
        postavy_dat.value = humanDataFromArrayBuffer(buff);
        runes.value = postavy_dat.value.runes;
        nextTick(()=>StatusBar.setChangedFlag(false));
    })
}

async function save() {
    const s = JSON.stringify(basic_info.value);
    const enc = new TextEncoder();
    const buff = enc.encode(s).buffer;
    await server.putDDLFile("_ADV.JSON", buff, AssetGroup.UNKNOWN);

    const lines = [];
    lines.push("[ADV]");
    Object.entries(basic_info.value).forEach(e=>{
        lines.push(`${e[0]}=${e[1]}`.replace(/\r?\n/g,"|"));
    });
    const text = lines.join("\r\n");
    const buff2 = Uint8Array.from(keybcs2_from_string(text)).buffer;
    await server.putDDLFile("_ADV.INI", buff2, AssetGroup.UNKNOWN);

    if (postavy_dat.value) {
        const buff3 = humanDataToArrayBuffer(postavy_dat.value);
        await server.putDDLFile("POSTAVY.DAT", buff3, AssetGroup.MAPS);
    }
}

function init() {
    StatusBar.registerSaveAndRevert(async ()=>{
        return await save();
    },()=>{
        reload();
    });

    reload();
}

onMounted(init);
onUnmounted(StatusBar.onFinalSave);

watch([basic_info, runes], ()=>StatusBar.setChangedFlag(true),{deep:true});

</script>
<template>

<x-workspace>
    <x-section>
        <x-section-title>Adventure info</x-section-title>
        <x-form>
            <label><span>Name</span><input type="text" v-model="basic_info.name"></label>
            <label><span>Description</span><textarea cols="80" rows="10" v-model="basic_info.desc"></textarea></label>
            <label><span>Start map</span><input type="text" maxlength="12" v-model="basic_info.start_map" @input="basic_info.start_map=dosname_sanitize(basic_info.start_map)"></label>
            <label><span>Initial number of adventurers</span><input type="number" v-watch-range min="1" max="6" v-model="basic_info.characters"></label>
            <div class="label"><span>Initial runes</span>        <table>
            <tbody>
                <tr v-for="(r, n) of runes" :key="n">
                    <td>{{ n }}</td>
                    <td v-for="(v,idx) of r" :key="idx"><input type="checkbox" v-model="r[idx]" /></td>
                </tr>
            </tbody>
        </table>
        </div>
        </x-form>
    </x-section>    
    

</x-workspace>

<MissingFiles :files="missing_files"  @imported="reload"></MissingFiles>

</template>
<style lang="css" scoped>

</style>