<script setup lang="ts">
import MissingFiles from '@/components/MissingFiles.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar from '@/core/status_bar_control';
import { createTHuman, humanDataFromArrayBuffer, HumanWearPlace, HumanWearPlaceName, type THuman } from '@/core/character_structs';
import { PCX, PCXProfile } from '@/core/pcx';
import { itemsFromArrayBuffer, ItemWearPlace, ItemWearPlaceName, type ItemDef } from '@/core/items_struct';
import { CharacterStats, CharacterStatsNames, ElementTypeName, SpellEffectName, SpellEffects } from '@/core/common_defs';
import { useBitmaskCheckbox2 } from '@/core/flags';
import CanvasView from '@/components/CanvasView.vue';

const missing_files : FileItem[] = [
    {name:"POSTAVY.DAT",group:AssetGroup.MAPS,ovr:true},
    {name:"ITEMS.DAT",group:AssetGroup.MAPS,ovr:true},
];

const postavy = ref<THuman[]>([]);
const selected = ref<number>();
const items  = ref<ItemDef[]>([]);
const selected_char = ref<THuman>();
const list_of_xichts = ref<number[]>();
const portraits = ref<HTMLElement[]>([]);
const portrait_cache =new  Map<number, HTMLCanvasElement>();
const preview_items_cache = new Map<number, Promise<PCX> >();
const char_cache = new Map<number, Promise<PCX> >();
const preview_box = ref<HTMLElement>();
let ioblouk :Promise<PCX>|undefined;




const [npcflags, chk_npcflags] = useBitmaskCheckbox2({
    HIDE_INV: 0x1,
    HIDE_GEAR: 0x2
});
const [effects, chk_effects] = useBitmaskCheckbox2(SpellEffects);

watch(selected, ()=>{    
    selected_char.value = postavy.value && selected.value !== undefined ?postavy.value[selected.value]:undefined;
    if (selected_char.value) {
        npcflags.value = selected_char.value.npcflags;
        effects.value = selected_char.value.stats[CharacterStats.VLS_KOUZLA];
    }
});

const PO_XS:number= 194;
const PO_YS:number= 340;
const PO_XSS:number= (PO_XS>>1);
const PO_YSS:number= (PO_YS>>1);

function place_human_item(img: HTMLCanvasElement, x:number,y:number)
  {
    const s = img.style;
    const xp = PO_XSS-img.width/2+x;
    const yp = PO_YS-img.height-y-20;
    s.position = "absolute";
    s.left = `${xp}px`;
    s.top = `${yp}px`;
    s.display = "block";
    s.width = `${img.width}px`;
    s.height = `${img.height}px`;
  }


