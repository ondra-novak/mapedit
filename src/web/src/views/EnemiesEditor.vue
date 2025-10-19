<script setup lang="ts">
import AssetToolSeq from '@/components/AssetToolSeq.vue';
import CanvasView from '@/components/CanvasView.vue';
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { COLPaletteSet } from '@/core/col_palette_set';
import { EnemyStats, SpellEffects } from '@/core/common_defs';
import { EnemyFlags1, EnemyFlags2, enemyFromArrayBuffer,EnemySounds,enemySoundsFromArrayBuffer,enemySoundsToArrayBuffer,enemyToArrayBuffer,newEnemy,type EnemyDef } from '@/core/enemy_struct';
import { useBitmaskCheckbox2 } from '@/core/flags';
import { itemsFromArrayBuffer, type ItemDef } from '@/core/items_struct';
import { PCXProfile, PCX } from '@/core/pcx';
import { SeqFile } from '@/core/seqfile';
import { computed, onMounted, onUnmounted, reactive, ref, watch, type WatchHandle } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { messageBoxConfirm } from '@/utils/messageBox';
import ItemList from '@/components/ItemList.vue';


const required_files : FileItem[] =[
    {name:"ENEMY.DAT",group:AssetGroup.MAPS,ovr:false},
    {name:"SOUND.DAT",group:AssetGroup.MAPS,ovr:false},
    {name:"ITEMS.DAT",group:AssetGroup.MAPS,ovr:false},
];

const enemies = ref<EnemyDef[]>([]);
const sounds = ref<EnemySounds>([]);
const items = ref<ItemDef[]>([]);

const selected_enemy = ref<number>();

const import_enemy_dat_file = ref<File>();
const import_sound_dat_file = ref<File>();

const list_graphics = ref<string[]>([]);
const list_sounds = ref<string[]>([]);

const new_enemy_type = ref<string>();

const appearence = ref<PCX>();
const appearence_margin = ref<string>("");
const palettes = ref<COLPaletteSet>();
const edit_seq = ref<string>();


async function  load_files() {
    const ep = server.getDDLFile("ENEMY.DAT");
    const sp = server.getDDLFile("SOUND.DAT");
    const ip = server.getDDLFile("ITEMS.DAT");
    try {
        enemies.value = enemyFromArrayBuffer((await ep));
    } catch (e) {
        console.warn("failed to load ENEMY.DAT",e);
    }
    try {
        sounds.value = enemySoundsFromArrayBuffer((await sp));
    } catch (e) {
        console.warn("failed to load SOUND.DAT",e);
    }
    if (enemies.value && sounds.value) {
        enemies.value.forEach(enm=>{
            enm.sound_files = [];
            for (let i = 0; i < 4; ++i) {
                enm.sound_files[i] = sounds.value[enm.sounds[i]-1] || "";
            }
        });
    }
    try {
        items.value = itemsFromArrayBuffer(await ip);
    } catch (e){
        console.warn("failed to load ITEMS.DAT")
    }

    StatusBar.setChangedFlag(false);
    selected_enemy.value = undefined;
}


