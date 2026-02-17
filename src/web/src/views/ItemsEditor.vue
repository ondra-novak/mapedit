<script setup lang="ts">
import { server,} from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, nextTick, onMounted, onUnmounted,  ref, shallowRef, watch} from 'vue';
import { ItemDef, ItemHive, itemsFromArrayBuffer, itemsToArrayBuffers, ItemType, ItemTypeName, ItemWearPlace, ItemWearPlaceName, WeaponTypeName } from '@/core/items_struct';
import CanvasView from '@/components/CanvasView.vue';
import { PCX, PCXProfile, type PCXProfileType } from '@/core/pcx';
import { loadAllIcons } from '@/core/IconLIB';
import { CharacterStats, ElementType, ElementTypeName } from '@/core/common_defs';
import StatusBar, { type SaveRevertControl } from '@/components/statusBar'
import { create_datalist } from '@/utils/datalist';
import { getDDLFileWithImport } from '@/components/tools/missingFiles';
import BitCheckbox from '@/components/BitCheckbox.vue';
import AbilitySheet from '@/components/AbilitySheet.vue';
import EffectSheet from '@/components/EffectSheet.vue';
import { spellsFromArrayBuffer } from '@/core/spell_structs';
import DelayLoadedList from '@/components/DelayLoadedList.vue';
import getGlobalDialogs from '@/utils/global_dialog_list';

const selected_item = ref<number|null>(null);

const item_list = ref(new ItemHive());
const filter_kind = ref<number>(-1);
const filter_search = ref<string>("");
const appearence = shallowRef<PCX>();
const preview_canvas = ref<HTMLCanvasElement|null>(null);
const change_icon_model = ref<number>();

const allIcons = shallowRef<PCX[]>([]);
const allImagesList = shallowRef<string[]>([]);
const allSoundsList = shallowRef<string[]>([]);
const allAnimationsList = shallowRef<string[]>([]);

const left_hand_place = ref<HTMLCanvasElement|null>(null);
const right_hand_place = ref<HTMLCanvasElement|null>(null);
let save_state: SaveRevertControl;


function reload() {
    getDDLFileWithImport(server,"ITEMS.DAT", AssetGroup.MAPS).then(x=>{
        item_list.value = x?itemsFromArrayBuffer(x):new ItemHive;
        selected_item.value = null;
        nextTick(()=>save_state.set_changed(false));
    });
}

function init() {
    server.getDDLFile("CHAR00.PCX").then(x=>{
        const pcx = PCX.fromArrayBuffer(x)    
        preview_canvas.value = pcx.createCanvas(PCXProfile.transp0);
    });
    server.getDDLFiles(AssetGroup.ITEMS,null).then(x=>{
        allImagesList.value = x.files.filter(x=>x.name.toUpperCase().endsWith(".PCX")).map(x=>x.name);
        allAnimationsList.value = x.files.filter(x=>x.name.toUpperCase().endsWith(".MGF")).map(x=>x.name);
    });
    server.getDDLFiles(AssetGroup.SOUNDS,null).then(x=>{
        allSoundsList.value = x.files.map(x=>x.name);
    });
    loadAllIcons((name:string)=>server.getDDLFile(name)).then(x=>{
        allIcons.value = x ;
    });
    reg_save();
    reload()
}

function reg_save() {
    StatusBar.register_save_control().then(st=>{
        save_state = st;
        st.on_save(save);
        st.on_revert(reload);
    })

}


async function deleteItem() {
    const sel = selected_item.value
    if (sel !== null && item_list.value) {
        const lst = item_list.value;
        if (confirm("Are you sure delete item: " + lst.get(sel).jmeno)) {
            lst.remove(sel);
            selected_item.value = null;
        }        
    }
}
function addItem() {
    const new_item = new ItemDef;
    const cloned = selected_item.value?item_list.value.get(selected_item.value):null;
    if (cloned) Object.assign(new_item, JSON.parse(JSON.stringify(cloned)));
    new_item.jmeno = "New item"
    selected_item.value = item_list.value.add(new_item);
}

