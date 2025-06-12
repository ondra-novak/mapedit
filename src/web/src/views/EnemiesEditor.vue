<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
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

const list_graphics = ref<string[]>([]);
const list_sounds = ref<string[]>([]);

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
    if (enemies.value && sounds.value) {
        enemies.value.forEach(enm=>{
            enm.sound_files = [];
            for (let i = 0; i < 4; ++i) {
                if (enm.sounds[i]) {
                    enm.sound_files.push(sounds.value[enm.sounds[i]-1] || "");
                }                
            }
        });
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
    enemies.value = [];
    sounds.value = [];
    missing_enemy_dat.value = false;
    missing_sound_dat.value = false;    
}

async function load_graphics() {
    try {
        const files = (await server.getDDLFiles(AssetGroup.ENEMIES,null)).files;
        const seq = files.filter((f:FileItem)=>f.name.endsWith(".SEQ"));
        list_graphics.value = seq.map((z:FileItem)=>z.name);
    } catch (e) {
        alert(e);
    }
}
async function load_sounds() {
    try {
        const files = (await server.getDDLFiles(AssetGroup.SOUNDS,null)).files;        
        list_sounds.value = files.map((z:FileItem)=>z.name);
    } catch (e) {
        alert (e);
    }
}

function init() {
    load_graphics();
    load_sounds();
    load_files();

}


const enm_name = ref<string>("");
const enm_graphics = ref<string>("");
const enm_speed = ref<number>(1);
const enm_sightrange = ref<number>(1);
const enm_engagerange = ref<number>(1);
const enm_dialognum = ref<number|null>(1);





onMounted(init);

</script>

