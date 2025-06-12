<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { FactDB } from '@/core/factdb';
import { onMounted, onUnmounted, ref, toValue } from 'vue';


const facts = ref<FactDB>(new FactDB());

const factfilename = "FACTS.JSON";

const edited_fact = ref<number>();
const edit_fact_name = ref<string>();
const edit_fact_desc = ref<string>();


async function init() {
    try {
        const data = await server.getDDLFile(factfilename);
        const dec = new TextDecoder();
        const str = dec.decode(data.buffer);
        facts.value = FactDB.fromJSON(str);
    } catch (e) {
        console.warn("No facts available", e);
    }
}

async function saveFactsDatabase() {
    const enc = new TextEncoder();
    const s = facts.value.toJSON();
    const buffer = enc.encode(s);
    try {
        await server.putDDLFile(factfilename, buffer.buffer, AssetGroup.MAPS);
    } catch (e) {
        alert(e);
    }    
}

import { computed } from 'vue';

const search = ref('');

const filteredAndSortedFacts = computed(() => {
    // Filter out empty/undefined facts
    let filtered = facts.value.getAllFacts().filter(fact => fact && fact.key && fact.description);    

    // Filter by search string (case-insensitive)
    if (search.value.trim()) {
        const q = search.value.trim().toLowerCase();
        filtered = filtered.filter(fact =>
            fact.key.toLowerCase().includes(q) ||
            fact.description.toLowerCase().includes(q)
        );
    }
    // Sort by name
    return filtered.slice().sort((a, b) => {
        const pa = a.id < 8?0:1;
        const pb = b.id < 8?0:1;
        if (pa!=pb) return pa-pb;
        else return a.key.localeCompare(b.key);
    });
});

function delFactConfirm(pos: number) {
    if (confirm("Are you sure you want to delete '"+facts.value.getFactById(pos)?.key+"'?")) {
        facts.value.removeFactById(pos);
        saveFactsDatabase();
    }
}

function editFact(pos: number) {
    const f = facts.value.getFactById(pos);
    if (!f) return;
    edited_fact.value = f.id;
    edit_fact_name.value = f.key
    edit_fact_desc.value = f.description;
}

function addNewFact() {
    edited_fact.value = -1;
    edit_fact_name.value = ""
    edit_fact_desc.value = "";

}
function addEnemyNewFact() {
    edited_fact.value = -2;
    edit_fact_name.value = ""
    edit_fact_desc.value = "";

}

function saveEditedFact() {
    if (edited_fact.value) {
        if (edited_fact.value == -1) {
            let f = facts.value.addFact(edit_fact_name.value || "", edit_fact_desc.value || "", false);
            if (!f) alert("Too many facts, reached 248 limit");            
            else saveFactsDatabase();
        } else if (edited_fact.value == -2) {
            let f = facts.value.addFact(edit_fact_name.value || "", edit_fact_desc.value || "", true);
            if (!f) alert("Too many states, reached 8 limit of local NPC states");            
            else saveFactsDatabase();
        } else {
            facts.value.replaceFact(edited_fact.value, edit_fact_name.value || "", edit_fact_desc.value || "");
            edited_fact.value = undefined;
            saveFactsDatabase();
        }
    }
    cancelEditedFact();
}

function cancelEditedFact() {
    edited_fact.value = undefined;
}

onMounted(init);


</script>
<template>
    <x-workspace>
        <div class="search">
            <h2>Game fact database</h2>
            <x-form>
                <label><span>Search</span><input type="search" v-model="search"/></label>
            </x-form>
            <div>
            <button @click="addNewFact" :disabled="facts.available(false)===null"
                    title="You can define various facts describing decisions or goals achieved during the adventure. Up to 248 facts can be defined">Define new fact</button>
            <button @click="addEnemyNewFact" :disabled="facts.available(true)===null"
                    title="You can define 8 status flags that are stored on the NPC participating in the conversation. Each NPC has its own flags and these are available in the dialogue ">Define new NPC dialog state</button>
            </div>
        </div>
        <table>
            <thead>
                <tr><th>Key</th><th>Description</th><th>BitPos</th><th>Action</th></tr>
            </thead>
            <tbody>
                <tr v-for="row of filteredAndSortedFacts" :key="row.id" :class="{localstate: row.id<8}">
                    <td @click="editFact(row.id)">{{ row.key }}</td>
                    <td @click="editFact(row.id)">{{ row.description }}</td>
                    <td>{{ row.id }}</td>
                    <td><button @click="delFactConfirm(row.id)">🗑️</button></td>
                </tr>
            </tbody>
         </table>
    </x-workspace>

    <div class="fact-window" v-if="edited_fact !== undefined">        
        <x-form>
            <label><span>Key</span><input v-model="edit_fact_name"></label>
            <label><span>Description</span><textarea rows="4" cols="10" v-model="edit_fact_desc"></textarea></label>            
        </x-form>
        <div class="buttons">
            <button v-if="edited_fact<0" @click="saveEditedFact" :disabled="!edit_fact_desc || !edit_fact_name">Add</button>
            <button v-if="edited_fact>=0" @click="saveEditedFact" :disabled="!edit_fact_desc || !edit_fact_name">Save</button>
            <button @click="cancelEditedFact">Cancel</button>
        </div>
    </div>
</template>

<style scoped>
x-workspace {
    text-align: center;;
}
x-workspace > table {
    margin: auto;    
    border: 1px solid;
    border-collapse:collapse;    
    max-width: 1024px;
    
}

x-workspace > table  th {
    background-color: black;
    color: white;
    padding: 0.25em;
}

x-workspace > table  td {
    border-bottom: 1px solid #888;
    border-right: 1px solid #888;
    text-align: left;
    padding: 0.1em 1em;
    background-color: white;
}

x-workspace > table  td:first-child {
    font-weight: bold;
    cursor: pointer;
    white-space: nowrap;
}

x-workspace x-form {
    width: 20em;
    margin: auto;
}

x-workspace h2 {
    margin: 0;
}

.search {
    position: sticky;
    padding-top: 0.5em;
    top: 0;
    background-color:#ccc;;
    border-bottom: 1px solid;
    display:flex
}

.fact-window {
    position: absolute;
    left: 50%;
    top: 5em;
    background-color: #ddd;
    width: 40em;
    margin-left: -20em;    
    border: 1px solid black;
    box-shadow: 5px 5px 5px black;    
}

.fact-window x-form {
    padding: 1em;
}

.fact-window .buttons {
    text-align: right;
    padding: 0.5em 1em;
    border-top: 1px solid;
    display:flex;
    gap: 1em;
    justify-content: flex-end;    
}

.fact-window .buttons button {
    width: 8em;
}

tr:hover td {
    background-color: #ddd;
}

tr.localstate td {
    background-color: #ffa;
}

tr.localstate:hover td {
    background-color: #cc8;
}

.search button {
    margin: 0 0.5em;
}

</style>