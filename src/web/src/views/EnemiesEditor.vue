<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { enemyFromArrayBuffer,type EnemyDef } from '@/core/enemy_struct';
import { onMounted, ref } from 'vue';

const enemies = ref<EnemyDef[]>([]);
const selected_enemy = ref<number>(0);
const need_import = ref<boolean>(false);

function import_enemy_dat(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        if (file.name.toUpperCase() === "ENEMY.DAT") {
            const reader = new FileReader();
            reader.onload = async function(e) {
                if (!e.target) return;
                const arrayBuffer = e.target.result as ArrayBuffer;
                await server.putDDLFile("ENEMY.DAT",arrayBuffer,AssetGroup.MAPS);
                await init();
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Please select a file named ENEMY.DAT");
        }
    }
}

async function init() {
    try {
        const data = await server.getDDLFile("ENEMY.DAT");
        enemies.value = enemyFromArrayBuffer(data.buffer);
    } catch (e) {
        need_import.value = true;
    }
}

onMounted(init);

</script>

<template>    
    <select v-model="selected_enemy" size="20" class="enemy-list">
        <option v-for="(e,idx) in enemies" :key="idx" :value="idx">{{ e.name }}</option>
    </select>
    <div class="enemy-not-found" v-if="need_import">
        <span>The file ENEMY.DAT doesn't exists. Do you want to import it from original game</span>
        <input type="file" @change="event=>import_enemy_dat(event)" accept=".dat">            
    </div>
</template>

<style scoped>
.enemy-list {
    width: 15em;
    position: absolute;
    top: 2.25rem;
    bottom: 0px;
    display: block;
    height: 100%;
}

.enemy-not-found {
    position: absolute;
    left: 50%;
    top: 10vw;
    height: 4em;
    width: 20em;
    margin-left: -10em;
    border: 1px solid;
    background-color: white;
    padding: 2em;
    text-align: center;
}

.enemy-not-found input {
    display: block;
    margin: 1em auto;
    width: 7.5em;
}

</style>