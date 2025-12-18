<script lang="ts" setup>
import { server } from '@/core/api';
import { FactDB } from '@/core/factdb';
import { computed, onMounted, ref, watch } from 'vue';
import svg_pencil from '@/assets/toolbar/pencil.svg'
import { AssetGroup } from '@/core/asset_groups';



const facts = ref<FactDB>(new FactDB());

const factfilename = "FACTS.JSON";

const selected_fact = defineModel<number|null>();
const edited_fact = ref(-1);
const rootel = ref<HTMLElement>();
const skip_scroll = ref(false);

async function saveDB() {
    const str = facts.value.toJSON();
    const enc = new TextEncoder();
    server.putDDLFile(factfilename,enc.encode(str).buffer,AssetGroup.MAPS,false);
}

function autoscroll() {
    setTimeout(()=>{
        if (skip_scroll.value) {
            skip_scroll.value = false;
            return;
        }
        const el = rootel.value;
        if (!el) return;
        const elp = el.parentElement;
        if (!elp) return;
        const sel = elp.querySelector(".selected");
        if (sel) {
            sel.scrollIntoView({block:"center"});
        }
    },5);
}

onMounted(async ()=>{
    
    try {
        const data = await  server.getDDLFile(factfilename);
        const conv = new TextDecoder();
        const text = conv.decode(data);
        facts.value = FactDB.fromJSON(text);
        autoscroll();
    } catch (e) {

    }
})

watch(selected_fact, ()=>{
    autoscroll();
})


const freeId = computed(()=>{
    return facts.value.available(false);
})

const new_key=ref("");
const new_key_desc=ref("");

function add_fact() {
    if (new_key.value) {
        facts.value.addFact(new_key.value, new_key_desc.value, false)
        new_key.value = "";
        new_key_desc.value = ""
    }
    saveDB();
}

function check_after_edit(id:number) {
    const x = facts.value.getFactById(id);
    if (x && x.key.length == 0) {
        facts.value.removeFactById(id);
    }
    saveDB();
}


</script>

<template>
<div class="hdr row" ref="rootel">
    <div>Id</div>
    <div>Name</div>
    <div>Description</div>
</div>
<div v-for="v of facts.getAllFacts()" :key="v.id" class="row" :class="{selected: v.id == selected_fact}" @click="selected_fact = v.id;skip_scroll = true" >
    <div>{{ v.id }}</div>
    <template v-if="v.id == edited_fact">
        <input type="text" v-model="v.key" @change="check_after_edit(v.id)"></input>
        <input type="text" v-model="v.description" @change="check_after_edit(v.id)"></input>
        <button @click="edited_fact = -1">🞬</button>
    </template>
    <template v-else>
        <div>{{ v.key }}</div>
        <div>{{ v.description }}</div>
    <button @click="edited_fact = v.id"><img :src="svg_pencil" width="10"></button>
    </template>
</div>
<div class="row new">
    <div>{{ freeId }}</div>
    <input type="text" v-model="new_key" placeholder="new fact name"></input>
    <input type="text" v-model="new_key_desc" placeholder="new fact description"></input>
    <button @click="add_fact" :disabled="new_key.length == 0">+</button>
</div>


</template>

<style lang="css" scoped>
    .row.hdr{
        font-weight: bold;
        background-color: #ccc;
        position: sticky;
        top:0;
    }
    .row.hdr > div{ 
        border: 1px solid;
    }
    .row > div{
        padding: 0.2rem;
        border: 1px dotted;
        margin-right: -1px;
        flex-shrink: 0;
    }
    .row > input{
        padding: 0.2rem;
    }
    .row {
        display:flex;    
    }
    .row > *:nth-child(1) {
        width: 2rem;
        text-align: center;
    }
    .row > *:nth-child(2) {
        width: 10rem;
        box-sizing: border-box;
    }
    .row > *:nth-child(3) {
        flex-shrink: 1;
        flex-grow: 1;
    }
    .row {
        cursor: pointer;
    }

    .row.selected {
        cursor: pointer;
        background-color: rgb(234, 255, 197);
        font-weight: bold;;
    }
</style>