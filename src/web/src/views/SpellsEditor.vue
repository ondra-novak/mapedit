<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { CharacterStatsNames, ElementTypeName, SpellEffectName } from '@/core/common_defs';
import { useBitmaskCheckbox2 } from '@/core/flags';
import {ItemHive, itemsFromArrayBuffer } from '@/core/items_struct';
import { spellsFromArrayBuffer, SpellCommandsArgs ,TKouzlo, SpellArgument, spellsToArrayBuffer, SpellHive } from '@/core/spell_structs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar, { type SaveRevertControl } from '@/components/statusBar.ts'
import { create_datalist } from '@/utils/datalist';
import { getDDLFileWithImport } from '@/components/tools/missingFiles';
import { messageBoxAlert } from '@/utils/messageBox';
import DelayLoadedList from '@/components/DelayLoadedList.vue';
import { SectorFlags } from '@/core/map_structs';


const spell_list = ref<SpellHive>(new SpellHive());
const cur_spell_index = ref<number>(-1)
const current_spell = computed(()=>{
    const v = cur_spell_index.value;
    const tbl = spell_list.value;
    if (v < 0 || !tbl.is_valid(v)) return null;
    else return tbl.get(v);
});


const item_list = ref(new ItemHive);
const all_sounds = ref<string[]>([]);
const all_animations = ref<string[]>([]);
let save_state: SaveRevertControl;

const TargetType = [
    "self",
    "char",
    "this sq.",
    "next sq.",
    "dead char",
    "far char",
    "rnd char",
    "other",
];

const ProtectionFlag = ["Harm","Safe"];

const FlagsNames = ["","EF","T","EF | T"]

function init() {
    function reload() {
        cur_spell_index.value = -1;
        getDDLFileWithImport(server, "KOUZLA.DAT", AssetGroup.MAPS).then(x=>{            
            spell_list.value = new SpellHive;
            if (x) {
                try {
                    spell_list.value = spellsFromArrayBuffer(x);
                } catch (e) {
                    const err = e as Error;
                    messageBoxAlert(`Error loading spell list: ${err.message}`);
                }
            }
            for (let i = 0; i < 105; ++i) {
                const t = new TKouzlo;
                t.script = [];
                if (!spell_list.value.is_valid(i)) spell_list.value.set(i, t);
            }
            nextTick(()=>{
                save_state.set_changed(false);
            })
        });
        getDDLFileWithImport(server,"ITEMS.DAT",AssetGroup.MAPS).then(x=>{
            if (x) item_list.value = itemsFromArrayBuffer(x);    
            else item_list.value = new ItemHive;
        });
    }

    
    reload();
    server.getDDLFiles(null,null).then(x=>{
        all_animations.value = x.files.map(x=>x.name).filter(x=>x.toUpperCase().endsWith(".MGF"));
        all_sounds.value = x.files.filter(x=>x.group == AssetGroup.SOUNDS).map(x=>x.name);
    })
    StatusBar.register_save_control().then(st=>{
        st.on_save(async ()=>{
            const b = spellsToArrayBuffer(spell_list.value as SpellHive);
            await server.putDDLFile("KOUZLA.DAT", b, AssetGroup.MAPS);
        });
        st.on_revert(reload);
        save_state = st;
    });
}

const shadow_drag_table = ref<HTMLTableElement|null>(null);
const shadow_drag_content = ref<HTMLElement|null>(null);

onMounted(init);
onUnmounted(()=>save_state.unmount());


const [ cur_spell_trackon, chk_trackon ] = useBitmaskCheckbox2({
    TRACKON: 0x1,
    TELEPORT: 0x2
});

function findItem(event: Event, params: any[], index: number) {
    const t = event.target as HTMLInputElement;
    if (t && item_list.value) {
        if (t.value) {
            const p = item_list.value.findIndex((x,n)=>`${x.jmeno} #${n}` == t.value)
            if (p != -1) {
                params[index] = p;
                return;
            }
        }
        t.value = `${item_list.value.get(params[index] as number).jmeno} #${params[index]}`;
    }

}

