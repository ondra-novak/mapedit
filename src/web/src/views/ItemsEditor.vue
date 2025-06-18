<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, onMounted, ref } from 'vue';
import { itemsFromArrayBuffer, ItemType, ItemTypeName, type ItemDef } from '@/core/items_struct';


const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true}
];

const selected_item = ref<number>();

const item_list = ref<ItemDef[]>([]);
const filter_kind = ref<number>(-1);
const filter_search = ref<string>("");

async function loadItems() {
    try {
        item_list.value = itemsFromArrayBuffer((await server.getDDLFile("ITEMS.DAT")));

    } catch (e) {
        alert("Failed to load items:"+e);
    }
}

function init() {
    loadItems();

}


function deleteItem() {
    if (selected_item.value !== undefined && item_list.value) {
        if (confirm("Are you sure delete item: " + item_list.value[selected_item.value].jmeno)) {
            item_list.value[selected_item.value].jmeno = "";
        }
    }
}
function cloneItem() {

}
function addItem() {

}

function onCreateNew() {

}

function onImported() {

}

const filteredAndSortedItems = computed(() => {

    const mp =  item_list.value.filter(x=>x.jmeno.length>0)
        .filter(x=>(!filter_kind.value === undefined|| filter_kind.value<0 || filter_kind.value == x.druh)
                && (!filter_search.value ||  
                    x.jmeno.indexOf(filter_search.value) != -1 || x.popis.indexOf(filter_search.value) != -1
                ))
        .map((x,idx)=>{return [x, idx];}) as [ ItemDef, number][];
    const srt = mp.sort((a,b)=>{
                    return (a[0].druh - b[0].druh )||  (a[0].jmeno.localeCompare(b[0].jmeno));
                });
    const res = [];
    for (const itm of srt) {
        if (res.length == 0 || res[res.length-1].cat != itm[0].druh) {
            res.push({cat:itm[0].druh, items:[itm]});
        } else{
            res[res.length-1].items.push(itm);
        }
    }
    return res;

});


onMounted(init);

</script>
<template>
    <x-workspace>

    <div class="left-panel">
        <div class="filter">
            <select v-model="filter_kind">
            <option value="-1">-- all --</option>
            <option v-for="(v,idx) in ItemTypeName" :key="idx" :value="idx">{{ v }}</option>
            </select>
            <input type="search" v-model="filter_search">
        </div>
        <select v-model="selected_item" size="20" class="item-list">
            <optgroup v-for="e of filteredAndSortedItems" :key="e.cat" :label="ItemTypeName[e.cat]">
                <option v-for="i of e.items" :value="i[1]"> {{ i[0].jmeno }}</option>
            </optgroup>
        </select>
        <div class="buttons">
            <button @click="deleteItem">Delete</button>
            <button @click="cloneItem">Clone</button>
            <button @click="addItem">New</button>
        </div>
    </div>

    <div class="editor-bgr">
    <div class="editor" v-if="selected_item !== undefined">
    </div>
    </div>
     </x-workspace>



<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>

<style scoped>

.left-panel {
    width: 200px;
    position: absolute;
    top: 2rem;
    bottom: 0px;
    display: block;
    box-sizing: border-box;
}
.left-panel .filter {
    position:absolute;
    top:-2rem;
    display: flex;
    height: 2em;
    justify-items: stretch;
    width:200px;
}
.left-panel .filter > * {
    flex-grow: 1;
    width: 45%;
}
.item-list {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 2rem;
    box-sizing: border-box;
}
.buttons {
    position:absolute;
    left: 0;
    bottom: 0;
    right: 0;
    display:flex;
    align-items: stretch;    
    height: 2rem;
    box-sizing: border-box;
}

.buttons>button {
    flex-grow: 1;
}

.editor-bgr {
    position: absolute;
    left: 200px;
    top:2.25em;right:0;bottom: 0;
    padding: 1em;
    background-color: #ccc;
    box-sizing: border-box;
    overflow: auto;
}

.editor {
    background-color: #ccc;
    display: flex;
    flex-wrap: wrap;
}

</style>