watch([selected_char,preview_box],()=>{
    if (preview_box.value && selected_char.value) {
        const bx = preview_box.value;
        const ch = selected_char.value;
        if (!ioblouk) {
            ioblouk = server.getDDLFile("IOBLOUK.PCX").then(buff=>PCX.fromArrayBuffer(buff));            
        }        
        let base: Promise<PCX>|undefined;
        if (char_cache.has(ch.xicht)) {
            base = char_cache.get(ch.xicht);
        } else {
            base = server.getDDLFile(`CHAR${ch.xicht.toString(16).toUpperCase().padStart(2,'0')}.PCX`)
                        .then(buff=>PCX.fromArrayBuffer(buff));
            char_cache.set(ch.xicht, base);
        }
        if (base) {
            base.then(async pcx=>{
                try {          
                    const obl = await ioblouk;
                    bx.innerHTML = "";      
                    if (obl) {
                        const c = obl.createCanvas(PCXProfile.default);
                        place_human_item(c,0,-45);
                        bx.appendChild(c);
                    }
                } catch(e) {
                    bx.innerHTML = "";      
                    console.error(e);
                }
                const c = pcx.createCanvas(PCXProfile.transp0);
                place_human_item(c,0,0);
                bx.appendChild(c);
                ch.wearing.forEach((item_ref: number, idx: number)=>{
                    let itmpcx: Promise<PCX>|undefined;
                    const key = item_ref*2+(ch.female?1:0);
                    const item = items.value[item_ref];
                    if (preview_items_cache.has(key)) {
                        itmpcx = preview_items_cache.get(key);
                    } else {
                        const vzhled = ch.female?item.vzhled_on_female:item.vzhled_on_male;
                        if (!vzhled) return;
                        itmpcx = server.getDDLFile(vzhled).then(buff=>PCX.fromArrayBuffer(buff));
                        preview_items_cache.set(key, itmpcx);
                    }
                    if (itmpcx) {
                        itmpcx.then(pcx=>{
                            const c = pcx.createCanvas(PCXProfile.item);
                            const pl = idx == HumanWearPlace.RUKA_L?item.polohy[1]:item.polohy[0];
                            place_human_item(c,pl[0],pl[1]);
                            bx.appendChild(c);
                        });
                    }
                });
            });
        }
    }
},{deep:true})
/*
watch([preview_items, selected_char],()=>{
    if (preview_items.value && selected_char.value && preview_base_canvas.value) {


        preview_items.value.forEach((r,idx)=>{
            const pos = parseInt(r.dataset.pos || "");
            if (pos == undefined || isNaN(pos)) return;
            const elem = r as HTMLElement;
            const item_ref = selected_char.value!.wearing[pos];
            if (!item_ref) return;
            const key = item_ref*2+(selected_char.value!.female?1:0);
            const item = items.value[item_ref];
            const char = selected_char.value!;
            let p: Promise<PCX>;
            if (preview_items_cache.has(key)) {
                p = preview_items_cache.get(key)!;
            } else {                                
                let vzhled_file = char.female?item.vzhled_on_female:item.vzhled_on_male;
                if (!vzhled_file) vzhled_file = item.vzhled_on_ground;
                if (!vzhled_file) return;
                p = server.getDDLFile(vzhled_file).then(x=>PCX.fromArrayBuffer(x));
                preview_items_cache.set(key,p);
            }
            p.then(buff=>{
                if (!preview_base_canvas.value) return;
                const parent = preview_base_canvas.value.parentElement;
                const app_bottom = preview_base_canvas.value.offsetTop + preview_base_canvas.value.offsetHeight;
                const app_top = preview_base_canvas.value.offsetTop;
                const app_center = parent?parent.clientWidth / 2.0:0;
                elem.innerHTML ="";
                const p = pos == HumanWearPlace.RUKA_R?1:0;
                const c= buff.createCanvas(PCXProfile.transp0);
                const x = item.polohy[p][0]+app_center-c.width/2;
                const y = app_bottom - item.polohy[p][1] - c.height;
                c.style.left = `${x}px`;
                c.style.top = `${y}px`;

                elem.appendChild(c);
            });

        });
    }
},{deep:true})
*/

watch([npcflags], ()=>{if (selected_char.value && npcflags.value !== undefined) selected_char.value.npcflags = npcflags.value;});
watch([effects], ()=>{if (selected_char.value && effects.value !== undefined) selected_char.value.stats[CharacterStats.VLS_KOUZLA] = effects.value;});

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
            const f = items.value.findIndex(x=>x.jmeno.trim() == v);
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
        cur_inv_item.value = "";
    }
}

function add_item_to_inv_enter(event: Event) {
    const e = event as KeyboardEvent;
    if (e.key == "Enter") {
        e.stopPropagation();
        e.preventDefault();
        add_item_to_inv(e);
    }
}




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

const  cur_inv_item = ref<string>("");
const portraits_to_select = ref<HTMLElement[]>([]);

async function add_xicht() {
    list_of_xichts.value = 
        (await server.getDDLFiles(AssetGroup.UI,null)).files.filter(x=>x.name.startsWith("XICHT")).map(x=>x.name)
        .map(v =>  parseInt((/XICHT([0-9a-fA-F]+).PCX/.exec(v || '') || ["","0"])[1]))
        .filter(v=>v && postavy.value && postavy.value.findIndex(w=>w.xicht == v) == -1);
}

function add_char(xicht: number){
    const h = createTHuman();
    h.xicht = xicht;
    selected.value = postavy.value.length;
    postavy.value.push(h)
    list_of_xichts.value = undefined;
    
}

const HumanPlaceToWearPlace = [
/*BATOH: 0,*/ ItemWearPlace.PL_BATOH,
/*TELO_H: 1,*/ ItemWearPlace.PL_TELO_H,
/*TELO_D: 2,*/ ItemWearPlace.PL_TELO_L,
/*HLAVA: 3,*/ ItemWearPlace.PL_HLAVA,
/*NOHY: 4,*/ ItemWearPlace.PL_NOHY,
/*KUTNA: 5,*/ ItemWearPlace.PL_KUTNA,
/*KRK: 6,*/ ItemWearPlace.PL_KRK,
/*RUKA_L: 7,*/ ItemWearPlace.PL_RUKA,
/*RUKA_R: 8*/ ItemWearPlace.PL_RUKA,
              ItemWearPlace.PL_PRSTEN

]


