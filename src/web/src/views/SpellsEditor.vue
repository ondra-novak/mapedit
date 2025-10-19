<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { CharacterStatsNames, ElementTypeName, SpellEffectName } from '@/core/common_defs';
import { useBitmaskCheckbox2 } from '@/core/flags';
import {type ItemDef, itemsFromArrayBuffer } from '@/core/items_struct';
import { spellsFromArrayBuffer, SpellCommandsArgs ,type TKouzlo, SpellArgument, spellsToArrayBuffer } from '@/core/spell_structs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { create_datalist } from '@/utils/datalist';

const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"KOUZLA.DAT",ovr:true}
];

const spell_list = ref<TKouzlo[]>([]);
const current_spell = ref<TKouzlo>();

const item_list = ref<ItemDef[]>([]);
const all_sounds = ref<string[]>([]);
const all_animations = ref<string[]>([]);

const TargetType = [
    "self",
    "character",
    "this square",
    "next square",
    "dead character",
    "far character",
    "random character",
    "other target",
];

const ProtectionFlag = ["No","Yes"];

const FlagsNames = ["---","enemy in front","teleport","enemy in front | teleport"]

function init() {
    function reload() {
        current_spell.value = undefined;
        server.getDDLFile("KOUZLA.DAT").then(x=>{
            spell_list.value = spellsFromArrayBuffer(x);
                nextTick(()=>{
                    StatusBar.setChangedFlag(false);
                })
        });
    }

    server.getDDLFile("ITEMS.DAT").then(x=>{
        item_list.value = itemsFromArrayBuffer(x);    
    });
    
    reload();
    server.getDDLFiles(null,null).then(x=>{
        all_animations.value = x.files.map(x=>x.name).filter(x=>x.toUpperCase().endsWith(".MGF"));
        all_sounds.value = x.files.filter(x=>x.group == AssetGroup.SOUNDS).map(x=>x.name);
    })
    StatusBar.registerSaveAndRevert(async ()=>{
    if (spell_list.value) {
        const b = spellsToArrayBuffer(spell_list.value);
        await server.putDDLFile("KOUZLA.DAT", b, AssetGroup.MAPS);
    }
    },()=>{
        reload();
    })
}

function onCreateNew() {
    spell_list.value = new Array(105).fill(0).map((_,idx)=>{
        const def : TKouzlo = {
            accnum :0,
            cil:0,
            flags:0,
            backfire:0,
            povaha:0,
            spellname:"Undefined spell",
            pc:0,
            owner:0,
            teleport_target:0,
            mge:0,
            um:0,
            start: 0,
            script: [],
            num: idx,
            wait: 0,
            delay: 0,

        };
        return def;
    });
}

function onImported() {
    init();
}

const shadow_drag_table = ref<HTMLTableElement|null>(null);
const shadow_drag_content = ref<HTMLElement|null>(null);