function begin_drag(event: Event, idx: number) {

    const e = event as MouseEvent;
    if (e.buttons != 1) return;    
    
    if (!shadow_drag_content.value || !shadow_drag_table.value) return;
    const tbl = shadow_drag_table.value;
    if (!tbl.hidden) return;
    let src_element = event.target as HTMLElement|null;
    let work_element = shadow_drag_table.value.parentElement;
    if (!work_element) return;
    const box = work_element.getBoundingClientRect();
    while (src_element && src_element.tagName.toUpperCase() != 'TR') src_element = src_element.parentElement;
    if (!src_element) return;
    const ctx = shadow_drag_content.value;
    ctx.innerHTML = '';
    ctx.appendChild(src_element.cloneNode(true));
    let c1 = ctx.firstChild as HTMLElement;
    let c2 = src_element.firstChild as HTMLElement;
    while (c1 && c2) {
        c1.style.widows = `${c2.offsetWidth}px`;
        c1=c1.nextElementSibling as HTMLElement;
        c2=c2.nextElementSibling as HTMLElement;
    }

    function move_shadow_to(e: MouseEvent) {
        const rx = 10;
        const ry = e.clientY - box.top - tbl.clientHeight/2;
        tbl.style.left = `${rx}px`;
        tbl.style.top = `${ry}px`;
        tbl.hidden = false;
    }
    e.preventDefault();
    move_shadow_to(e);

    const move_event =(e:MouseEvent) => {
        move_shadow_to(e);        
        e.preventDefault();
    };

    const move_stop = (e:MouseEvent) => {
        work_element.removeEventListener("mousemove", move_event);
        work_element.removeEventListener("mouseup", move_stop);
        e.preventDefault();
        tbl.hidden = true;
        const cont = work_element.getElementsByTagName("TR");
        let foundId : number | null = null;
        Array.prototype.forEach.call(cont, (element : HTMLElement)=> {
            const box = element.getBoundingClientRect();
            if (e.clientY >= box.top && e.clientY <= box.bottom && element.dataset.index)
                foundId = parseInt(element.dataset.index);
        });
        if (foundId !==null && idx != foundId) {
            const script = current_spell.value!.script!
            const r = script[idx];
            script.splice(idx,1);
            script.splice(foundId,0,r);
        }
    }


    work_element.addEventListener("mousemove", move_event);
    work_element.addEventListener("mouseup", move_stop);
    

}

function validateCommand(event: Event) {
    if (!current_spell.value) return
    const t = event.target as HTMLInputElement;
    const cmd = SpellCommandsArgs[t.value];
    if (cmd) {
        if (!current_spell.value.script) current_spell.value.script = [];
        current_spell.value.script.push({
            command: t.value,
            args: new Array(cmd.length).fill(null).map((_,idx:number)=>cmd[idx] < 16?0:""),
        });
        t.value = "";
    }
}

function validateCommandEnter(event: Event) {
    const e = event as KeyboardEvent;
    if (e.key == "Enter") {
        e.preventDefault();
        validateCommand(event);
    }
}

watch(current_spell, ()=>{    
    if (current_spell.value) cur_spell_trackon.value = current_spell.value.flags;    
});
watch(cur_spell_trackon, ()=>{
    if (current_spell.value && cur_spell_trackon) current_spell.value.flags = cur_spell_trackon.value;
});

watch(spell_list, ()=>save_state.set_changed(true),{deep:true});

const ds_spellAnim = create_datalist();
const ds_spellSounds = create_datalist();
const ds_spellItems = create_datalist();
const ds_spellCommands = create_datalist(()=>Object.keys(SpellCommandsArgs).map(k=>({value:k})));