</script>

<template>
    <datalist id="charactersItems81"><option v-for="(v,idx) of items" :key="idx" :value="v.jmeno.trim()"></option></datalist>
    <template v-for="pos of ItemWearPlace" :key="pos">
        <datalist :id="`charWearList339-${pos}`"><option v-for="(v,idx) of items.filter(itm=>itm.umisteni == pos)" :key="idx" :value="v.jmeno"></option></datalist>
    </template>
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
        <div @click="add_xicht">
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
                <label><span>Level</span><input type="number" v-model="selected_char.level" min="1" max="40" v-watch-range ></label>
                <label><span>Experience</span><input type="number" v-model="selected_char.exp" min="0" max="999999999" v-watch-range></label>
                <label><input type="checkbox" v-model="chk_npcflags.HIDE_GEAR"><span>Hide gear</span></label>
                <label><input type="checkbox" v-model="chk_npcflags.HIDE_INV"><span>Hide inventory</span></label>
            </x-form>
            <div class="preview-items" ref="preview_box">
            </div>
        </x-section>
        <x-section>
            <x-section-title>Wears</x-section-title>
            <x-form>
                <label v-for="(v,idx) of HumanWearPlaceName" :key="idx"><span>{{ v }}</span>
                    <input type="text" :list="`charWearList339-${HumanPlaceToWearPlace[idx]}`" :value="get_item_name(selected_char.wearing[idx])"
                    @change="$event=>set_item_by_name($event, selected_char!.wearing, idx)"></label>
                <label v-for="idx in [0,1,2,3]" :key="idx"><span>Ring {{ idx }}</span>
                    <input type="text" :list="`charWearList339-${HumanPlaceToWearPlace[9]}`" :value="get_item_name(selected_char.rings[idx])"
                    @change="$event=>set_item_by_name($event, selected_char!.rings, idx)"></label>
                <label><span>Count arrows: </span><input type="number" min="0" max="99" v-watch-range v-model="selected_char.sipy"></label>
                <label><span>Arrow type: </span><input type="number" min="0" max="255" v-watch-range v-model="selected_char.sip_druh" list="arrowTypes160"></label>

                <label><span>Inventory</span><div class="inventory">
                    <div v-for="(v,idx) of selected_char.inv">{{  get_item_name(v) }}<button @click="$event=>delete_item($event, idx)">×</button></div>
                    <div class="input"> {{  cur_inv_item }}
                    <input type="text" v-model="cur_inv_item" list="charactersItems81" placeholder="add item" 
                    @keydown="$event=>add_item_to_inv_enter($event)" @change="$event=>add_item_to_inv($event)">
                    </div>
                </div></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Stats</x-section-title>
            <x-form>
                <label><span>Strength</span><input v-model="selected_char.stats[CharacterStats.VLS_SILA]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Magic</span><input v-model="selected_char.stats[CharacterStats.VLS_SMAGIE]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Speed</span><input v-model="selected_char.stats[CharacterStats.VLS_POHYB]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Dexterity</span><input v-model="selected_char.stats[CharacterStats.VLS_OBRAT]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Max hitpoints</span><input v-model="selected_char.stats[CharacterStats.VLS_MAXHIT]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Max vitality</span><input v-model="selected_char.stats[CharacterStats.VLS_KONDIC]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Max mana</span><input v-model="selected_char.stats[CharacterStats.VLS_MAXMANA]" type="number" v-watch-range min="0" max="32767" /></label>
                <label><span>Attack</span><div><input type="number" v-model="selected_char.stats[CharacterStats.VLS_UTOK_L]" v-watch-range min="0" max="32767"/>-<input type="number" v-model="selected_char.stats[CharacterStats.VLS_UTOK_H]" v-watch-range min="0" max="32767"/></div></label>
                <label><span>Defese</span><div><input type="number" v-model="selected_char.stats[CharacterStats.VLS_OBRAN_L]" v-watch-range min="0" max="32767"/>-<input type="number" v-model="selected_char.stats[CharacterStats.VLS_OBRAN_H]" v-watch-range min="0" max="32767"/></div></label>
                <label><span>Magic attack</span><div><input type="number" v-model="selected_char.stats[CharacterStats.VLS_MGSIL_L]" v-watch-range min="0" max="32767"/>-<input type="number" v-model="selected_char.stats[CharacterStats.VLS_MGSIL_H]" v-watch-range min="0" max="32767"/></div></label>
                <label><span>Magic attack type</span><div><select v-model="selected_char.stats[CharacterStats.VLS_MGZIVEL]">
                    <option value="-1">--select--</option>
                    <option value="0">fire</option>
                    <option value="1">water</option>
                    <option value="2">earth</option>
                    <option value="3">air</option>
                    <option value="4">mind</option>
                </select></div></label>
                <label><span>Extra damage</span><input v-model="selected_char.stats[CharacterStats.VLS_DAMAGE]" type="number" v-watch-range min="-10000" max="10000" /></label>
                <label><span>Protection fire</span><input v-model="selected_char.stats[CharacterStats.VLS_OHEN]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection water</span><input v-model="selected_char.stats[CharacterStats.VLS_VODA]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection earth</span><input v-model="selected_char.stats[CharacterStats.VLS_ZEME]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection air</span><input v-model="selected_char.stats[CharacterStats.VLS_VZDUCH]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection mind</span><input v-model="selected_char.stats[CharacterStats.VLS_MYSL]" type="number" v-watch-range min="-100" max="100" /></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Flags and effects</x-section-title>
            <x-form>
                <label v-for="(v,idx) of Object.keys(SpellEffects)" :key="idx">
                    <input type="checkbox" v-model="(chk_effects as Record<string, boolean>)[v]"> 
                    <span> {{ SpellEffectName[idx] }}</span>
                </label>
            </x-form>
        </x-section>

    </div>
    </x-workspace>
        <div class="list-of-characters" v-if="list_of_xichts">
            <button class="close" @click="list_of_xichts=undefined"></button>
        <div class="lst">
            <div v-for="v of list_of_xichts" :key="v" @click="add_char(v)">
                <div class="portrait" :data="v" ref="portraits" :data-xicht="v">
                </div>
            </div>
        </div>
        <div class="help">
        <p>To add a new character, choose any two random numbers or letters between A and F, then upload two files using the <RouterLink to="/assets">Assets Manager</RouterLink>:
            CHAR??.PCX and XICHT??.PCX, where ?? are your chosen characters.            
        </p>
        <p class="note">
            For example, CHAR1D.PCX and XICHT1D.PCX. These files contain the character's body and portrait images.
        </p>
        <dl>
        <dt>CHAR??.PCX</dt>
        <dd>Whole character's body as shown in inventory (up to 190x300)</dd>
        <dt>XICHT??.PCX</dt>
        <dd>Four variants of portraits* image 54x300  (54x75 for each)<br>
            <br>
            <span class="note">* The name xicht is a phonetic transcription of the Czech word ksich, which is a dirty word means a face.</span>
        </dd>
        </dl>
        </div>
    </div>


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