const filteredAndSortedItems = computed(() => {

    const f = filter_search.value?filter_search.value.toLocaleLowerCase():undefined;

    const mp =  
    item_list.value.map((x,idx) : [ItemDef, number]=>{return [x, idx];} )
        .filter(x=>x[0].jmeno.length>0)
        .filter(x=>(!filter_kind.value === undefined|| filter_kind.value<0 || filter_kind.value == x[0].druh)
                && (!f ||  x[0].jmeno.toLocaleLowerCase().indexOf(f) != -1 || x[0].popis.toLocaleLowerCase().indexOf(f) != -1
                ))
        ;
    const srt = mp.sort((a,b)=>{
                    return (a[0].druh - b[0].druh )||  (a[0].jmeno.localeCompare(b[0].jmeno));
                });
    const res = [];
    for (const itm of srt) {
        if (res.length == 0 || res[res.length-1].cat != itm[0].druh) {
            res.push({cat:itm[0].druh, items:[itm]});
        } else{
            res[res.length-1].items.push(itm);
        }
    }    
    return res;

});


function itemCanvas( type: PCXProfileType, item?: PCX, shiftup?:number) {
    if (item) {
        const c = item.createCanvas(type);
        c.style.margin="auto";
        if (shiftup && shiftup != 255) c.style.transform=`translateY(${shiftup}px)`;
        return c;
    }
    return null;
}

function decorateElement<T extends HTMLElement>(htmlElement: T | null, props: Record<string, any>): T | null {
    if (!htmlElement) return htmlElement;
    for (let v in props) {
        htmlElement.setAttribute(v, props[v]);
    }
    return htmlElement;
}

function change_icon() {
    if (selected_item.value!== null && item_list.value) {
        change_icon_model.value = -1;
    }
}

function onSelectIcon() {
    if (change_icon_model.value!== undefined && change_icon_model.value!== -1 && selected_item.value !== null && item_list.value) {
        form.value.ikona = change_icon_model.value;
        change_icon_model.value = undefined;
        
    }
}


const key_mode = ref<number>(0);


const form = computed<ItemDef>(()=>selected_item.value?item_list.value.get(selected_item.value):new ItemDef);



function recalc_place_preview() {
    if (preview_canvas.value) {
        const parent = preview_canvas.value.parentElement;
        const app_bottom = preview_canvas.value.offsetTop + preview_canvas.value.offsetHeight;
//        const app_top = preview_canvas.value.offsetTop;
        const app_center = parent?parent.clientWidth / 2.0:0;
        [left_hand_place,right_hand_place].forEach((place,idx) => {
            if (place.value) {
                const c= place.value;
                const x = form.value.polohy[idx][0]+app_center-c.width/2;
                const y = app_bottom - form.value.polohy[idx][1] - c.height;
                c.style.left = `${x}px`;
                c.style.top = `${y}px`;
            }
        })
    }
}

watch(selected_item, recalc_place_preview);

watch(()=>form.value.vzhled_on_ground,()=>{
    if (form.value.vzhled_on_ground) {
        server.getDDLFile(form.value.vzhled_on_ground).then(x=>{
            appearence.value = PCX.fromArrayBuffer(x);
        })
    } else {
        appearence.value = undefined;
    }
})

watch(()=>form.value.vzhled_on_male,()=>{
    if (form.value.vzhled_on_male) {
        server.getDDLFile(form.value.vzhled_on_male).then(x=>{
            const pcx = PCX.fromArrayBuffer(x);
            const single = form.value.umisteni != ItemWearPlace.PL_RUKA && form.value.umisteni != ItemWearPlace.PL_OBOUR;
            [left_hand_place, right_hand_place].forEach((h,idx)=>{
                if (single && idx == 1) {
                    h.value = null;
                } else {
                    const c = pcx.createCanvas(PCXProfile.item);    ;
                    c.style.position = "absolute";
                    c.style.display = "block";
                    c.style.width = `${c.width}px`;
                    c.style.height = `${c.height}px`;
                    if (h.value) {
                        c.style.left = h.value.style.left;
                        c.style.top = h.value.style.top;
                    }
                    h.value = c;
                }
            });
            recalc_place_preview();
        });
    } else {
        [left_hand_place, right_hand_place].forEach((h,idx)=>{
            h.value = null;
        });
    }
})

watch(()=>form.value.polohy,()=>{
    recalc_place_preview();

},{deep:true});

watch([change_icon_model], onSelectIcon)