watch(all_animations, (nv)=>ds_spellAnim.update(()=>nv.map(v=>({value:v}))));
watch(all_sounds, (nv)=>ds_spellSounds.update(()=>nv.map(v=>({value:v}))));
watch(item_list, (nv)=>ds_spellItems.update(()=>nv.map((v,id)=>({value:v.jmeno, label:`${v.jmeno} #${id}`}))));

function calc_row_csss_class(idx: number) {
    const s = idx == cur_spell_index.value?"selected":""
    return `element-${Math.floor(idx/21)} ${s}`;
}

const rune_list = computed(()=>{
    return spell_list.value.filter((x,idx)=>idx<105);
})
const other_spell_list = computed(()=>{
    return (spell_list.value.map((x,idx)=>[x,idx]) as [TKouzlo, number][])
    .filter(x=>x[1]>=105);
})

function load_spell_list() {
    return spell_list.value.map((x,idx)=>({value:idx,label:x.spellname}));
}

const categories = [0,1,2,3,4];
const runes = [0,1,2,3,4,5,6]
function power_list(c: number, r: number) : [TKouzlo, number][] {
    const start = c * 21 +r *3;
    return spell_list.value.get_raw().slice(start, start+3).map((x,idx)=>[x,idx+start]) as [TKouzlo, number][];
}
const section_len = 25;
const page_list = computed(()=>{
    const other = spell_list.value.map((x,idx)=>[x,idx] as [TKouzlo, number]).filter(x=>x[1]>=105);
    const n = other.length;
    let count = Math.floor((n + section_len-1)/section_len);
    const out = [];
    for (let i = 0; i < count; ++i) {
        out.push(i * section_len);
    }
    return out;
})
function spell_page(start: number) {
    const other = spell_list.value.map((x,idx)=>[x,idx] as [TKouzlo, number]).filter(x=>x[1]>=105);
    return other.slice(start, start+section_len);
}

function add_spell() {
    const k = new TKouzlo;
    k.script = [];
    cur_spell_index.value = spell_list.value.add(k);
}

</script>

