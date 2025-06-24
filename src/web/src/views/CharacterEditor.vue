<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar from '@/core/status_bar_control';
import { humanDataFromArrayBuffer, HumanWearPlace, HumanWearPlaceName, type THuman } from '@/core/character_structs';
import { PCX, PCXProfile } from '@/core/pcx';
import { itemsFromArrayBuffer, type ItemDef } from '@/core/items_struct';
import { CharacterStats, CharacterStatsNames, ElementTypeName, SpellEffectName } from '@/core/common_defs';
import { useBitmaskCheckbox2 } from '@/core/flags';

const missing_files : FileItem[] = [
    {name:"POSTAVY.DAT",group:AssetGroup.MAPS,ovr:true},
    {name:"ITEMS.DAT",group:AssetGroup.MAPS,ovr:true},
];

const postavy = ref<THuman[]>([]);
const selected = ref<number>();
const items  = ref<ItemDef[]>([]);
const selected_char = ref<THuman>();


const [npcflags, chk_npcflags] = useBitmaskCheckbox2({
    HIDE_INV: 0x1,
    HIDE_GEAR: 0x2
});

watch(selected, ()=>{    
    selected_char.value = postavy.value && selected.value !== undefined ?postavy.value[selected.value]:undefined;
    if (selected_char.value) npcflags.value = selected_char.value.npcflags;
});

watch([npcflags], ()=>{if (selected_char.value && npcflags.value !== undefined) selected_char.value.npcflags = npcflags.value;});

function init() {
    function reload() {
        server.getDDLFile("POSTAVY.DAT").then(buff=>{
            postavy.value = humanDataFromArrayBuffer(buff).characters;            
            console.log(postavy.value);
            nextTick(()=>StatusBar.setChangedFlag(false));
        })
    }
    
    StatusBar.registerSaveAndRevert(()=>{
        console.log("save");
    }, () => {
        selected.value = undefined;
        reload();
    });
    reload();
    server.getDDLFile("ITEMS.DAT").then(buff=>{
        items.value = itemsFromArrayBuffer(buff);
        
    });
}

onMounted(init);
onUnmounted(StatusBar.onFinalSave);

function get_item_name(idx: number) : string{
    if (idx === undefined) return "";
    if (items.value) {
        const v = items.value[idx];
        if (v) return v.jmeno;                
        else return `#${idx}`;
    } else {
        return "???";
    }

}

function set_item_by_name(event: Event, arr:number[], pos:number) {
    const t = event.target as HTMLInputElement;
    const v = t.value.trim();            
    if (v) {
        if (v.startsWith('#')) {
            const n = parseInt(v.substring(1));
            if (n!== undefined && !isNaN(n)) {
                arr[pos] = n;
                t.value = get_item_name(n);
                return 
            }
        } else {
            const f = items.value.findIndex(x=>x.jmeno == v);
            if (f != -1) {
                arr[pos] = f;
                t.value = get_item_name(f);
                return;
            }
        }
    } else {
        delete arr[pos];
    }
    t.value = get_item_name(arr[pos]);
}

const inventory = HumanWearPlaceName.map((_,idx)=>{
    return computed({
        get:() =>{
            if (selected_char.value && items.value) {
                const c = selected_char.value;
                const v = items.value[c.wearing[idx]];
                if (v) return v.jmeno;                
                else return `#${c.wearing[idx]}`;
            } else {
                return "???";
            }
        },
        set:(value:string) => {
        }
    })
})

function add_item_to_inv(event: Event) {
    const c : number[] = [];
    set_item_by_name(event,c,0);
    if (c[0] && selected_char.value) {
        selected_char.value.inv.push(c[0]);
        (event.target as HTMLInputElement).value="";
    }
}

const portraits = ref<HTMLElement[]>([]);
const portrait_cache =new  Map<number, HTMLCanvasElement>();


function reload_portraits() {
    if (portraits.value) {
        portraits.value.forEach(async (el:HTMLElement)=>{
            const sx = el.dataset.xicht;
            if (!sx) return;
            const xicht = parseInt(sx);
            if (xicht ===undefined || isNaN(xicht)) return;
            let canvas : HTMLCanvasElement| null= null;
            if (!portrait_cache.has(xicht)) {

                try {
                    const img = PCX.fromArrayBuffer(await server.getDDLFile(`XICHT${xicht.toString(16).toUpperCase().padStart(2, '0')}.PCX`));
                    canvas = img.createCanvas(PCXProfile.default);
                    portrait_cache.set(xicht, canvas);
                } catch (e) {
                    return;
                }

            } else {
                canvas = portrait_cache.get(xicht) as HTMLCanvasElement;
            }
            el.innerHTML = '';
            el.appendChild(canvas)
        })
    }
}

function delete_item(event: Event, idx: number) {
    if (selected_char.value) {
        selected_char.value.inv.splice(idx,1);
        event.stopPropagation();
        event.preventDefault();
    }
}

watch(portraits, reload_portraits,{deep:true});
watch(postavy,()=>{StatusBar.setChangedFlag(true);},{deep:true});



</script>