const runeList = Object.values(ElementType).reduce((a:Record<string, string>,b)=>{
    for (let i = 0; i < 7; ++i) {

        a[b*10+i] = `${ElementTypeName[b]} / Rune ${i+1}`;
    }
    return a;
},{})

const allKeys = computed(() : {idx:number,id:number, name:string}[] =>{
    if (item_list.value) {
        return item_list.value.map((item, idx)=>{
            return {idx:idx, id:item.keynum, name:item.jmeno};
        }).filter(x=>x.name.length && x.id>0 && x.idx != selected_item.value)
    } else {
        return [];
    }
})
const allArrows = computed(() : {idx:number,id:number|null, name:string}[] =>{
    if (item_list.value) {
        return item_list.value.map((item, idx)=>{
            return {idx:idx, id:item.umisteni == ItemWearPlace.PL_SIP?item.druh_sipu:null, name:item.jmeno};
        }).filter(x=>x.name.length && x.id !== null && x.idx != selected_item.value)
    } else {
        return [];
    }
})

const negative_keylock_id=computed({
    get:()=>-form.value.keynum,
    set:(n:number)=>form.value.keynum=-n,
});


function save() {
    if (item_list.value) {
        const buff = itemsToArrayBuffers(item_list.value as ItemHive);
        server.putDDLFile("ITEMS.DAT",buff, AssetGroup.MAPS);
    }
}

onMounted(init);
onUnmounted(()=>save_state.unmount());

const ds_graphics = create_datalist();
const ds_sounds = create_datalist();
const ds_animations = create_datalist();
const ds_keys = create_datalist();
const ds_arrows = create_datalist();
watch(allImagesList, ()=>ds_graphics.update(()=>allImagesList.value.map(x=>({value:x}))));
watch(allSoundsList, ()=>ds_sounds.update(()=>allSoundsList.value.map(x=>({value:x}))));
watch(allAnimationsList, ()=>ds_animations.update(()=>allAnimationsList.value.map(x=>({value:x}))));
watch(allKeys, ()=>ds_keys.update(()=>allKeys.value.map(x=>({value:x.id.toString(),label:x.name}))));
watch(allArrows, ()=>ds_arrows.update(()=>allArrows.value.map(x=>({value:x.id?.toString() || "0",label:x.name}))));

const change_icon_popup = ref<HTMLDialogElement>();

watch(change_icon_popup, ()=>{
    if (change_icon_popup.value) {
        change_icon_popup.value.showModal();
    }
})


async function load_spells() {
    const out : {value:number, label:string}[] = [{value:0,label:"(none)"}];
    try {   
        const spls = spellsFromArrayBuffer(await server.getDDLFile("KOUZLA.DAT"));
        spls.forEach((x,idx)=>idx?out.push({value:idx, label:x.spellname}):0);
    } catch (e) {
    }
    return out;
}
async function load_dialogs() {
    return (await getGlobalDialogs()).map(x=>({value:x[0],label:x[1]}));
}
    
