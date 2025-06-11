<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { enemyFromArrayBuffer,enemySoundsFromArrayBuffer,type EnemyDef, type EnemySounds } from '@/core/enemy_struct';
import { readFileToArrayBuffer } from '@/core/read_file';
import { onMounted, ref } from 'vue';

const missing_sound_dat = ref<boolean>(false);
const missing_enemy_dat = ref<boolean>(false);

const enemies = ref<EnemyDef[]>([]);
const sounds = ref<EnemySounds>([]);

const selected_enemy = ref<number>(0);

const import_enemy_dat_file = ref<File>();
const import_sound_dat_file = ref<File>();
type RefFile = typeof import_enemy_dat_file;

async function  load_files() {
    const ep = server.getDDLFile("ENEMY.DAT");
    const sp = server.getDDLFile("SOUND.DAT");
    try {
        enemies.value = enemyFromArrayBuffer((await ep).buffer);
    } catch (e) {
        console.warn("failed to load ENEMY.DAT",e);
        missing_enemy_dat.value = true;
    }
    try {
        sounds.value = enemySoundsFromArrayBuffer((await sp).buffer);
    } catch (e) {
        console.warn("failed to load SOUND.DAT",e);
        missing_sound_dat.value = true;
    }
}

async function import_files() {
    const files = [
        [import_enemy_dat_file,"ENEMY.DAT",missing_enemy_dat],
        [import_sound_dat_file,"SOUND.DAT",missing_sound_dat],
    ]

    for (let fdef of files) {
        const file = fdef[0] as RefFile;
        const name = fdef[1] as string;
        const mis = fdef[2] as typeof missing_enemy_dat;
        if (file.value) {
            if (file.value.name != name) {
                alert("File "+file.value.name +" is not "+name);
                return;
            }
            const buff = await readFileToArrayBuffer(file.value);
            try {
                await server.putDDLFile(name, buff, AssetGroup.MAPS);
                mis.value=false;
            } catch (e) {
                alert(e);
                return;
            }
        }
    }
}



function init() {
    load_files();
}

function assign_import_file(event: Event, what:number) {
    const target = event.target as HTMLInputElement;
    if (target && target.files && target.files[0]) {
        const f = target.files[0];
        switch(what) {
            case 0: import_enemy_dat_file.value =f;break;
            case 1: import_sound_dat_file.value =f;break;
        }
    }
}

function create_new_project() {
    
}

onMounted(init);

</script>

<template>    
    <select v-model="selected_enemy" size="20" class="enemy-list">
        <option v-for="(e,idx) in enemies" :key="idx" :value="idx">{{ e.name }}</option>
    </select>
    <div class="files-not-found" v-if="missing_enemy_dat || missing_sound_dat">
        <p>Some files missing. Do you want to import them from original game</p>
        <x-form>
            <label v-if="missing_enemy_dat"><span>ENEMY.DAT</span><input type="file" @change="event =>assign_import_file(event, 0)" accept=".dat"></label>    
            <label v-if="missing_sound_dat"><span>SOUND.DAT</span><input type="file" @change="event =>assign_import_file(event, 0)" accept=".dat"></label>
        </x-form>
        <button @click="import_files">Import files</button>
        <button @click="create_new_project">Create empty</button>
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