.inventory> div {
    display: inline-block;
    border: 1px solid;
    padding: 0.2rem;
    margin-left: 0.2rem;
    vertical-align: top;
}

.inventory> div > button {
    margin-left: 0.2rem;
}

.left-text {
    text-align: left;
}

.main-panel {
    display:flex;
    flex-wrap: wrap;
}
.main-panel > *{ 
    width: 20rem;
}

input[type=number] {
    width: 5rem;
    text-align: center;
}

.inventory .input {
    position: relative;
    height: 1.5rem;    
    min-width: 6rem;
}

.inventory .input::before {
    content: "";
    width: 2rem;
    display: inline-block;
}

.inventory .input input {
    position: absolute;
    left:0;top:0;right: 0;bottom: 0;
}

.list-of-characters {
    position: fixed;
    left:0;
    right: 0;
    width: 60%;
    top: 15%;
    margin: auto;
    background-color: #ddd;
    padding: 2rem 1rem 1rem 1rem;
    border: 1px solid;
    box-shadow: 3px 3px 5px black;
}

.list-of-characters > div.lst  {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 5px;    
}

.list-of-characters > div.lst > div {
    cursor: pointer;
}

.note {
    font-size: 0.8rem;
    font-style: italic;
}

.preview-items {
    position: relative;
    text-align: center;
    height: 360px;
    width: 195px;
    overflow: hidden;
    margin: auto;
}

</style>