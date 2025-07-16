<script setup lang="ts">

import {server, type Stats} from "@/core/api.ts"
import {ref, onMounted} from "vue";

const stats = ref<Stats>();
const button_disabled = ref<boolean>(true);

async function  update_stats() : Promise<void>{
    button_disabled.value = true;
    stats.value = (await server.getDDLFiles(999,"user")).stats;
    button_disabled.value = false;
}

async function run_compact() : Promise<void>{
    try {
        button_disabled.value = true;
        await server.compactDDL();
        return update_stats();
    } catch (e) {
        alert(e);
    }
}

onMounted(()=>{
    update_stats();
});


</script>

<template>
    <h2>Statistics</h2>
    <table>        <tbody>
        <tr><th>Directory entries</th><td>{{ stats?stats.entries_used:"-" }}</td><td></td></tr>
        <tr><th>Unused directory entries</th><td>{{ stats?stats.entries_reserved:"-" }}</td><td></td></tr>
        <tr><th>Total size</th><td>{{ stats?Math.round(stats.total_space / 1024):"-" }}</td><td>KiB</td></tr>
        <tr><th>Used space</th><td>{{ stats?Math.round(stats.used_space / 1024):"-" }}</td><td>KiB</td></tr>
        <tr><th>Fragmentation</th><td>{{ stats?Math.round(100-(stats.used_space+stats.reserved_space)/stats.total_space*100):"-" }}</td><td>%</td></tr>
        </tbody>
    </table>
    
    <div class="at-center">
        <button :disabled="button_disabled" @click="run_compact">Compact</button>
    </div>
</template>

        
<style scoped> 
.at-center {
    text-align: center;
}

table {
    margin: auto;
}

table th {
    text-align: left;
}
table td:nth-child(2) {
    text-align: right;
}


</style>
