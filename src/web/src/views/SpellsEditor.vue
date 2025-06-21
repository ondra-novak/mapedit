<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { CharacterStatsNames, ElementTypeName, SpellEffectName } from '@/core/common_defs';
import { useBitmaskCheckbox2 } from '@/core/flags';
import { ItemDef, itemsFromArrayBuffer } from '@/core/items_struct';
import { spellsFromArrayBuffer, SpellCommandsArgs ,type TKouzlo, SpellArgument } from '@/core/spell_structs';
import { computed, onMounted, ref } from 'vue';

const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"KOUZLA.DAT",ovr:true}
];

const spell_list = ref<TKouzlo[]>();
const current_spell = ref<TKouzlo>();

const item_list = ref<ItemDef[]>();
const all_sounds = ref<string[]>();
const all_animations = ref<string[]>();

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
    server.getDDLFile("KOUZLA.DAT").then(x=>{
        spell_list.value = spellsFromArrayBuffer(x);
    });
    server.getDDLFile("ITEMS.DAT").then(x=>{
        item_list.value = itemsFromArrayBuffer(x);
    })
    server.getDDLFiles(null,null).then(x=>{
        all_animations.value = x.files.map(x=>x.name).filter(x=>x.toUpperCase().endsWith(".MGF"));
        all_sounds.value = x.files.filter(x=>x.group == AssetGroup.SOUNDS).map(x=>x.name);
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

onMounted(init);


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



</script>

<template>
    <datalist id="spellEditorAnim91"><option v-for="v in all_animations" :key="v" :value="v"></option></datalist>
    <datalist id="spellEditorSounds92"><option v-for="v in all_sounds" :key="v" :value="v"></option></datalist>
    <datalist id="spellEditorItems93"><option v-for="(v,id) in item_list" :key="v.jmeno" :value="`${v.jmeno} #${id}`"></option></datalist>    
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
        <table>
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
                </tr>
            </tbody>
        </table>

    </x-workspace>

    <div class="editor" v-if="current_spell">
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
                <label><span>Target / Victim</span><select v-model="current_spell.cil">
                        <option v-for="(v,id) of TargetType" :key="id" :value="id">{{  v  }}</option>
                    </select>
                </label>
                <label><span>Spell group</span><input type="number" v-model="current_spell.accnum"></label>
                <label><input type="checkbox" v-model="current_spell.povaha" :true-value="1" :false-value="0"><span>Victim defense roll</span></label>
                <label v-if="current_spell.num < 105"><input type="checkbox" v-model="chk_trackon.TRACKON"><span>Need enemy in front</span></label>
                <label v-if="current_spell.num < 105"><input type="checkbox" v-model="chk_trackon.TELEPORT"><span>Open map for teleport</span></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Script</x-section-title>
            <table>
                <tbody>
                    <tr v-for="(v,id) of (current_spell.script || [])" :key="id">
                        <td>{{  id }} </td>
                        <td>{{ v.command }}</td>
                        <td><template v-for="(a, id) of v.args" :key="id">                                                        
                            <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Number" v-model="v.args[id]" type="number">
                            <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.AnimationFile" v-model="v.args[id]" type="text" list="spellEditorAnim91">
                            <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.SoundFile" v-model="v.args[id]" type="text" list="spellEditorSounds92">
                            <input v-if="SpellCommandsArgs[v.command][id] == SpellArgument.Item" 
                                type="text" :value="`${item_list![a as number].jmeno} #${a}`" @change="$event=>findItem($event, v.args, id)" list="spellEditorItems93">
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
                        <td><button>+</button><button>^</button><button>v</button><button>x</button></td>
                    </tr>
                </tbody>
            </table>
            <button>Add command</button>
        </x-section>
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

.editor {
    position: sticky;
    left: 0;
    right: 0;
    top: 20vh;
    width: 30em;
    margin: auto;
    border: 1px solid;
    box-shadow: 3px 3px 5px black;
    
    background-color: #ccc;
}

.editor table {
    width: 100%;
    border-collapse: collapse;
}

.editor table input[type=number] {
    width: 3rem;
    text-align: center;
}
.editor table input[type=text] {
    width: 10rem;
    text-align: center;
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

</style>