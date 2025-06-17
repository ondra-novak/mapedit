<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import type { FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, ref } from 'vue';


const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true}
];

const selected_item = ref<number>();
const filteredAndSortedItems = computed(()=>{
    return [];
});

function deleteItem() {

}
function cloneItem() {

}
function addItem() {

}

function onCreateNew() {

}

function onImported() {

}

</script>
<template>

    <div class="left-panel">
        <select v-model="selected_item" size="20" class="item-list">
            <option v-for="e in filteredAndSortedItems" :key="e[1]" :value="e[1]">{{ e[0].name }}</option>
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


<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>

<style scoped>

.left-panel {
    width: 200px;
    position: absolute;
    top: 2.25rem;
    bottom: 0px;
    display: block;
    box-sizing: border-box;
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