<template>
    <x-workspace>
        <div class="panels">
            <div class="runes">
                <div v-for="c in categories" :class="`category element-${c}`" :key="c">
                    <div class="element-name"> {{ ElementTypeName[c] }}</div>
                    <div v-for="r in runes">
                        <div class="rune-name"> {{ spell_list.get(c * 21 + r * 3)?.spellname }}</div>
                        <div class="powers">
                            <div v-for="[spl, idx] in power_list(c, r)" :key="idx" @click="cur_spell_index = idx"
                                :class="{ spell: true, selected: idx == cur_spell_index }">
                                <div class="name">{{ spl.spellname }}</div>
                                <div class="un">{{ spl.um }}</div>
                                <div class="mge">{{ spl.mge }}</div>
                                <div class="ap">{{ spl.cast_time }}</div>
                                <div class="tt">{{ TargetType[spl.cil] }}</div>
                                <div class="pv">{{ ProtectionFlag[spl.povaha] }}</div>
                                <div class="gr">{{ spl.accnum }}</div>
                                <div class="flg">{{ FlagsNames[spl.flags] }}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="other" v-for="p of page_list" :key="p">
                    <div>
                        <div v-for="[spl, idx] of spell_page(p)" :key="idx" @click="cur_spell_index = idx"
                            :class="{ spell: true, selected: idx == cur_spell_index }">
                            <div class="id">{{ idx }}</div>
                            <div class="name">{{ spl.spellname }}</div>
                            <div class="tt">{{ TargetType[spl.cil] }}</div>
                            <div class="pv">{{ ProtectionFlag[spl.povaha] }}</div>
                            <div class="gr">{{ spl.accnum }}</div>
                            <div class="flg">{{ FlagsNames[spl.flags] }}</div>
                            <div class="btn"><button
                                    @click="spell_list.remove(idx); $event.stopPropagation()">🞬</button></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="editor">
                <div v-if="current_spell">
                    <div>
                        <x-section>
                            <x-section-title>Basic settings</x-section-title>
                            <x-form>
                                <label v-if="cur_spell_index < 105"><span>Rune</span>
                                    <div><input type="text" readonly="true" size="4"
                                            :value="ElementTypeName[Math.floor(cur_spell_index / 21)]">
                                        <input size="4" type="text" readonly="true"
                                            :value="Math.floor((cur_spell_index % 21) / 3) + 1">
                                        <input size="4" type="text" readonly="true" :value="(cur_spell_index % 3) + 1">
                                    </div>
                                </label>
                                <label><span v-if="cur_spell_index < 105 && cur_spell_index % 3 == 0">Display
                                        name</span>
                                    <span v-if="cur_spell_index > 105 || cur_spell_index % 3 != 0">Name (not
                                        shown)</span>
                                    <input type="text" v-model="current_spell.spellname">
                                </label>
                                <template v-if="cur_spell_index < 105">
                                    <label><span>Magic level</span><input type="number"
                                            v-model="current_spell.um"></label>
                                    <label><span>Mana cost</span><input type="number"
                                            v-model="current_spell.mge"></label>
                                    <label><span>Action points cost (0=disabled)</span><input type="number"
                                            v-model="current_spell.cast_time"></label>
                                    <label><span>Backfire spell id</span>
                                        <DelayLoadedList v-model="current_spell.backfire" :list="load_spell_list()"
                                            :key="cur_spell_index"></DelayLoadedList>
                                    </label>
                                </template>
                                <label><span>Target / Victim</span>
                                    <div><select v-model="current_spell.cil">
                                            <option v-for="(v, id) of TargetType" :key="id" :value="id">{{ v }}</option>
                                        </select></div>
                                </label>
                                <label><span>Spell group</span><input type="number"
                                        v-model="current_spell.accnum"></label>
                                <label><input type="checkbox" v-model="current_spell.povaha" :true-value="1"
                                        :false-value="0"><span>Harmful</span></label>
                                <label v-if="cur_spell_index < 105"><input type="checkbox"
                                        v-model="chk_trackon.TRACKON"><span>Need enemy in front</span></label>
                                <label v-if="cur_spell_index < 105"><input type="checkbox"
                                        v-model="chk_trackon.TELEPORT"><span>Open map for teleport</span></label>
                            </x-form>
                        </x-section>
                        <x-section>
                            <table ref="shadow_drag_table" class="drag-preview" hidden="true">
                                <tbody ref="shadow_drag_content">
                                    <tr>
                                        <td>Drag</td>
                                    </tr>
                                </tbody>
                            </table>
                            <x-section-title>Script</x-section-title>
                            <table>
                                <tbody>
                                    <tr v-for="(v, id) of (current_spell.script || [])" :key="id" :data-index="id">
                                        <td>{{ id }} </td>
                                        <td class="grab-handle" @mousedown="$event => begin_drag($event, id)">≡ {{
                                            v.command }}</td>
                                        <td><template v-for="(a, id) of v.args" :key="id">
                                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Number"
                                                    v-model="v.args[id]" type="number">
                                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Percent"
                                                    v-model="v.args[id]" type="number">
                                                <input
                                                    v-if="SpellCommandsArgs[v.command][id] == SpellArgument.AnimationFile"
                                                    v-model="v.args[id]" type="text" :list="ds_spellAnim.id">
                                                <input
                                                    v-if="SpellCommandsArgs[v.command][id] == SpellArgument.SoundFile"
                                                    v-model="v.args[id]" type="text" :list="ds_spellSounds.id">
                                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Item"
                                                    type="text"
                                                    :value="`${item_list.get(a as number).jmeno || '???'} #${a}`"
                                                    @change="$event => findItem($event, v.args, id)"
                                                    :list="ds_spellItems.id">
                                                <select v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Element"
                                                    v-model="v.args[id]">
                                                    <option v-for="(v, id) of ElementTypeName" :key="id" :value="id"> {{
                                                        v }}</option>
                                                </select>
                                                <select v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Stat"
                                                    v-model="v.args[id]">
                                                    <option v-for="(v, id) of CharacterStatsNames" :key="id" :value="id">
                                                        {{ v }}</option>
                                                </select>
                                                <select
                                                    v-if="SpellCommandsArgs[v.command][id] == SpellArgument.EffectBit"
                                                    v-model="v.args[id]">
                                                    <option v-for="(v, id) of SpellEffectName" :key="id" :value="1 << id">
                                                        {{ v }}</option>
                                                </select>
                                            </template></td>
                                        <td>
                                            <button @click="current_spell!.script!.splice(id, 1)">🞬</button>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td> {{ current_spell.script?.length }}</td>
                                        <td colspan="2"><input type="text" :list="ds_spellCommands.id"
                                                @change="$event => validateCommand($event)"
                                                @keydown="$event => validateCommandEnter($event)"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </x-section>
                    </div>
                </div>
                    <div class="add-spell"><button @click="add_spell">Add</button></div>
            </div>
        </div>
    </x-workspace>

