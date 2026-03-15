<script setup lang="ts">
import AssetToolSeq from '@/components/AssetToolSeq.vue';
import CanvasView from '@/components/CanvasView.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { COLPaletteSet } from '@/core/col_palette_set';
import { CharacterStats} from '@/core/common_defs';
import { enemyAndSoundFromArrayBuffer, enemyAndSoundToArrayBuffer, Enemies, EnemyDef, EnemyFlags1, EnemyFlags2, enemyFromArrayBuffer,EnemySounds,enemySoundsFromArrayBuffer} from '@/core/enemy_struct';
import { type ItemDef } from '@/core/items_struct';
import { PCXProfile, PCX } from '@/core/pcx';
import { SeqFile } from '@/core/seqfile';
import { computed, onMounted, onUnmounted,  ref, watch } from 'vue';
import StatusBar, { type SaveRevertControl } from '@/components/statusBar'
import { messageBoxConfirm } from '@/utils/messageBox';
import ItemList from '@/components/ItemList.vue';
import { getDDLFileWithImport } from '@/components/tools/missingFiles';
import BitCheckbox from '@/components/BitCheckbox.vue';
import AbilitySheet from '@/components/AbilitySheet.vue';
import EffectSheet from '@/components/EffectSheet.vue';
import DelayLoadedList from '@/components/DelayLoadedList.vue';
import getGlobalDialogs from '@/utils/global_dialog_list';



const enemies = ref(new Enemies);
const sounds = ref<EnemySounds>([]);
const items = ref<ItemDef[]>([]);

const selected_enemy = ref<number>();

const list_graphics = ref<string[]>([]);
const list_sounds = ref<string[]>([]);

const new_enemy_type = ref<string>();

const appearence = ref<PCX>();
const appearence_margin = ref<string>("");
const palettes = ref<COLPaletteSet>();
const edit_seq = ref<string>();
const new_enemy_dlg = ref<HTMLDialogElement>();
let save_state: SaveRevertControl|null = null;

async function  load_files() {

    const sst = save_state;
    save_state = null;




    const en = await getDDLFileWithImport(server, "ENEMY.DAT", AssetGroup.MAPS)
    if (en) {
        const x = enemyAndSoundFromArrayBuffer(en);
        if (x === null) {
            const sd = await getDDLFileWithImport(server, "SOUND.DAT", AssetGroup.MAPS);
            if (sd) {
                enemies.value = enemyFromArrayBuffer(en);
                sounds.value = enemySoundsFromArrayBuffer(sd);
            }
        } else {
            enemies.value = x[0];
            sounds.value = x[1];
        }
        enemies.value.forEach(enm=>{
            enm.sound_files = [];
            for (let i = 0; i < 4; ++i) {
                enm.sound_files[i] = sounds.value[enm.sounds[i]-1] || "";
            }
        });

    }

    queueMicrotask(()=>save_state = sst);
    selected_enemy.value = undefined;
}