watch(item_list, ()=>{if (save_state) save_state.set_changed(true)}, {deep:true});
</script>
<template>
    <x-workspace>

    <div class="left-panel">
        <div class="filter">
            <select v-model="filter_kind">
            <option value="-1">-- all --</option>
            <option v-for="(v,idx) in ItemTypeName" :key="idx" :value="idx">{{ v }}</option>
            </select>
            <input type="search" v-model="filter_search">
        </div>
        <select v-model="selected_item" size="20" class="item-list">
            <optgroup v-for="e of filteredAndSortedItems" :key="e.cat" :label="ItemTypeName[e.cat]">
                <option v-for="i of e.items" :value="i[1]"> {{ i[0].jmeno }}</option>
            </optgroup>
        </select>
        <div class="buttons">
            <button @click="deleteItem">Delete</button>
            <button @click="addItem">New / Clone</button>
        </div>
    </div>

    <div class="editor-bgr">
    <div class="editor" v-if="selected_item !== null">
        <x-section>
            <x-section-title>Basic parameters (ID: {{ selected_item }})</x-section-title>
            <x-form>
                <label><span>Name</span><input type="text" maxlength="31" v-model="form.jmeno"/></label>
                <label><span>Description</span><input type="text" maxlength="31" v-model="form.popis"/></label>
                <label><span>Icon</span>
                    <div class="icon" @click="change_icon">
                    <CanvasView :canvas="allIcons?allIcons[form.ikona].createCanvas(PCXProfile.transp0):null" /></div></label>
                <label><span>Kind</span><select v-model="form.druh">
                    <option v-for="(n, v) of ItemTypeName" :key="v" :value="v"> {{ n }}</option>                
                </select></label>
                <label v-if="form.druh == ItemType.TYP_SPECIALNI"><span>Special function</span><select v-model="form.user_value">
                    <option value="0">--- select ---</option>
                    <option value="1">Enable water breath</option>
                    <option value="2">Flute</option>
                </select></label>
                <label v-if="form.druh == ItemType.TYP_RUNA"><span>Rune</span><select v-model="form.user_value">
                    <option v-for="(n,i) of runeList" :key="i" :value="i">{{ n  }}</option>
                </select></label>
                <label v-if="form.druh == ItemType.TYP_DLGPICK || form.druh == ItemType.TYP_DLGUSE"><span>Dialog</span>
                    <DelayLoadedList v-model="form.user_value" :list="load_dialogs()" />
                </label>
                <label v-if="form.druh == ItemType.TYP_JIDLO || form.druh == ItemType.TYP_VODA"><span>Hours</span><input type="number"  v-model="form.user_value" v-watch-range min="1" max="9999"/></label>
                <label v-if="form.druh == ItemType.TYP_SVITXT"><span>Book page</span><input type="number"  v-model="form.user_value" v-watch-range min="0" max="9999"/></label>
                <label v-if="form.druh == ItemType.TYP_VRHACI"><span>Split on destroy</span><input type="number"  v-model="form.user_value" v-watch-range min="0" max="4"/></label>
                <label><span>Wear on</span><select  v-model="form.umisteni">
                    <option v-for="(n, v) of ItemWearPlaceName" :key="v" :value="v"> {{  n }}</option>
                </select></label>
                <label v-if="form.umisteni == ItemWearPlace.PL_SIP"><span>Arrow type</span><input type="number" :list="ds_arrows.id" v-model="form.druh_sipu" v-watch-range min="0" max="255"/></label>
                <label v-if="form.umisteni == ItemWearPlace.PL_SIP"><span>Count arrows</span><input type="number"  v-model="form.user_value" v-watch-range min="0" max="99"/></label>
                <label v-if="form.umisteni == ItemType.TYP_UTOC || form.umisteni == ItemType.TYP_STRELNA || form.umisteni == ItemType.TYP_VRHACI" ><span>Weapon type</span><select  v-model="form.typ_zbrane">
                    <option v-for="(n, v) of WeaponTypeName" :key="v" :value="v"> {{  n }}</option>
                </select></label>
                <label><span>Weight</span><input type="number"  v-model="form.hmotnost" v-watch-range min="0" max="20000"/></label>
                <label><span>Price</span><input type="number"   v-model="form.cena" v-watch-range min="0" max="99999"/></label>
                <template v-if="form.druh == ItemType.TYP_VRHACI || form.druh == ItemType.TYP_VODA || form.druh == ItemType.TYP_JIDLO || form.druh == ItemType.TYP_LEKTVAR || form.druh == ItemType.TYP_UTOC|| form.druh == ItemType.TYP_SVITEK">
                    <label><span>Cast spell: 
                        <template v-if="form.druh == ItemType.TYP_SVITEK">
                            (charges: <input type="number" v-model="form.magie" v-watch-range min="0" max="20000">)
                        </template>
                        <template v-if="form.druh == ItemType.TYP_UTOC">
                            (prob <input type="number" v-model="form.magie"  v-watch-range min="0" max="100">%)
                        </template>
                        <template v-if="form.druh != ItemType.TYP_UTOC && form.druh != ItemType.TYP_SVITEK && form.druh != ItemType.TYP_LEKTVAR">
                            <input type="checkbox" :checked="form.magie > 0" @change="form.magie=($event.target as HTMLInputElement).checked?1:0"> enabled 
                        </template>
                    </span><DelayLoadedList v-model="form.spell" :list="load_spells()" class="spells"/></label>
                </template>
                <label  v-if="form.umisteni == ItemWearPlace.PL_BATOH"><span>Capacity</span><input type="number" v-watch-range min="1" max="24" v-model="form.nosnost"/></label>
                <label><BitCheckbox v-model="form.flags" :mask="0x1"/><span>Destroy on impact</span></label>
                <label><BitCheckbox v-model="form.flags" :mask="0x2"/><span>Destroy when removed</span></label>
                <label><span>Acts as Key</span><div><select v-model="key_mode">
                    <option :value=0>Disabled</option>
                    <option :value=1>Enabled</option>
                    <option :value=-1>Picklock</option>
                </select></div></label>
                <label v-if="key_mode == 1"><span>Lock/Key reference ID</span><input type="number"   v-model="form.keynum" :list="ds_keys.id"/></label>                    
                <label v-if="key_mode == -1"><span>Picklock bonus</span><input type="number"   v-model="negative_keylock_id"/></label>                    
            </x-form>
        </x-section>
        <div class="multi">
            <x-section>
                <x-section-title>Assets</x-section-title>
                <x-form>
                    <label><span>On ground</span><input :list="ds_graphics.id" v-model="form.vzhled_on_ground"/></label>
                    <label><span>On male</span><input :list="ds_graphics.id" v-model="form.vzhled_on_male" /></label>
                    <label><span>On female</span><input :list="ds_graphics.id" v-model="form.vzhled_on_female" /></label>
                    <label><span>Sound on impact</span><input :list="ds_sounds.id" v-model="form.sound_file"/></label>
                    <template v-if="(form.druh == ItemType.TYP_UTOC || form.druh == ItemType.TYP_STRELNA || form.druh == ItemType.TYP_VRHACI) && (form.umisteni == ItemWearPlace.PL_RUKA || form.umisteni == ItemWearPlace.PL_OBOUR)">
                    <label><span>Wpn. anim.</span><input :list="ds_animations.id"  v-model="form.weapon_animation_file"/></label>                
                    <label><span>Hit frame</span><input type="number" v-watch-range min="0" max="100" v-model="form.hitpos"></label>
                    </template>
                </x-form>
            </x-section>
            <x-section>
                <x-form>
                    <x-section-title>Wear conditions</x-section-title>
                    <label><span>Min strenght</span><input type="number" v-model="form.podminky[CharacterStats.VLS_SILA]" v-watch-range min="0" max="100"/></label>
                    <label><span>Min magic</span><input type="number" v-model="form.podminky[CharacterStats.VLS_SMAGIE]" v-watch-range min="0" max="100"/></label>
                    <label><span>Min dexterity</span><input type="number" v-model="form.podminky[CharacterStats.VLS_OBRAT]" v-watch-range min="0" max="100"/></label>
                    <label><span>Min speed</span><input type="number" v-model="form.podminky[CharacterStats.VLS_POHYB]" v-watch-range min="0" max="100"/></label>
                </x-form>
            </x-section>
        </div>
        <x-section>
            <x-section-title>Appearence</x-section-title>
            <div class="place-item checkerboard">
                <CanvasView :canvas="preview_canvas" />
                <CanvasView :canvas="left_hand_place"/>
                <CanvasView :canvas="right_hand_place"/>
            </div>
        </x-section>
        <div class="multi">
            <x-section>
                <x-section-title>Adjustments</x-section-title>
                <x-form>
                    <label><span>Ground Anchor Y:</span><input type="number" placeholder="auto" min="0" max="254" v-watch-range  v-model="form.shiftup"></label>
                    <template v-if="form.umisteni != ItemWearPlace.PL_NIKAM && form.umisteni != ItemWearPlace.PL_PRSTEN &&  form.umisteni != ItemWearPlace.PL_SIP ">
                    <label v-if="form.umisteni != ItemWearPlace.PL_RUKA && form.umisteni != ItemWearPlace.PL_OBOUR"><span>Avatar pos X,Y</span><input v-watch-range  min="-999" max="999" type="number" v-model="form.polohy[0][0]"><input min="-999" max="999" type="number" v-model="form.polohy[0][1]" ></label>
                    <template v-if="form.umisteni == ItemWearPlace.PL_RUKA || form.umisteni== ItemWearPlace.PL_OBOUR">
                    <label><span>Left hand X,Y</span><input v-watch-range min="-999" max="999" type="number" v-model="form.polohy[0][0]"><input min="-999" max="999" type="number" v-model="form.polohy[0][1]" ></label>
                    <label><span>Right hand X,Y</span><input v-watch-range min="-999" max="999" type="number" v-model="form.polohy[1][0]"><input min="-999" max="999" type="number" v-model="form.polohy[1][1]"></label>
                    </template>
                    </template>
                </x-form>
            </x-section>
            <x-section>
                <x-section-title>Niche / table</x-section-title>
                <div class="appear-ground checkerboard" >
                    <CanvasView :canvas="itemCanvas(PCXProfile.item,appearence,form.shiftup?form.shiftup:0)" ></CanvasView>
                </div>            
            </x-section>
        </div>
        <x-section>
            <x-section-title>When flying</x-section-title>
            <x-form>
                <label v-for="(v,idx) of ['Front','Right','Back','Destroy']" :key="v">
                    <span> {{ v }}</span>
                    <div>
                        <input v-for="w of [0,1,2,3]" :key="w" type="text" :list="ds_graphics.id" v-model="form.v_letu_files[idx*4+w]" />
                    </div>
                </label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Modified stats</x-section-title>
            <AbilitySheet v-model="form.zmeny" :changes="true" />
        </x-section>
        <x-section>
            <x-section-title>Effects</x-section-title>
            <EffectSheet v-model="form.zmeny[CharacterStats.VLS_KOUZLA]" />
        </x-section>
    </div>
    </div>
    <dialog class="popup" ref="change_icon_popup" v-if="change_icon_model"><div>
        <template v-for="(ic, idx) of allIcons">
            <CanvasView :canvas="ic.createCanvas(PCXProfile.transp0)" @click="change_icon_model = idx"/>
        </template>
        
    </div><button class="close" @click="change_icon_model=undefined"></button></dialog>
     </x-workspace>


