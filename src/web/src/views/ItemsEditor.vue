<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, onMounted, ref, shallowRef, watch, type Ref } from 'vue';
import { itemsFromArrayBuffer, ItemType, ItemTypeName, type ItemDef } from '@/core/items_struct';
import SkeldalImage, {type  ImageModel } from '@/components/SkeldalImage.vue';
import CanvasView from '@/components/CanvasView.vue';
import { PCX, PCXProfile, type PCXProfileType } from '@/core/pcx';


const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true}
];

const selected_item = ref<number>();

const item_list = ref<ItemDef[]>([]);
const filter_kind = ref<number>(-1);
const filter_search = ref<string>("");
const male_character=shallowRef<PCX>();
const appearence = shallowRef<PCX>();

async function loadItems() {
    try {
        item_list.value = itemsFromArrayBuffer((await server.getDDLFile("ITEMS.DAT")));

    } catch (e) {
        alert("Failed to load items:"+e);
    }
}

async function load_character() {
    try {
        male_character.value = PCX.fromArrayBuffer(await server.getDDLFile("CHAR01.PCX"));
    } catch (e){
        alert("Failed to load avatar");
    }
    
}

function init() {
    loadItems();
    load_character();

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

async function onChangeSelection() {
    appearence.value = undefined;
    if (selected_item.value === undefined || item_list.value === undefined) return;
    try {
        const lst = item_list.value;
        const idx : number = selected_item.value;
        const fname = lst[idx].vzhled_on_ground;
        if (fname) {
            appearence.value = PCX.fromArrayBuffer(await server.getDDLFile(fname));
        }
    } catch (e) {
        console.warn(e);
    }
}

function itemCanvas( type: PCXProfileType, item?: PCX, shiftup?:number) {
    if (item) {
        const c = item.createCanvas(type);
        c.style.margin="auto";
        if (shiftup && shiftup != 255) c.style.transform=`translateY(${shiftup}px)`;
        return c;
    }
    return null;
}

watch([selected_item], onChangeSelection);

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
        <x-section>
            <x-section-title>Basic parameters</x-section-title>
            <x-form>
                <label><span>Name</span><input type="text" maxlength="31"/></label>
                <label><span>Description</span><input type="text" maxlength="31"/></label>
                <label><span>Icon</span><img srr="/none.jpg"></label>
                <label><span>Kind</span><select>
                    <option v-for="(n, v) of ItemTypeName" :key="v" :value="v"> {{ n }}</option>
                </select></label>
                <label><span>Weight</span><input type="number"/></label>
                <label><span>Capacity</span><input type="number"/></label>    
                <div class="appear-ground checkerboard">
                    <CanvasView :canvas="itemCanvas(PCXProfile.item,appearence,item_list[selected_item || 0].shiftup)"></CanvasView>
                </div>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Appearence</x-section-title>
            <div class="place-item checkerboard">
            <CanvasView :canvas="male_character?male_character.createCanvas(PCXProfile.transp0):null"></CanvasView>
            </div>
        </x-section>
    </div>
    </div>
     </x-workspace>



<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>

<style scoped>

.left-panel {
    width: 240px;
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
    width:240px;
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
    left: 240px;
    top:0;right:0;bottom: 0;
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


.place-item {
    padding: 50px;
}

.appear-ground {
    height: 150px;
    position: relative;    
    width: 20rem;
    margin-top: 1rem;
}

.appear-ground div{
    position: absolute;
    left: 0;top:0;bottom: 25px;right: 0;
    margin: auto auto 0 auto;
    width: fit-content;
    height: fit-content;
}
.appear-ground::before {
    content: "";
    display: block;
    position: absolute;
    bottom:0;
    height: 25px;
    left:0;
    right: 0;
    background-color: rgb(163, 147, 0);
background-image: linear-gradient(335deg, rgb(72, 128, 27) 23px, transparent 23px),
linear-gradient(155deg, rgb(90, 79, 43) 23px, transparent 23px),
linear-gradient(335deg, rgb(129, 116, 56) 23px, transparent 23px),
linear-gradient(155deg, rgb(102, 110, 54) 23px, transparent 23px);
background-size: 58px 58px;
background-position: 0px 2px, 4px 35px, 29px 31px, 34px 6px;
}

.editor x-section {
    width: 20rem;    
}


</style>