async function load_graphics() {
    try {
        const files = (await server.getDDLFiles(AssetGroup.ENEMIES,"user")).files;
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

function create_soundmap () {
    if (enemies.value) {
        const m: Record<string, number> = {};
        const l : EnemySounds = [];
        enemies.value.forEach(e=>{
            if (e.sound_files) {
                e.sounds = e.sound_files.map(name=>{
                    if (!name) return 0;
                    if (m[name]) return m[name];
                    else {
                        l.push(name);
                        m[name] = l.length;                        
                        return l.length;
                    }
                })
            }
        });
        sounds.value = l;
    }
}




async function init() {
    save_state = await StatusBar.register_save_control();
    save_state.on_save(save_all);
    save_state.on_revert(load_files);
    load_sounds();
    load_files();
    

}

async function save_all() {
    if (enemies.value && sounds.value) {
        try {
            create_soundmap();

            const e = enemies.value;
            e.forEach((x,idx)=>{
                x.cislo_vzoru = idx;
                x.locx = 128;
                x.locy = 128;
                x.lives = x.vlastnosti[CharacterStats.VLS_MAXHIT];
        });
            const s = sounds.value;
            const ebuff = enemyAndSoundToArrayBuffer(e as Enemies,s);
            
            await server.putDDLFile("ENEMY.DAT", ebuff, AssetGroup.MAPS);
        }
        catch (e) {
            alert("Failed to save files:" + e);
        }
    }

}

onUnmounted(()=>save_state?.unmount());



async function deleteEnemy() {
    if (selected_enemy.value !== undefined && enemies.value) {
        if (await messageBoxConfirm("Do you with to delete enemy:" + enemies.value.get(selected_enemy.value).name)) {
            enemies.value.remove(selected_enemy.value);
            selected_enemy.value = undefined;
        }
    }
}


function cloneEnemy() {
    if (enemies.value && selected_enemy.value !== undefined) {
        const new_itm = new EnemyDef;
        Object.assign(new_itm, enemies.value.get(selected_enemy.value));
        selected_enemy.value = enemies.value.add(new_itm);
    }
}

const filteredAndSortedEnemies = computed(() => {
    const mp =  enemies.value.map((x,idx)=>{return [x, idx]  as [ EnemyDef, number];})
                    .filter(x=>x[0].mobs_name.length>0);        
    const srt = mp.sort((a,b)=>{
                    return a[0].name.localeCompare(b[0].name);
                });
    return srt;

});

async function addEnemy() {
    await load_graphics();
    new_enemy_type.value = "";
    new_enemy_dlg.value?.showModal();
}

function createEnemy() {
    if (new_enemy_type.value) {
        const name = new_enemy_type.value.split('.')[0];
        const enm = new EnemyDef();
        const pos = enemies.value.add(enm);
        enm.name=`${name}-${pos}`;
        enm.mobs_name = name;
        selected_enemy.value = pos;
        new_enemy_type.value = undefined;
        new_enemy_dlg.value?.close();
    }
}

async function loadAppearence() {
    appearence.value = undefined;
    if (selected_enemy.value !==undefined  && enemies.value && enemies.value.get(selected_enemy.value)) {
        const e = enemies.value.get(selected_enemy.value);
         if (e.mobs_name) {                    
            try {
                const seqdata = await server.getDDLFile(e.mobs_name + ".SEQ");
                const seq = SeqFile.fromArrayBuffer(seqdata, e.mobs_name);
                let frm = seq.animation[4][seq.hit_pos||0];
                if (!frm) {
                    const row = seq.animation.find(x=>x.length != 0);
                    if (!row){
                        appearence.value = undefined;
                        return;
                    }
                    frm = row[0];
                }
                const name= frm.name;
                const imgdata = await server.getDDLFile(name);
                const pcx = PCX.fromArrayBuffer(imgdata);
                appearence.value = pcx;
                let ofs = frm.offset_x;
                if (ofs < -999) ofs = pcx.width/2;
                appearence_margin.value = `-${pcx.height/2}px -${ofs}px`;
            }
            catch (e) {
                console.warn("Can't open appearence:", e);
            }
         }
    }
}

async function loadColors() {
    palettes.value = undefined;
    if (selected_enemy.value !==undefined  && enemies.value && enemies.value.get(selected_enemy.value)) {
        const e = enemies.value.get(selected_enemy.value);
        if (e.mobs_name) {
            try {
                const paldata = await server.getDDLFile(e.mobs_name + ".COL");
                palettes.value = COLPaletteSet.fromArrayBuffer(paldata);
            }
            catch (e) {
                console.warn("Can't load palette", e);
            }
        }
    }
}

onMounted(init);

watch(selected_enemy, ()=>{
    loadAppearence();
    loadColors();
});





function openAppearence() {
    if (selected_enemy.value && enemies.value) {        
        edit_seq.value = enemies.value.get(selected_enemy.value || 0).mobs_name + '.SEQ';
    }
}
async function closeAppearence() {
    edit_seq.value = undefined;
}

const form = computed(()=>{
        if (typeof selected_enemy.value == "number") {
            return enemies.value.get(selected_enemy.value);
        } else {
            return new EnemyDef();
        }   
});

const inventory = computed({
    get:()  =>{
        return form.value.inv.filter(x=>x).map(x=>x-1);
    },
    set:(data:number[]) => {
        const s = data.map(x=>x+1);
        while (s.length<form.value.inv.length) s.push(0);
        form.value.inv = s;
    }
})

watch(enemies, ()=>{
    if (save_state) save_state.set_changed(true);    
},{deep:true})

const Abilities=[
    CharacterStats.VLS_SILA,
    CharacterStats.VLS_SMAGIE,
    CharacterStats.VLS_POHYB,
    CharacterStats.VLS_OBRAT,
    CharacterStats.VLS_MAXHIT,
    CharacterStats.VLS_UTOK_H,
    CharacterStats.VLS_UTOK_L,
    CharacterStats.VLS_DAMAGE,
    CharacterStats.VLS_OBRAN_H,
    CharacterStats.VLS_OBRAN_L,
    CharacterStats.VLS_OHEN,
    CharacterStats.VLS_VODA,
    CharacterStats.VLS_ZEME,
    CharacterStats.VLS_VZDUCH,
    CharacterStats.VLS_MYSL,
    CharacterStats.VLS_MGZIVEL,
    CharacterStats.VLS_MGSIL_H,
    CharacterStats.VLS_MGSIL_L,

]

async function laod_dialogs() : Promise<{value:number, label:string}[]> {
    const lst = await getGlobalDialogs();
    return  [{value:-1,label:'(none)'}].concat(lst.map(y=>({value:y[0], label:y[1]})));
}

</script>

<template>      
    <x-workspace>
        <div class="left-panel">
            <select v-model="selected_enemy" size="20" class="enemy-list">
                <option v-for="e in filteredAndSortedEnemies" :key="e[1]" :value="e[1]">{{ e[0].name }}</option>
            </select>
            <div class="buttons">
                <button @click="deleteEnemy">Delete</button>
                <button @click="cloneEnemy">Clone</button>
                <button @click="addEnemy">New</button>
            </div>
        </div>

        <div class="editor-bgr">
        <div class="editor" v-if="selected_enemy !== undefined">
            <div class="multiple">
                <x-section>
                    <x-section-title>Basic parameters (ID: {{ selected_enemy }})</x-section-title>
                    <x-form>
                        <label><span>Name</span><input type="text" v-model="form.name" maxlength="29"></label>
                        <label><span>Color</span><select v-model="form.paletts_count">
                            <option value="0">Original color</option>
                            <option v-if="palettes && palettes.palettes.length>0" :value="palettes.palettes.length">Randomize</option>
                            <option v-for="(p, idx) of (palettes?palettes.palettes:[])" :key="idx" :value="-idx-1">Palette {{ idx }}</option>
                        </select></label>
                        <label><span>Speed (px per frame)</span><input v-watch-range type="number" v-model="form.speed" min="0" max="200"></label>
                        <label><span>Sight range</span><input v-watch-range type="number" v-model="form.dohled"  min="0" max="100"></label>
                        <label><span>Engage range</span><input v-watch-range type="number" v-model="form.dosah"  min="0" max="100"></label>
                    </x-form>
                </x-section>
                <x-section>
                    <x-section-title>Flags</x-section-title>
                    <x-form>
                    <label><BitCheckbox :mask="EnemyFlags2.MOB_PASSABLE" v-model="form.vlajky"/><span>Through (not blocking)</span></label>
                    <label><BitCheckbox :mask="EnemyFlags2.MOB_MOBILE" v-model="form.vlajky"/><span>Just traveling sound effect</span></label>
                    <label><BitCheckbox :mask="EnemyFlags2.MOB_RELOAD" v-model="form.vlajky"/><span>Respawn</span></label>
                    </x-form>
                </x-section>
                <x-section>
                    <x-section-title>Sounds</x-section-title>
                    <x-form>
                        <label><span>Walk</span><select v-model="form.sound_files[EnemySounds.MBS_WALK]"><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                        <label><BitCheckbox v-model="form.vlajky" :mask="EnemyFlags2.MOB_SAMPLE_LOOP"  /><span>Loop</span></label>
                        <label><span>Attack</span><select v-model="form.sound_files[EnemySounds.MBS_ATTACK]"><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                        <label><span>Damaged</span><select v-model="form.sound_files[EnemySounds.MBS_HIT]"><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                    </x-form>
                </x-section>
            </div>
            <x-section class="appearence" @click="openAppearence">
                <x-section-title>Appearence</x-section-title>
                <div :style="{margin: appearence_margin}">
                    <CanvasView :canvas="appearence?appearence.createCanvas(PCXProfile.enemy,palettes && form.paletts_count<0?palettes.palettes[-form.paletts_count-1]:undefined):null" />
                </div>
            </x-section>
            <x-section>
                <x-section-title>Stats</x-section-title>
                <AbilitySheet v-model="form.vlastnosti" :enemy="true"></AbilitySheet>
            </x-section>
            <x-section>
                <x-section-title>Effects</x-section-title>
                <EffectSheet v-model="form.vlastnosti[CharacterStats.VLS_KOUZLA]" />
            </x-section>
            <x-section>
                <x-section-title>Behavior</x-section-title>
                <x-form>
                    <label><BitCheckbox v-model="form.stay_strategy" :mask="EnemyFlags1.MOB_WALK"/><span>Walking</span></label>
                    <label><BitCheckbox v-model="form.stay_strategy" :mask="EnemyFlags1.MOB_WATCH"/><span>Engage player</span></label>
                    <label><BitCheckbox v-model="form.stay_strategy" :mask="EnemyFlags1.MOB_LISTEN"/><span>Can hear sound</span></label>
                    <label><BitCheckbox v-model="form.vlajky" :mask="EnemyFlags2.MOB_SENSE"/><span>See invisible</span></label>
                    <label><BitCheckbox v-model="form.stay_strategy" :mask="EnemyFlags1.MOB_GUARD"/><span>Guarding the home room</span></label>
                    <label><BitCheckbox v-model="form.stay_strategy" :mask="EnemyFlags1.MOB_PICK"/><span>Scavenger</span></label>
                    <label><BitCheckbox v-model="form.vlajky" :mask="EnemyFlags2.MOB_CASTING"/><span>Spellcaster - spell id: <input v-model="form.casting" v-watch-range type="number"></span></label>
                    <label><BitCheckbox v-model="form.stay_strategy" :mask="EnemyFlags1.MOB_ROGUE"/><span>Ranger (shoots): </span></label>
                    <label><span>Flee probability [%]</span><input v-model="form.flee_num" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Special Behavior</span><select v-model="form.specproc">
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
                    <label><span>Dialog</span>
                        <DelayLoadedList v-model="form.dialog" :list="laod_dialogs()" size="1"/>
                        </label>
                    <label><span>Kill dialog (played on defeat)</span><DelayLoadedList v-model="form.kill_dialog" :list="laod_dialogs()" size="1"/></label>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Other properties</x-section-title>
                <x-form>
                    <label><span>Drop money</span><input v-model="form.money" v-watch-range type="number" min="0" max="65535"/></label>
                    <label><span>Total experience</span><input v-model="form.experience" v-watch-range type="number" min="0" max="999999"/></label>
                    <label><span>Kill experience</span><input v-model="form.bonus" v-watch-range type="number" min="0" max="999999"/></label>
                    <label><span>Inventory</span></label>
                    <ItemList v-model="inventory" :inside="true"></ItemList>
                    

                </x-form>
            </x-section>
        </div>
        </div>
    </x-workspace>

    <dialog ref="new_enemy_dlg" class="new-enemy-dlg">
        <header>Create enemy <button class="close" @click="new_enemy_dlg?.close()"></button></header>
        <x-form>
            <label><span>Enemy graphic</span><select v-model="new_enemy_type">
                <option v-for="g of list_graphics" :key="g" :value="g">{{ g }}</option>
            </select></label>
        </x-form>
        <footer>
            <button @click="createEnemy" :disabled="!new_enemy_type">Add</button>
            <button @click="new_enemy_dlg?.close()">Cancel</button>
        </footer>
    </dialog>
    <div class="edit-seq" v-if="edit_seq">
        <div>
            <AssetToolSeq v-model="edit_seq" :def="enemies.get(selected_enemy || 0)" />
            <button @click="closeAppearence" class="close"></button>
        </div>
    </div>
</template>

<style scoped>
.left-panel {
    width: 240px;
    position: absolute;
    top: 0;
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

.appearence {
    position: relative;
    height: 25em;
}

.appearence > div {
    position: absolute;    
    left: 50%;
    top: 50%;
    width: fit-content;
    height: fit-content;
}
.edit-seq > div{
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
    width: 920px;
    height: 37rem;
    background-color: #eee;
    padding: 10px;
    border: 1px black;
    box-shadow: 3px 3px 5px black;
}

.edit-seq {
    position: absolute;
    left: 0;top: 0;right: 0;bottom: 0;
    background-color: #0008;
}

dialog.new-enemy-dlg {
    width: 20rem;
}

</style>