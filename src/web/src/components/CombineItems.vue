<script lang="ts" setup>
import { server } from '@/core/api';
import { BinaryIterator, BinaryWriter, type Schema } from '@/core/binary';
import { onMounted, onUnmounted, reactive } from 'vue';
import type { SaveRevertControl } from './statusBar';
import StatusBar from './statusBar';
import { AssetGroup } from '@/core/asset_groups';
import DelayLoadedList from './DelayLoadedList.vue';
import { ItemHive } from '@/core/items_struct';
import globalGetItems from '@/utils/global_item_list';
import { watch } from 'vue';


class Item {
    item1: number = -1;
    item2: number = -1;
    out_item1: number = -1;
    out_item2: number = -1;

    getSchema() :Schema {
        return {
            item1:"int16",
            item2:"int16",
            out_item1:"int16",
            out_item2:"int16",
        };
    };
}

function load_combinations(buff: ArrayBuffer): Item[] {
    const iter = new BinaryIterator(buff);
    const count = Math.floor(buff.byteLength / 8);
    const out : Item[] = [];
    for (let i = 0; i< count; ++i) {
        const item = new Item();
        Object.assign(item, iter.parse(item.getSchema()));
        out.push(item);
    }
    return out;
}

function save_combinations(list: Item[]) {
    const wr = new BinaryWriter();
    list.forEach(x=>wr.write(x.getSchema(), x));
    return wr.getBuffer();
}

const state = reactive<{comb: Item[]}>({
    comb: [],
});

let save_state : null | SaveRevertControl = null;

async function load() {
    state.comb = load_combinations(await server.getDDLFile("ITEMCOMB.DAT"))    
}

async function save() {
    await server.putDDLFile("ITEMCOMB.DAT",save_combinations(state.comb),AssetGroup.MAPS);
    return true;    
}

async function revert() {
    await init();
}

let items = globalGetItems();

async function load_items() {
    const lst = await items;    
    return lst.map((x,idx)=>({value:idx, label: `${x.jmeno} #${idx}`})).concat([{value: -1, label: "(none)"}])
        .sort((a,b)=>a.label.localeCompare(b.label));
}

async function init() {
    if (save_state) {
        save_state.set_changed(false);
        save_state.unmount();
    }
    await load();
    save_state = await StatusBar.register_save_control();
    save_state.on_save(save);
    save_state.on_revert(revert);    
}

watch(()=>state.comb, ()=>save_state?.set_changed(true),{deep:true});


onMounted(init);
onUnmounted(()=>save_state?.unmount())


function del_row(it : number) {
    state.comb.splice(it,1);
}
function add_row() {
    state.comb.push(new Item);
}

</script>
<template>
<x-workspace>
    <h2>Combine items</h2>
<table align="center">
    <thead>
        <tr>
            <th>Held item</th><th>Invertory item</th><th>New held item</th><th>New invertory item</th>
        </tr>
    </thead>
    <tbody>
        <tr v-for="(row, idx) of state.comb" :key="idx">
            <td><DelayLoadedList v-model="row.item1" :list="load_items()"></DelayLoadedList></td>
            <td><DelayLoadedList v-model="row.item2" :list="load_items()"></DelayLoadedList></td>
            <td><DelayLoadedList v-model="row.out_item1" :list="load_items()"></DelayLoadedList></td>
            <td><DelayLoadedList v-model="row.out_item2" :list="load_items()"></DelayLoadedList></td>
            <td><button @click="del_row(idx)">X</button></td>
        </tr>
        <tr><td><button @click="add_row">Add</button></td></tr>
    </tbody>
</table>
</x-workspace>    
</template>
<style lang="css" scoped>

</style>