function create_new_project() {
    enemies.value = [];
    sounds.value = [];
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

function init() {
    load_sounds();
    load_files();
    StatusBar.registerSaveAndRevert(()=>{
        save_all();
    },()=>{
        load_files();
    })

}

async function save_all() {
    if (enemies.value && sounds.value) {
        try {
            create_soundmap();

            const e = enemies.value;
            const s = sounds.value;
            const ebuff = enemyToArrayBuffer(enemies.value);
            const sbuff = enemySoundsToArrayBuffer(sounds.value);
            await Promise.all([
                server.putDDLFile("ENEMY.DAT",ebuff,AssetGroup.MAPS),
                await server.putDDLFile("SOUND.DAT",sbuff,AssetGroup.MAPS)
            ]);
        }
        catch (e) {
            alert("Failed to save files:" + e);
        }
    }

}

onUnmounted(StatusBar.onFinalSave);



async function deleteEnemy() {
    if (selected_enemy.value !== undefined && enemies.value) {
        if (await messageBoxConfirm("Do you with to delete enemy:" + enemies.value[selected_enemy.value].name)) {
            enemies.value[selected_enemy.value].mobs_name="";
            while (enemies.value.length > 0 && enemies.value[enemies.value.length-1].mobs_name.length ==0) {
                enemies.value.pop();
            }
        }
    }
}

function findFreePos() : number{
    if (!enemies.value) return 0;
    const pos = enemies.value.findIndex((x:EnemyDef)=>x.mobs_name.length == 0);
    if (pos == -1) return enemies.value.length;
    else return pos;
}

function cloneEnemy() {
    if (enemies.value && selected_enemy.value !== undefined) {
        const pos = findFreePos();
        enemies.value[pos] = JSON.parse(JSON.stringify(enemies.value[selected_enemy.value]));
        selected_enemy.value = pos;
    }
}

const filteredAndSortedEnemies = computed(() => {
    const mp =  enemies.value.filter(x=>x.mobs_name.length>0)
        .map((x,idx)=>{return [x, idx];}) as [ EnemyDef, number][];
    const srt = mp.sort((a,b)=>{
                    return a[0].name.localeCompare(b[0].name);
                });
    return srt;

});

async function addEnemy() {
    await load_graphics();
    new_enemy_type.value = "";
}

function createEnemy() {
    if (new_enemy_type.value) {
        const pos =findFreePos();
        const name = new_enemy_type.value.split('.')[0];
        const enm = newEnemy(name);
        enm.name=`${name}-${pos}`;
        enemies.value[pos] = enm;
        selected_enemy.value = pos;
        new_enemy_type.value = undefined;

    }
}

async function loadAppearence() {
    appearence.value = undefined;
    if (selected_enemy.value !==undefined  && enemies.value && enemies.value[selected_enemy.value]) {
        const e = enemies.value[selected_enemy.value];
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
    if (selected_enemy.value !==undefined  && enemies.value && enemies.value[selected_enemy.value]) {
        const e = enemies.value[selected_enemy.value];
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


const [enm_f2, chk_f2 ] = useBitmaskCheckbox2(EnemyFlags2, 0);
const [enm_f1, chk_f1 ] = useBitmaskCheckbox2(EnemyFlags1, 0);
const [enm_eff, chk_eff ] = useBitmaskCheckbox2(SpellEffects, 0);

const form = reactive({
    name: "",
    speed: 1,
    sightrange : 1,
    engagerange: 1,
    dialognum: -1,
    palette: 0,
    casting: 0,
    snd_attack:"",
    snd_damage:"",
    snd_walk:"",
    stat_hp:0,
    stat_str:0,
    stat_mg:0,
    stat_mv:0,
    stat_dex:0,
    stat_def_min:0,
    stat_def_max:0,
    stat_att_min:0,
    stat_att_max:0,
    stat_damage:0,
    stat_mg_min:0,
    stat_mg_max:0,
    stat_mg_type:-1,
    stat_prot_f:0,
    stat_prot_w:0,
    stat_prot_e:0,
    stat_prot_a:0,
    stat_prot_m:0,
    stat_reg:0,
    flee_prob:0,
    specproc:4,
    exp:0,
    bonus_exp:0,
    money:0,
    inventory:new Array(16).fill(0)
});

function saveEnemyData() {
    if (selected_enemy.value !==undefined  && enemies.value) {
        const enm = enemies.value[selected_enemy.value];
        enm.name = form.name;
        enm.speed = form.speed;
        enm.dohled = form.sightrange;
        enm.dosah = form.engagerange;
        enm.dialog = form.dialognum;
        enm.paletts_count = form.palette;
        enm.casting = form.casting;
        enm.sound_files = [];
        enm.sound_files[EnemySounds.MBS_HIT] = form.snd_damage;
        enm.sound_files[EnemySounds.MBS_ATTACK] = form.snd_attack;
        enm.sound_files[EnemySounds.MBS_WALK] = form.snd_walk;
        if (!enm.vlastnosti) enm.vlastnosti = new Array(24);
        enm.vlastnosti[EnemyStats.VLS_MAXHIT] = form.stat_hp;
        enm.vlastnosti[EnemyStats.VLS_SILA] = form.stat_str;
        enm.vlastnosti[EnemyStats.VLS_SMAGIE] = form.stat_mg;
        enm.vlastnosti[EnemyStats.VLS_POHYB] = form.stat_mv;
        enm.vlastnosti[EnemyStats.VLS_OBRAT] = form.stat_dex;
        enm.vlastnosti[EnemyStats.VLS_OBRAN_L] = Math.min(form.stat_def_min,form.stat_def_max);
        enm.vlastnosti[EnemyStats.VLS_OBRAN_H] = Math.max(form.stat_def_min,form.stat_def_max);
        enm.vlastnosti[EnemyStats.VLS_UTOK_L] = Math.min(form.stat_att_min,form.stat_att_max);
        enm.vlastnosti[EnemyStats.VLS_UTOK_H] = Math.max(form.stat_att_min,form.stat_att_max);
        enm.vlastnosti[EnemyStats.VLS_DAMAGE] = form.stat_damage;
        enm.vlastnosti[EnemyStats.VLS_MGSIL_L] = Math.min(form.stat_mg_min,form.stat_mg_max);
        enm.vlastnosti[EnemyStats.VLS_MGSIL_H] = Math.max(form.stat_mg_min,form.stat_mg_max);
        enm.vlastnosti[EnemyStats.VLS_MGZIVEL] = form.stat_mg_type;
        enm.vlastnosti[EnemyStats.VLS_OHEN] = form.stat_prot_f;
        enm.vlastnosti[EnemyStats.VLS_VODA] = form.stat_prot_w;
        enm.vlastnosti[EnemyStats.VLS_ZEME] = form.stat_prot_e;
        enm.vlastnosti[EnemyStats.VLS_VZDUCH] = form.stat_prot_a;
        enm.vlastnosti[EnemyStats.VLS_MYSL] = form.stat_prot_m;
        enm.vlastnosti[EnemyStats.VLS_HPREG] = form.stat_reg;
        enm.flee_num = form.flee_prob;
        enm.specproc = form.specproc;
        enm.experience = form.exp;
        enm.bonus = form.bonus_exp;
        enm.money = form.money;
        enm.stay_strategy = enm_f1.value;
        enm.vlajky = enm_f2.value
        enm.vlastnosti[EnemyStats.VLS_KOUZLA] = enm_eff.value;
        enm.inv = form.inventory.map(x=>x+1);
        enm.inv = enm.inv.slice(0, 16);
        while (enm.inv.length < 16) {
            enm.inv.push(0);
        }
        StatusBar.setChangedFlag(true);
    }

}

const save_watch = ref<WatchHandle>();

function loadEnemyData() {
    if (selected_enemy.value !==undefined && enemies.value) {
        if (save_watch.value) save_watch.value();

        const enm = enemies.value[selected_enemy.value];
        if (!enm.vlastnosti) enm.vlastnosti = new Array(24);

        form.name = enm.name;
        form.speed = enm.speed;
        form.sightrange = enm.dohled;
        form.engagerange = enm.dosah;
        form.dialognum = enm.dialog;
        form.flee_prob = enm.flee_num;
        form.specproc = enm.specproc;
        form.exp = enm.experience;
        form.bonus_exp = enm.bonus;
        form.money = enm.money;
        form.palette = enm.paletts_count;
        enm_f1.value = enm.stay_strategy;
        enm_f2.value = enm.vlajky;
        if (enm.sound_files) {
            form.snd_damage =enm.sound_files[EnemySounds.MBS_HIT]
            form.snd_attack =enm.sound_files[EnemySounds.MBS_ATTACK]
            form.snd_walk =enm.sound_files[EnemySounds.MBS_WALK]
        }
        form.stat_hp =enm.vlastnosti[EnemyStats.VLS_MAXHIT]
        form.stat_str =enm.vlastnosti[EnemyStats.VLS_SILA]
        form.stat_mg =enm.vlastnosti[EnemyStats.VLS_SMAGIE]
        form.stat_mv =enm.vlastnosti[EnemyStats.VLS_POHYB]
        form.stat_dex =enm.vlastnosti[EnemyStats.VLS_OBRAT]
        form.stat_def_min=enm.vlastnosti[EnemyStats.VLS_OBRAN_L]
        form.stat_def_max =enm.vlastnosti[EnemyStats.VLS_OBRAN_H]
        form.stat_att_min =enm.vlastnosti[EnemyStats.VLS_UTOK_L]
        form.stat_att_max =enm.vlastnosti[EnemyStats.VLS_UTOK_H]
        form.stat_mg_min =enm.vlastnosti[EnemyStats.VLS_MGSIL_L]
        form.stat_mg_max =enm.vlastnosti[EnemyStats.VLS_MGSIL_H]
        form.stat_mg_type =enm.vlastnosti[EnemyStats.VLS_MGZIVEL]
        form.stat_damage =enm.vlastnosti[EnemyStats.VLS_DAMAGE]
        form.stat_prot_f =enm.vlastnosti[EnemyStats.VLS_OHEN]
        form.stat_prot_w =enm.vlastnosti[EnemyStats.VLS_VODA]
        form.stat_prot_e =enm.vlastnosti[EnemyStats.VLS_ZEME]
        form.stat_prot_a =enm.vlastnosti[EnemyStats.VLS_VZDUCH]
        form.stat_prot_m =enm.vlastnosti[EnemyStats.VLS_MYSL]
        form.stat_reg =enm.vlastnosti[EnemyStats.VLS_HPREG]
        enm_eff.value =enm.vlastnosti[EnemyStats.VLS_KOUZLA]
        form.inventory = enm.inv.filter(x=>x).map(x=>x-1);
        loadAppearence();
        loadColors();
        save_watch.value = watch([form,enm_f1,enm_f2,enm_eff],saveEnemyData,{deep:true});        
    }
}





watch([selected_enemy], loadEnemyData);

function openAppearence() {
    if (selected_enemy.value && enemies.value) {
        if (!edit_seq.value) StatusBar.push();
        edit_seq.value = enemies.value[selected_enemy.value || 0].mobs_name + '.SEQ';
    }
}
function closeAppearence() {
    if (edit_seq.value) {        
        edit_seq.value = undefined;
        StatusBar.pop();
    }
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
                    <x-section-title>Basic parameters</x-section-title>
                    <x-form>
                        <label><span>Name</span><input type="text" v-model="form.name" maxlength="29"></label>
                        <label><span>Color</span><select v-model="form.palette">
                            <option value="0">Original color</option>
                            <option v-if="palettes && palettes.palettes.length>0" :value="palettes.palettes.length">Randomize</option>
                            <option v-for="(p, idx) of (palettes?palettes.palettes:[])" :key="idx" :value="-idx-1">Palette {{ idx }}</option>
                        </select></label>
                        <label><span>Speed (px per frame)</span><input v-watch-range type="number" v-model="form.speed" min="0" max="200"></label>
                        <label><span>Sight range</span><input v-watch-range type="number" v-model="form.sightrange"  min="0" max="100"></label>
                        <label><span>Engage range</span><input v-watch-range type="number" v-model="form.engagerange"  min="0" max="100"></label>
                    </x-form>
                </x-section>
                <x-section>
                    <x-section-title>Flags</x-section-title>
                    <x-form>
                    <label><input type="checkbox" v-model="chk_f2.MOB_PASSABLE"/><span>Through (not blocking)</span></label>
                    <label><input type="checkbox" v-model="chk_f2.MOB_MOBILE"/><span>Just traveling sound effect</span></label>
                    <label><input type="checkbox" v-model="chk_f2.MOB_RELOAD"/><span>Respawn</span></label>
                    </x-form>
                </x-section>
                <x-section>
                    <x-section-title>Sounds</x-section-title>
                    <x-form>
                        <label><span>Walk</span><select v-model="form.snd_walk"><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                        <label><input v-model="chk_f2.MOB_SAMPLE_LOOP" type="checkbox" /><span>Loop</span></label>
                        <label><span>Attack</span><select v-model="form.snd_attack"><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                        <label><span>Damaged</span><select v-model="form.snd_damage"><option></option><option v-for="s of list_sounds" :key="s" :value="s">{{ s }}</option></select></label>
                    </x-form>
                </x-section>
            </div>
            <x-section class="appearence" @click="openAppearence">
                <x-section-title>Appearence</x-section-title>
                <div :style="{margin: appearence_margin}">
                    <CanvasView :canvas="appearence?appearence.createCanvas(PCXProfile.enemy,palettes && form.palette<0?palettes.palettes[-form.palette-1]:undefined):null" />
                </div>
            </x-section>
            <x-section>
                <x-form>
                    <x-section-title>Stats</x-section-title>
                    <label><span>Hit points</span><input v-model="form.stat_hp" v-watch-range type="number" min="0" max="65535"/></label>
                    <label><span>Strength</span><input v-model="form.stat_str"v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Magic (% of casting)</span><input v-model="form.stat_mg" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Movement (/15 actions)</span><input v-model="form.stat_mv" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Dexterity</span><input v-model="form.stat_dex" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Defense</span><div><input v-model="form.stat_def_min" v-watch-range type="number" min="0" max="65535"/>-<input v-model="form.stat_def_max" v-watch-range type="number" min="0" max="65535"/></div></label>
                    <label><span>Attack</span><div><input v-model="form.stat_att_min" v-watch-range type="number" min="0" max="65535"/>-<input v-model="form.stat_att_max" v-watch-range type="number" min="0" max="65535"/></div></label>
                    <label><span>Extra damage</span><input v-model="form.stat_damage" v-watch-range type="number" /></label>
                    <label><span>Magic attack</span><div><input v-model="form.stat_mg_min" v-watch-range type="number" min="0" max="65535"/>-<input v-model="form.stat_mg_min" v-watch-range type="number" min="0" max="65535"/></div></label>
                    <label><span>Magic attack type</span><div><select v-model="form.stat_mg_type">
                        <option value="-1">--select--</option>
                        <option value="0">fire</option>
                        <option value="1">water</option>
                        <option value="2">earth</option>
                        <option value="3">air</option>
                        <option value="4">mind</option>
                    </select></div></label>
                    <label><span>Protection (fire)</span><input  v-model="form.stat_prot_f" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Protection (water)</span><input  v-model="form.stat_prot_w" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Protection (earth)</span><input  v-model="form.stat_prot_e" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Protection (air)</span><input  v-model="form.stat_prot_a" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Protection (mind)</span><input  v-model="form.stat_prot_m" v-watch-range type="number" min="0" max="100"/></label>
                    <label><span>Regeneration</span><input v-model="form.stat_reg" v-watch-range type="number" min="0" max="65535"/></label>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Effects</x-section-title>
                <x-form>
                    <label><input type="checkbox" v-model="chk_eff.SPL_INVIS"/><span>Invisible</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_OKO"/><span>Eye by eye</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_DRAIN"/><span>Live drain</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_SANC"/><span>Physical resistance (50%)</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_HSANC"/><span>Magical resistance (50%)</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_BLIND"/><span>Blinded</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_REGEN"/><span>Regenerate during battle</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_KNOCK"/><span>Hit knock back</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_FEAR"/><span>Fear (flee from battle)</span></label>
                    <label><input type="checkbox" v-model="chk_eff.SPL_STONED"/><span>Stoned</span></label>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Behavior</x-section-title>
                <x-form>
                    <label><input type="checkbox" v-model="chk_f1.MOB_WALK"/><span>Walking</span></label>
                    <label><input type="checkbox" v-model="chk_f1.MOB_WATCH"/><span>Engage player</span></label>
                    <label><input type="checkbox" v-model="chk_f1.MOB_LISTEN"/><span>Can hear sound</span></label>
                    <label><input type="checkbox" v-model="chk_f2.MOB_SENSE"/><span>See invisible</span></label>
                    <label><input type="checkbox" v-model="chk_f1.MOB_GUARD"/><span>Guarding the home room</span></label>
                    <label><input type="checkbox" v-model="chk_f1.MOB_PICK"/><span>Scavenger</span></label>
                    <label><input type="checkbox" v-model="chk_f2.MOB_CASTING"/><span>Spellcaster - spell id: <input v-model="form.casting" v-watch-range type="number"></span></label>
                    <label><input type="checkbox" v-model="chk_f1.MOB_ROGUE"/><span>Ranger (shoots): </span></label>
                    <label><span>Flee probability [%]</span><input v-model="form.flee_prob" v-watch-range type="number" min="0" max="100"/></label>
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
                    <label><span>Dialog number</span><input v-watch-range type="number" v-model="form.dialognum"  min="0" max="32767"></label>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Other properties</x-section-title>
                <x-form>
                    <label><span>Drop money</span><input v-model="form.money" v-watch-range type="number" min="0" max="65535"/></label>
                    <label><span>Total experience</span><input v-model="form.exp" v-watch-range type="number" min="0" max="999999"/></label>
                    <label><span>Kill experience</span><input v-model="form.bonus_exp" v-watch-range type="number" min="0" max="999999"/></label>
                    <label><span>Inventory</span></label>
                    <ItemList v-model="form.inventory"></ItemList>
                    

                </x-form>
            </x-section>
        </div>
        </div>
    </x-workspace>

    <MissingFiles :files="required_files" @imported="load_files" @created_new="create_new_project"></MissingFiles>

    <div class="new-enemy-window" v-if="new_enemy_type !== undefined">
        <x-form>
            <label><span>Enemy graphic</span><select v-model="new_enemy_type">
                <option v-for="g of list_graphics" :key="g" :value="g">{{ g }}</option>
            </select></label>
        </x-form>
        <div class="button-panel"><button @click="createEnemy" :disabled="!new_enemy_type">Add</button><button @click="new_enemy_type=undefined">Cancel</button></div>
    </div>
    <div class="edit-seq" v-if="edit_seq">
        <div>
            <AssetToolSeq v-model="edit_seq" :def="enemies[selected_enemy || 0]" />
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
.new-enemy-window {
    position: absolute;
    left: 50%;
    top: 10vw;
    height: 14em;
    width: 25em;
    margin-left: -10em;
    border: 1px solid;
    background-color: white;
    text-align: center;
    box-shadow: 3px 3px 5px black;
}

.new-enemy-window {
    padding-top: 1em;
    height: 5em;
}
 
.new-enemy-window x-form {
    padding: 0 2em;
}

.button-panel {
    border-top: 1px solid;
    padding-top:  1em;
}

.button-panel button {
    width: 5em;
}
.enemy-not-found input {
    display: block;
    margin: 1em auto;
    width: 7.5em;
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
    width: 820px;
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


</style>