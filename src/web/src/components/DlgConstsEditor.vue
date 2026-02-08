<script lang="ts" setup>
import type { DialogConstant } from '@/core/dialog_structs';
import globalGetItems from '@/utils/global_item_list';
import { ref, watch } from 'vue';


const model = defineModel< Record<string, DialogConstant> >();
const sel_type = ref(0);
const list_items = ref<[number, string][]>([]);
const new_number = ref(0);
const new_ident = ref("");
const new_desc = ref("");

/*
async function load_items() {
    const lst = await globalGetItems();
    list_items.value = lst.map((x,idx)=>[x.])
}
    */

function update_list() {
    const t = sel_type.value;
    if (!t) return;
/*    switch (t) {
        case 1: load_items();break;
        case 2: load_enemies();break;
        case 3: load_shops();break;
        case 4: load_charactes();break;
    }*/
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
                    <td><button>Del</button></td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="i">
        <x-form>
            <label><span>Identifier:</span><input type="text" v-model="new_ident"></label>
            <label><span>Type:</span>
            <select v-model="sel_type">
                <option :value="0">Number</option>
                <option :value="1">Item</option>
                <option :value="2">Enemy</option>
                <option :value="3">Shop</option>
                <option :value="4">Character</option>                
            </select>
            </label>
            <label><span>Value</span>
                <input v-if="sel_type==0" v-model="new_number" type="number" v-watch-range min="-32767" max="32767">
                <select v-else v-model="new_number"></select>
            </label>
            <label><span>Description</span>
                <input v-model="new_desc" type="text">
            </label>
            <div class="b">
                <button :disabled="new_ident.length == 0">Add</button>
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
    overflow: hidden scroll;    
}
table {
    border-collapse: collapse;
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
</style>