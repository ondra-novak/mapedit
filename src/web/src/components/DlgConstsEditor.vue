<script lang="ts" setup>
import { server } from '@/core/api';
import { humanDataFromArrayBuffer } from '@/core/character_structs';
import type { DialogConstant } from '@/core/dialog_structs';
import { shopsFromArrayBuffer } from '@/core/shop_structs';
import globalGetEnemies from '@/utils/global_enemy_list';
import globalGetItems from '@/utils/global_item_list';
import { ref, watch } from 'vue';
import MaskedInput from './MaskedInput.vue';


const model = defineModel< Record<string, DialogConstant> >();
const sel_type = ref(0);
const list_items = ref<[number, string][]>([]);
const new_number = ref(0);
const new_ident = ref("");
const new_desc = ref("");


async function load_items() {
    const lst = await globalGetItems();
    list_items.value = lst.map((x,idx)=>[idx, x.jmeno]  as [number,string])
            .sort((a,b)=>a[1].localeCompare(b[1]));
}

async function load_enemies() {
    const lst = await globalGetEnemies();
    list_items.value = lst.map((x,idx)=>[idx, x.name] as [number,string])
            .sort((a,b)=>a[1].localeCompare(b[1]));
}

async function load_shops() {
    const data = await server.getDDLFile("SHOPS.DAT");
    const lst = shopsFromArrayBuffer(data);
    list_items.value = lst.map((x, idx)=>[idx,x.keeper] as [number,string])
            .sort((a,b)=>a[1].localeCompare(b[1]));
}
async function load_charactes() {
    const data = await server.getDDLFile("POSTAVY.DAT");
    const chrs = humanDataFromArrayBuffer(data).characters;
    list_items.value = chrs.map((x, idx)=>[idx,x.jmeno]);
}


async function  update_list() {
    const t = sel_type.value;
    if (!t) return;
    switch (t) {
        case 1:await load_items();break;
        case 2:await load_enemies();break;
        case 3:await load_shops();break;
        case 4:await load_charactes();break;
    }
    update_desc();
}

const typenames = [
    "Number","Item","Enemy","Shop","Character"
];

let desc_untouched: boolean = true;

function update_desc() {
    if (desc_untouched) {
        const t =sel_type.value;
        const n = new_number.value;
        const v = list_items.value.find(x=>x[0] == n);
        if (v) {
            const desc = `${typenames[t]} ${v[1]}`
            new_desc.value = desc;
        }
    }
}

function add_item() {
    if (model.value) {
        model.value[new_ident.value] = {desc: new_desc.value, value: new_number.value};
        desc_untouched = true;
        new_desc.value = "";
        new_ident.value = "";
    }
}

function delete_item(k:string) {
    if (model.value) {
        delete model.value[k];
    }
}

watch(sel_type, update_list);

</script>
<template>
<div class="w">
    <div class="l">
        <table>
            <tbody>
                <tr v-for="(v,k) of model" :key="k">
                    <td>{{ k }}</td>
                    <td>{{ v.value }}</td>
                    <td>{{ v.desc }}</td>
                    <td><button @click="delete_item(k)" class="d">🗑</button></td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="i">
        <x-form>
            <label><span>Type:</span>
            <select v-model="sel_type">
                <option v-for="(v, idx) of typenames" :value="idx" :key="idx"> {{ v }}</option>
            </select>
            </label>
            <label><span>Value</span>
                <input v-if="sel_type==0" v-model="new_number" type="number" v-watch-range min="-32767" max="32767">
                <select v-else v-model="new_number" @change="update_desc">
                    <option v-for="x of list_items" :key="x[0]" :value="x[0]"> {{  x[1] }}</option>
                </select>
            </label>
            <label><span>Identifier:</span><MaskedInput v-model="new_ident" :mask="/^[a-zA-Z_][a-zA-Z0-9_]*$/" /></label>
            <label><span>Description</span>
                <input v-model="new_desc" type="text" @change="desc_untouched = false">
            </label>
            <div class="b">
                <button :disabled="new_ident.length == 0" @click="add_item">Add</button>
            </div>
        </x-form>
    </div>
</div>
</template>
<style lang="css" scoped>
.w {
    display: flex;
    flex-direction: column;
}
.l {
    max-height: 50vh;
    overflow: hidden auto;    
}
table {
    border-collapse: collapse;
    width: 30rem;
}
td {
    border: 1px dotted;
}
td:nth-child(2) {
    text-align: right;
    padding: 0 0.3rem;
}
input[type=number] {
    width: 5rem;
    text-align: center;
}
.b {text-align: right;}
.d {padding:0 0.5rem}
</style>