</template>

<style scoped>

.element-0{background-color: #fca}
.element-1{background-color: #acf}
.element-2{background-color: #ffa}
.element-3{background-color: #aff}
.element-4{background-color: #faf}


.panels {
    display:flex;
    height: 100%;
    justify-content: space-evenly;
}

.panels > div {
    height: 100%;
    overflow: auto;    
}

.editor {
    position:relative;
    width: 35rem;
    flex-shrink: 0;
}

.editor > div {
    max-height: 75vh;
    overflow:auto;
}


.editor table {
    width: 100%;
    border-collapse: collapse;
    
}

.editor table input[type=text] {
    width: 10rem;
    text-align: left;
}

.editor table td:last-child {
    white-space: nowrap;
}
.editor table td:first-child {
    text-align: right;
}

.editor table td {
    padding: 0.1em;
    border-bottom: 1px dotted
}

table.drag-preview {
    position: absolute;
    left: 0;
    top: 0;
    background-color: #ddd;
    border: 1px solid;
    opacity: 0.5;
    width: unset;
}

table.drag-preview button {
    display: none;
}
    
.grab-handle {
    cursor:grab;
}
h1 {
    margin-left: 32rem;
}

input[type=number] {
    width: 4rem;
    text-align: center;
}

.runes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: space-evenly;
}
.element-name, .rune-name{
    font-weight: bold;
    padding: 0.2rem;
}
.rune-name {
    padding-left: 0.4rem;
}
.powers {
    padding-left: 0.6rem;
}

.spell {
    cursor: pointer;
    position: relative;    
    display: flex;
}

.spell > * {
    border: 1px dotted;
    margin: -1px -1px 0 0;
    padding: 0.1rem;
}
.spell.selected {
    background-color: black;;
    color: yellow;
}
.spell:hover::after {
    position:absolute;
    inset: 0;
    content: "";
    background-color: #FFF8;
    pointer-events: none;
    
}
.spell > .name {width:10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;}
.spell > .um {width:2rem;text-align: right;}
.spell > .mge {width:2rem;text-align: right; color:blue}
.spell > .ap {width:1rem;text-align: right; color:brown}
.spell > .tt {width:5rem;text-align: center;}
.spell > .pv {width:3rem;text-align: left;}
.spell > .gr {width:3rem;text-align: right; color:green}
.spell > .flg {width:3rem;text-align: center;}
.spell > .id {width:2.5rem;text-align: right;}

.add-spell {
    position: absolute;
    right: 0;
    bottom: 0;
    font-size: 1.5rem;
    text-align: right;
    padding: 1rem;
}
.add-spell button {
    font-size: 1.5rem;
}


</style>