</template>

<style scoped>

.left-panel {
    width: 240px;
    position: absolute;
    top: 2rem;
    bottom: 0px;
    display: block;
    box-sizing: border-box;
}
.left-panel .filter {
    position:absolute;
    top:-2rem;
    display: flex;
    height: 2em;
    justify-items: stretch;
    width:240px;
}
.left-panel .filter > * {
    flex-grow: 1;
    width: 45%;
}
.item-list {
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


.place-item {
    width: 100%;
    text-align: center;    
    position: relative;
    padding: 50px 0;
    position: relative;
}

.appear-ground {
    height: 150px;
    position: relative;    
    width: 20rem;
    margin-top: 1rem;
}

.appear-ground div{
    position: absolute;
    left: 0;top:0;bottom: 25px;right: 0;
    margin: auto auto 0 auto;
    width: fit-content;
    height: fit-content;
}
.appear-ground::before {
    content: "";
    display: block;
    position: absolute;
    bottom:0;
    height: 25px;
    left:0;
    right: 0;
    background-color: rgb(163, 147, 0);
background-image: linear-gradient(335deg, rgb(72, 128, 27) 23px, transparent 23px),
linear-gradient(155deg, rgb(90, 79, 43) 23px, transparent 23px),
linear-gradient(335deg, rgb(129, 116, 56) 23px, transparent 23px),
linear-gradient(155deg, rgb(102, 110, 54) 23px, transparent 23px);
background-size: 58px 58px;
background-position: 0px 2px, 4px 35px, 29px 31px, 34px 6px;
}

.editor x-section {
    width: 20rem;    
}
.popup {
    position: fixed;
    left: 15vw;
    top: 15vh;
    right: 15vw;
    bottom: 25vh;
    border: 1px solid;
    background-color: rgb(211, 204, 189);;
    padding: 2.5rem 10px 10px 10px;
    box-shadow: 3px 3px 5px black;
}
.popup > div{
    flex-wrap: wrap;
    display: flex;
    gap: 2px;    
    overflow: auto;
    max-height: 100%;
    justify-content: center;

}

.popup > div > div {
    border: 1px;
    background-color: #444;
    cursor: pointer;
    
}
.editor input[type=number] {
    width: 5em;
    text-align: center;
    box-sizing: border-box;
}

.multi {
    display: flex;
    flex-direction: column;    
}

.multi > * {
    flex-grow: 1;
}

.icon {
    width:45px;
    background-color: #444;
    cursor:pointer;
}

x-form label input[type="text"] {
    width: 10rem;
}
.spells {
    width: 6rem;
}

</style>