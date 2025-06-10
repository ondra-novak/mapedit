<script setup lang="ts">
import { enemyFromArrayBuffer,type EnemyDef } from '@/core/enemy_struct';
import { ref } from 'vue';

const enemies = ref<EnemyDef[]>([]);
const selected_enemy = ref<number>(0);


function import_enemy_dat(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        if (file.name.toUpperCase() === "ENEMY.DAT") {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (!e.target) return;
                const arrayBuffer = e.target.result as ArrayBuffer;
                const enm = enemyFromArrayBuffer(arrayBuffer);
                enemies.value = enm;
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Please select a file named ENEMY.DAT");
        }
    }
}


</script>

<template>    
    <div class="workspace">
        <div class="enemy-list">
            <select v-model="selected_enemy" size="20">
                <option v-for="(e,idx) in enemies" :key="idx" :value="idx">{{ e.name }}</option>
            </select>
        </div>
        <div class="enemy-not-found">
            <span>The file ENEMY.DAT doesn't exists. Do you want to import it from original game</span>
            <input type="file" @change="event=>import_enemy_dat(event)" accept=".dat">            
        </div>
    </div>
</template>