<template>    
    <div class="left-panel">
        <select v-model="selected_enemy" size="20" class="enemy-list">
            <option v-for="(e,idx) in enemies" :key="idx" :value="idx">{{ e.name }}</option>
        </select>
        <div class="buttons">
            <button>Clone</button>
            <button>New</button>
        </div>
    </div>

    <div class="editor-bgr">
    <div class="editor">
        <div class="multiple">
            <x-section>
                <x-section-title>Basic parameters</x-section-title>
                <x-form>
                    <label><span>Name</span><input type="text" v-model="enm_name" maxlength="29"></label>
                    <label><span>Speed (px per frame)</span><input type="number" v-model="enm_speed"></label>
                    <label><span>Sight range</span><input type="number" v-model="enm_sightrange"></label>
                    <label><span>Engage range</span><input type="number" v-model="enm_engagerange"></label>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Flags</x-section-title>
                <x-form>
                <label><input type="checkbox" /><span>Big enemy (one on square)</span></label>
                <label><input type="checkbox" /><span>Through (not blocking)</span></label>
                <label><input type="checkbox" /><span>Just traveling sound effect</span></label>
                <label><input type="checkbox" /><span>Respawn</span></label>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Sounds</x-section-title>
                <x-form>
                    <label><span>Walk</span><select><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                    <label><input type="checkbox" /><span>Loop</span></label>
                    <label><span>Attack</span><select><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                    <label><span>Damaged</span><select><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                </x-form>
            </x-section>
        </div>
        <x-section>
            <x-section-title>Appearence</x-section-title>
        </x-section>
        <x-section>
            <x-form>
                <x-section-title>Stats</x-section-title>
                <label><span>Hit points</span><input type="number" min="0" max="65535"/></label>
                <label><span>Strength</span><input type="number" min="0" max="100"/></label>
                <label><span>Magic (% of casting)</span><input type="number" min="0" max="100"/></label>
                <label><span>Movement (/15 actions)</span><input type="number" min="0" max="100"/></label>
                <label><span>Dexterity</span><input type="number" min="0" max="100"/></label>
                <label><span>Defense</span><div><input type="number" min="0" max="65535"/>-<input type="number" min="0" max="65535"/></div></label>
                <label><span>Attack</span><div><input type="number" min="0" max="65535"/>-<input type="number" min="0" max="65535"/></div></label>
                <label><span>Extra damage</span><input type="number" /></label>
                <label><span>Magic attack</span><div><input type="number" min="0" max="65535"/>-<input type="number" min="0" max="65535"/></div></label>
                <label><span>Magic attack type</span><div><select>
                    <option value="-1">--select--</option>
                    <option value="0">fire</option>
                    <option value="1">water</option>
                    <option value="1">earth</option>
                    <option value="1">air</option>
                    <option value="1">mind</option>
                </select></div></label>
                <label><span>Protection (fire)</span><input type="number" min="0" max="100"/></label>
                <label><span>Protection (water)</span><input type="number" min="0" max="100"/></label>
                <label><span>Protection (earth)</span><input type="number" min="0" max="100"/></label>
                <label><span>Protection (air)</span><input type="number" min="0" max="100"/></label>
                <label><span>Protection (mind)</span><input type="number" min="0" max="100"/></label>
                <label><span>Regeneration</span><input type="number" min="0" max="65535"/></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Effects</x-section-title>
            <x-form>
                <label><input type="checkbox" /><span>Invisible</span></label>
                <label><input type="checkbox" /><span>Eye by eye</span></label>
                <label><input type="checkbox" /><span>Live drain</span></label>
                <label><input type="checkbox" /><span>Physical resistance (50%)</span></label>
                <label><input type="checkbox" /><span>Magical resistance (50%)</span></label>
                <label><input type="checkbox" /><span>Blinded</span></label>
                <label><input type="checkbox" /><span>Regenerate during battle</span></label>
                <label><input type="checkbox" /><span>Hit knock back</span></label>
                <label><input type="checkbox" /><span>Fear (flee from battle)</span></label>
                <label><input type="checkbox" /><span>Stoned</span></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Behavior</x-section-title>
            <x-form>
                <label><input type="checkbox" /><span>Walking</span></label>
                <label><input type="checkbox" /><span>Engage player</span></label>
                <label><input type="checkbox" /><span>Can hear sound</span></label>
                <label><input type="checkbox" /><span>See invisible</span></label>
                <label><input type="checkbox" /><span>Guarding the home room</span></label>
                <label><input type="checkbox" /><span>Scavenger</span></label>
                <label><input type="checkbox" /><span>Spellcaster - spell id: <input type="number"></span></label>
                <label><input type="checkbox" /><span>Ranger (shoots): <input type="number"></span></label>
                <label><span>Flee probability [%]</span><input type="number" min="0" max="100"/></label>
                <label><span>Special Behavior</span><select>
                    <option value="0">Nothing</option>
                    <option value="2">Turn around in cycle</option>
                    <option value="3">Cast random spell(defunc)</option>
                    <option value="4">Ranger - keep distance</option>
                    <option value="5">Open door</option>
                    <option value="6">Open door in battle</option>
                    <option value="7">Alarm (send sound)</option>
                    <option value="8">Attack at wimpy</option>
                    <option value="9">Held on place</option>
                </select></label>
                <label><span>Dialog number</span><input type="number" v-model="enm_dialognum"></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Other properties</x-section-title>
            <x-form>
                <label><span>Drop money</span><input type="number" min="0" max="65535"/></label>
                <label><span>Total experience</span><input type="number" min="0" max="999999"/></label>
                <label><span>Kill experience</span><input type="number" min="0" max="999999"/></label>
                <label><span>Inventory</span><div><div><select>
                    <option value="0">-- select item --</option>
                </select></div><div><select>
                    <option value="0">-- select item --</option>
                </select></div></div></label>

            </x-form>
        </x-section>
    </div>
    </div>

    <div class="files-not-found" v-if="missing_enemy_dat || missing_sound_dat">
        <p>Some files are missing. Do you want to import them from the original game</p>
        <x-form>
            <label v-if="missing_enemy_dat"><span>ENEMY.DAT</span><input type="file" @change="event =>assign_import_file(event, 0)" accept=".dat"></label>    
            <label v-if="missing_sound_dat"><span>SOUND.DAT</span><input type="file" @change="event =>assign_import_file(event, 1)" accept=".dat"></label>
        </x-form>
        <div class="button-panel"><button @click="import_files">Import files</button></div>
        <div class="button-panel"><button @click="create_new_project">Create empty</button></div>
    </div>
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
.enemy-list {
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
.files-not-found {
    position: absolute;
    left: 50%;
    top: 10vw;
    height: 14em;
    width: 25em;
    margin-left: -10em;
    border: 1px solid;
    background-color: white;
    text-align: center;
}

.files-not-found x-form {
    padding: 0 2em;
}
.files-not-found x-form > label > input {
    width: 65%;
}

.files-not-found .button-panel {
    border-top: 1px solid;
    padding: 0.5em;
    
}

.enemy-not-found input {
    display: block;
    margin: 1em auto;
    width: 7.5em;
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

.editor x-section {
    width: 20em;    
}
.editor x-section x-section{
    width: 18em;
}
.editor input[type=number] {
    width: 5em;
    text-align: center;
    box-sizing: border-box;
}

div.multiple {
    display: flex;
    flex-direction: column;
}

div.multiple > *{
    flex-grow: 1;
}

</style>