onMounted(init);
onUnmounted(StatusBar.onFinalSave);


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
        t.value = `${item_list.value[params[index] as number].jmeno} #${params[index]}`;
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
        current_spell.value.script!.push({
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

watch(spell_list, ()=>StatusBar.setChangedFlag(true),{deep:true});

const ds_spellAnim = create_datalist();
const ds_spellSounds = create_datalist();
const ds_spellItems = create_datalist();
const ds_spellCommands = create_datalist(()=>Object.keys(SpellCommandsArgs).map(k=>({value:k})));

watch(all_animations, (nv)=>ds_spellAnim.update(()=>nv.map(v=>({value:v}))));
watch(all_sounds, (nv)=>ds_spellSounds.update(()=>nv.map(v=>({value:v}))));
watch(item_list, (nv)=>ds_spellItems.update(()=>nv.map((v,id)=>({value:v.jmeno, label:`${v.jmeno} #${id}`}))));



</script>

<template>
    <x-workspace>
        <h1>Rune spells</h1>
        <table class="spell-list">
            <thead>
                <tr><th>Element</th><th>Rune</th><th>Strength</th><th>Name</th><th>Level (Magic)</th><th>Mana cost</th><th>Target type</th><th>Protection</th><th>Group</th><th>Flags</th></tr>
            </thead>
            <tbody>
                <tr v-for="row of (spell_list || []).filter(x=>x.num < 105)" :key="row.num" :class="`element-${Math.floor(row.num/21)}` " @click="current_spell=row">
                    <td v-if="(row.num % 21) == 0" rowspan="21"> {{ ElementTypeName[Math.floor(row.num/21)] }} </td>
                    <td v-if="(row.num % 3) == 0" rowspan="3"> {{ spell_list?spell_list[Math.floor(row.num/3)*3].spellname:"" }} </td>
                    <td class="number"> {{ (row.num % 3)+1 }}</td>
                    <td> {{  row.spellname }}</td>
                    <td class="number"> {{  row.um }}</td>
                    <td class="number"> {{  row.mge }}</td>
                    <td> {{  TargetType[row.cil] }}</td>
                    <td class="number"> {{  ProtectionFlag[row.povaha] }}</td>
                    <td class="number"> {{  row.accnum }} </td>
                    <td> {{  FlagsNames[row.flags] }}</td>
                </tr>                
            </tbody>
        </table>
        <h1>Other spells</h1>
        <table class="spell-list second">
            <thead>
                <tr><th>ID</th><th>Name</th><th>Target type</th><th>Protection</th><th>Group</th><th>Flags</th></tr>
            </thead>
            <tbody>
                <tr v-for="row of (spell_list || []).filter(x=>x.num >= 105)" :key="row.num" @click="current_spell=row">
                    <td class="number">{{ row.num }}</td>
                    <td> {{  row.spellname }}</td>
                    <td> {{  TargetType[row.cil] }}</td>
                    <td class="number"> {{  ProtectionFlag[row.povaha] }}</td>
                    <td class="number"> {{  row.accnum }} </td>
                    <td> {{  FlagsNames[row.flags] }}</td>
                    <td><button @click="spell_list!.splice(spell_list!.findIndex(x=>x.num == row.num),1);$event.stopPropagation()">🞬</button></td>
                </tr>
            </tbody>
        </table>

    </x-workspace>

    <div class="editor" v-if="current_spell">
        <div>
            <x-section>
                <x-section-title>Basic settings</x-section-title>
                <x-form>
                    <label v-if="current_spell.num < 105"><span>Rune</span><div><input type="text" readonly="true" size="4" :value="ElementTypeName[Math.floor(current_spell.num/21)]">
                                <input size="4" type="text" readonly="true" :value="Math.floor((current_spell.num%21)/3)+1">
                                <input size="4"  type="text" readonly="true" :value="(current_spell.num%3)+1"></div></label>
                    <label><span v-if="current_spell.num < 105 && current_spell.num % 3 == 0">Display name</span>
                        <span v-if="current_spell.num > 105 || current_spell.num % 3 != 0">Name (not shown)</span>
                        <input type="text" v-model="current_spell.spellname">
                    </label>
                    <label v-if="current_spell.num < 105"><span>Magic level</span><input type="number" v-model="current_spell.um"></label>
                    <label v-if="current_spell.num < 105"><span>Mana cost</span><input type="number" v-model="current_spell.mge"></label>
                    <label><span>Target / Victim</span><div><select v-model="current_spell.cil">
                            <option v-for="(v,id) of TargetType" :key="id" :value="id">{{  v  }}</option>
                        </select></div>
                    </label>
                    <label><span>Spell group</span><input type="number" v-model="current_spell.accnum"></label>
                    <label><input type="checkbox" v-model="current_spell.povaha" :true-value="1" :false-value="0"><span>Victim defense roll</span></label>
                    <label v-if="current_spell.num < 105"><input type="checkbox" v-model="chk_trackon.TRACKON"><span>Need enemy in front</span></label>
                    <label v-if="current_spell.num < 105"><input type="checkbox" v-model="chk_trackon.TELEPORT"><span>Open map for teleport</span></label>
                </x-form>
            </x-section>
            <x-section>
                <table ref="shadow_drag_table" class="drag-preview" hidden="true">
                    <tbody ref="shadow_drag_content">
                        <tr><td>Drag</td></tr>
                    </tbody>
                </table>
                <x-section-title>Script</x-section-title>            
                <table>
                    <tbody>
                        <tr v-for="(v,id) of (current_spell.script || [])" :key="id" :data-index="id">
                            <td>{{  id }} </td>
                            <td class="grab-handle" @mousedown="$event=>begin_drag($event, id)">≡ {{ v.command }}</td>
                            <td><template v-for="(a, id) of v.args" :key="id">                                                        
                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Number" v-model="v.args[id]" type="number">
                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Percent" v-model="v.args[id]" type="number">
                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.AnimationFile" v-model="v.args[id]" type="text" :list="ds_spellAnim.id">
                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.SoundFile" v-model="v.args[id]" type="text" :list="ds_spellSounds.id">
                                <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Item" 
                                    type="text" :value="`${(item_list && item_list[a as number] && item_list[a as number].jmeno)||'???'} #${a}`" @change="$event=>findItem($event, v.args, id)" :list="ds_spellItems.id">
                                <select v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Element" v-model="v.args[id]" >
                                    <option v-for="(v,id) of ElementTypeName" :key="id" :value="id"> {{ v }}</option>
                                </select>
                                <select v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Stat" v-model="v.args[id]" >
                                    <option v-for="(v,id) of CharacterStatsNames" :key="id" :value="id"> {{ v }}</option>
                                </select>
                                <select v-if="SpellCommandsArgs[v.command][id] == SpellArgument.EffectBit" v-model="v.args[id]" >
                                    <option v-for="(v,id) of SpellEffectName" :key="id" :value="1<<id"> {{ v }}</option>
                                </select>
                            </template></td>
                            <td>
                                <button @click="current_spell!.script!.splice(id,1)">🞬</button></td>
                        </tr>
                        <tr><td> {{ current_spell.script!.length }}</td><td colspan="2"><input type="text" :list="ds_spellCommands.id"
                            @change="$event=>validateCommand($event)" @keydown="$event=>validateCommandEnter($event)"></td></tr>
                    </tbody>
                </table>
            </x-section>
        </div>
        <button class="close" @click="current_spell = undefined"></button>
    </div>


<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />
</template>

<style scoped>

.element-0{background-color: #fca}
.element-1{background-color: #acf}
.element-2{background-color: #ffa}
.element-3{background-color: #aff}
.element-4{background-color: #faf}

table.spell-list tr:hover td {
    background-color: #fff8;
}

table.spell-list tr td {
    cursor: pointer;
}


table.spell-list tr td.number {text-align: center;}

table.spell-list {
    margin-left: 15rem;
}
table.spell-list.second {
    margin-left: 32rem;
}

.editor {
    position: fixed;
    left: 0;
    right: 0;
    top: 10vh;
    bottom: 0;
    width: 30em;
    margin: 0 auto auto 1rem;
    border: 1px solid;
    box-shadow: 3px 3px 5px black;
    padding: 1.5em 0 0.5em 0;
    background-color: #ccc;
    height: fit-content;
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

</style>