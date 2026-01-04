<script setup lang="ts">
import { server, type DDLFileHistory } from '@/core/api';
import { AssetGroupLabel, type AssetGroupType } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { onMounted, ref, triggerRef, watch } from 'vue';


const filename = defineModel<string>();

const history = ref<DDLFileHistory[]>([]);
const active = ref(0);

const new_filename = ref("");
const new_group = ref(0);
const fail_copy = ref(false);


async function load_history() {
    const f = filename.value;
    if (f) {
        history.value = await server.getDDLFileHistory(f);
        new_filename.value = f;
    }
    active.value = 0;
}

onMounted(()=>load_history());

watch(filename, ()=>load_history());

watch(new_filename, ()=>{
    const f = new_filename.value;
    const g = dosname_sanitize(f);
    if (g != f) new_filename.value = g;
    fail_copy.value = false
})

async function do_copy() {
    const f = filename.value;
    const t = new_filename.value;
    if (f && t) {
        const b = await server.copy_files(f,t,new_group.value as AssetGroupType, active.value);
        if (b) {
            filename.value = new_filename.value;
            load_history();
        }
    }
}

</script>
<template>
    <div class="root">
        <x-form>
            <label><span>History of file</span><input type="text" readonly="true" v-model="filename"></label>
        </x-form>
        <p class="note">History is automatically deleted by performing the "Compact" operation</p>
    <div v-if="history.length > 0 && filename" class="tbl">
        <div class="h">
            <div>ID</div>
            <div>Modified</div>
            <div>Link</div>
        </div>
        <div v-for="v of history" :key="v.revision" :class="{active: v.revision == active}" @click="active = v.revision" class="d">
            <div>{{ v.revision }}</div>
            <div>{{ v.timestamp?v.timestamp.toLocaleString():"base" }}</div>
            <div><a :href="server.get_download_link(filename, v.revision)">Download</a></div>
        </div>
    </div>
    <div v-else class="tbl empty">
        <div>No history available</div>
    </div>
    <x-form>
        <label><span>Copy revision as</span><input :disabled="!active" type="text" v-model="new_filename" maxlength="12"></label>
         <label><span>Group (type):</span><select :disabled="!active" v-model="new_group" >
            <option v-for="(v,k) of AssetGroupLabel" :value="k" :key="k">
                {{ v }}
            </option>
        </select></label>                   
    </x-form>
    <button :disabled="!active || !new_filename" @click="do_copy">Copy revision</button>
    </div>
</template>
<style lang="css" scoped>

.tbl {
    margin: auto;
    width: 30rem;
    border: 1px solid;
    padding: 0.2rem;
    height: 50vh;
    overflow: auto;
    background-color: white;
 
}
.tbl > div {
    display: flex;    
}

.tbl > div > * {
    width: 12rem;
    text-align: right;
    padding: 0.2rem;
    border: 1px dotted;
    margin: -1px -1px 0 0 ;
}

.tbl > div > *:first-child {
    flex-shrink: 1;
    flex-grow: 1;
    width: auto;
}
.tbl > div > *:last-child {
    width: 6rem;
}

.tbl > div.d {
    cursor: pointer;
}

.tbl > div.d.active {
    background-color: #ccf;
}


.tbl > div.h {
    font-weight: bold;
    border-bottom: 1px solid;
    position: sticky;
    top:0;
    background-color: #bbb;
}

.root {
    width: 33rem;
    margin: auto;
    text-align: left;
}
button {
    width: 10rem;
    display: block;
    margin-left: auto;
}

p.note {
    text-align: center;
    font-style: italic;    
}
p.note::before {
    content: "Note: ";
    font-weight: bold;
}

</style>