<template>
    <datalist id="charactersItems81"><option v-for="(v,idx) of items" :key="idx" :value="v.jmeno"></option></datalist>
    <datalist id="arrowTypes160"><option v-for="(v,idx) of items.filter(x=>x.druh_sipu)" :key="idx" :value="v.druh_sipu"> {{ v.jmeno}}</option></datalist>
    <x-workspace>
    <div class="top-panel">
        <div v-for="(p,idx) of postavy" :key="idx" @click="selected = idx" :class="{selected: selected == idx}">
            <div class="portrait" :data-xicht="p.xicht" ref="portraits">

            </div>
            <div class="desc">
                {{ p.jmeno }}
            </div>          
        </div>
        <div>
            <div class="portrait add" >

            </div>
            <div>
                ...
            </div>
        </div>
    </div>
    <div class="main-panel" v-if="selected_char">
        <x-section>
            <x-section-title>Basic info</x-section-title>
            <x-form>
                <label><span>Name</span><input type="text" v-model="selected_char.jmeno"></label>
                <label><span>Gender</span><div><span><input v-model="selected_char.female" type="radio" :value="false" />Male</span>
                                            <span><input v-model="selected_char.female" type="radio" :value="true" />Female</span></div></label>
                <label><span>Level</span><input type="number" v-model="selected_char.level" ></label>
                <label><span>Experience</span><input type="number" v-model="selected_char.exp" ></label>
                <label><input type="checkbox" v-model="chk_npcflags.HIDE_GEAR"><span>Hide gear</span></label>
                <label><input type="checkbox" v-model="chk_npcflags.HIDE_INV"><span>Hide inventory</span></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Wears</x-section-title>
            <x-form>
                <label v-for="(v,idx) of HumanWearPlaceName" :key="idx"><span>{{ v }}</span>
                    <input type="text" list="charactersItems81" :value="get_item_name(selected_char.wearing[idx])"
                    @change="$event=>set_item_by_name($event, selected_char!.wearing, idx)"></label>
                <label v-for="idx in [0,1,2,3]" :key="idx"><span>Ring {{ idx }}</span>
                    <input type="text" list="charactersItems81" :value="get_item_name(selected_char.rings[idx])"
                    @change="$event=>set_item_by_name($event, selected_char!.wearing, idx)"></label>
                <label><span>Count arrows: </span><input type="number" min="0" max="99" v-model="selected_char.sipy"></label>
                <label><span>Arrow type: </span><input type="number" min="0" max="99" v-model="selected_char.sip_druh" list="arrowTypes160"></label>

                <label><span>Inventory</span><div class="inventory">
                    <div v-for="(v,idx) of selected_char.inv">{{  get_item_name(v) }}<button @click="$event=>delete_item($event, idx)">X</button></div>
                    <input type="text"  list="charactersItems81" placeholder="add item" @change="$event=>add_item_to_inv($event)">
                </div></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Stats</x-section-title>
            <x-form>
                <template v-for="(v,idx) of CharacterStatsNames" :key="idx">
                    <label v-if="idx < 23"><span>{{ v }}</span><div v-if="idx == CharacterStats.VLS_MGZIVEL">
                        <select  v-model="selected_char.stare_vls[idx]">
                            <option v-for="(v,idx) of ElementTypeName" :key="idx" :value="idx"> {{ v }}</option>
                        </select></div>
                <input v-if="idx != CharacterStats.VLS_MGZIVEL" type="number" v-model="selected_char.stare_vls[idx]" min="0" max="32767" v-watch-range />
                </label></template>                
            </x-form>                    
            <x-section>
                <x-form>
                    <x-section-title>Flags and effects</x-section-title>
                    <label v-for="(v,idx) of SpellEffectName" :key="idx">
                        <input type="checkbox" :checked="!!(selected_char.stare_vls[CharacterStats.VLS_KOUZLA] & (1 << idx))">
                        <span> {{ v }}</span>
                    </label>
                </x-form>
            </x-section>
        </x-section>

    </div>
    </x-workspace>


<MissingFiles :files="missing_files"></MissingFiles>

</template>

<style lang="css" scoped>

.portrait {
    height: 75px;
    width: 54px;
    box-sizing: border-box;
    overflow: hidden;
    display: inline-block;
    line-height: 75px;
}
.portrait.add::before {
    content: "+";
    display: inline-block;
    vertical-align: middle;
    font-size: 45px;
    line-height: 45px;
    background-color: green;
    color: #ddd;
    width: 45px;
    height: 45px;
    border-radius: 45px;
}
.top-panel {
    display: flex;
    padding: 0.5rem;
    justify-content: space-evenly;
    text-align: center;
    border-bottom: 1px solid;

}
.top-panel > div {
    cursor: pointer;
    border: 1px solid;
    padding: 0.5rem;
    background-color: rgb(247, 238, 224);

}
.top-panel > div:hover {
    background-color: #ffffff;
}

.top-panel > div.selected {
    background-color: rgb(69, 81, 148);
    color: white;
}

.inventory {
    text-align: left;
}

.inventory > input {
    font-size: 1rem;
}

.inventory> div {
    display: inline-block;
    border: 1px solid;
    padding: 0.2rem;
    margin-left: 0.2rem;
}

.inventory> div > button {
    margin-left: 0.2rem;
}

.left-text {
    text-align: left;
}

</style>