<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch, type Ref, type WatchHandle } from 'vue';
import { itemsFromArrayBuffer, itemsToArrayBuffers, ItemType, ItemTypeName, ItemWearPlace, ItemWearPlaceName, WeaponTypeName, type ItemDef } from '@/core/items_struct';
import CanvasView from '@/components/CanvasView.vue';
import { PCX, PCXProfile, type PCXProfileType } from '@/core/pcx';
import { loadAllIcons, loadSingleIcon } from '@/core/IconLIB';
import { CharacterStats, ElementType, ElementTypeName, SpellEffects } from '@/core/common_defs';
import { useBitmaskCheckbox2 } from '@/core/flags';
import StatusBar from '@/core/status_bar_control'
import { create_datalist } from '@/utils/datalist';
import { getDDLFileWithImport } from '@/components/tools/missingFiles';


const selected_item = ref<number>();

const item_list = ref<ItemDef[]>([]);
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
    function reload() {
        getDDLFileWithImport(server,"ITEMS.DAT", AssetGroup.MAPS).then(x=>{
            item_list.value = x?itemsFromArrayBuffer(x):[];
            selected_item.value = undefined;
            nextTick(()=>StatusBar.setChangedFlag(false));
        });
    }
    StatusBar.registerSaveAndRevert(()=>{
        save();
    },()=>{
        reload();
    });
    reload();


}


function deleteItem() {
    if (selected_item.value !== undefined && item_list.value) {
        const lst = item_list.value;
        if (confirm("Are you sure delete item: " + lst[selected_item.value].jmeno)) {
            lst[selected_item.value].jmeno = "";
        }
        while (lst.length && !lst[lst.length-1].jmeno) lst.pop();
    }
}
function addItem() {
    let pos = 0;
    if (!item_list.value) {
        item_list.value = [];        
        item_list.value.push({} as ItemDef);
    } else {
        pos = item_list.value.findIndex(x=>x.jmeno.length == 0);
        if (pos == -1) {
            pos = item_list.value.length;   
            item_list.value.push({} as ItemDef);         
        }
    }
    form.jmeno = "New Item";
    selected_item.value = pos;
    saveItemData();
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
    if (selected_item.value!== undefined && item_list.value) {
        change_icon_model.value = -1;
    }
}

function onSelectIcon() {
    if (change_icon_model.value!== undefined && change_icon_model.value!== -1 && selected_item.value !== undefined && item_list.value) {
        form.ikona = change_icon_model.value;
        change_icon_model.value = undefined;
        
    }
}

const [itm_flags, chk_flags ] = useBitmaskCheckbox2({
        DESTROY: 0x1,
        NOREMOVE: 0x2,
}, 0);


const [itm_effects, chk_effects] = useBitmaskCheckbox2(SpellEffects);

const form = reactive({
    jmeno: "",
    popis: "",
    zmeny: new Array(4).fill(0),
    podminky: new Array(24).fill(0),
    hmotnost: 0,
    nosnost:0,
    druh:0,
    umisteni:0,
    spell:0,
    magie:0,
    ikona:0,
    vzhled_on_ground: "",
    vzhled_on_male:"",
    vzhled_on_female:"",
    user_value:0,
    keynum:0,
    arrow_type:0,
    polohy: [ [0,0],[0,0]],
    typ_zbrane: 0,
    sound_file:"",
    v_letu_files :new Array(16).fill(""),
    cena:0,
    weapon_animation_file:"",
    hitpos:0,
    shiftup:null as number|null,
});

const key_mode = ref<number>(0);
const whandle  = shallowRef<WatchHandle>();

function saveItemData() {
    if (selected_item.value!==undefined && item_list.value) {
        const itm = item_list.value[selected_item.value];
        itm.jmeno = form.jmeno;
        itm.popis = form.popis;
        itm.zmeny = form.zmeny;
        itm.zmeny[CharacterStats.VLS_KOUZLA] = itm_effects.value;
        itm.podminky = form.podminky;
        itm.hmotnost = form.hmotnost;
        itm.nosnost = form.nosnost;
        itm.druh = form.druh;
        itm.umisteni = form.umisteni;
        itm.spell = form.spell;
        itm.magie = form.magie;
        itm.ikona = form.ikona;
        itm.vzhled_on_ground  = form.vzhled_on_ground;
        itm.vzhled_on_male  = form.vzhled_on_male;
        itm.vzhled_on_female  = form.vzhled_on_female;
        itm.user_value = form.user_value;
        itm.druh_sipu = form.arrow_type;
        itm.keynum = form.keynum;
        itm.polohy = form.polohy;
        itm.typ_zbrane = form.typ_zbrane;
        itm.sound_file  = form.sound_file;
        itm.cena = form.cena;
        itm.weapon_animation_file  = form.weapon_animation_file;
        itm.hitpos = form.hitpos;
        itm.shiftup = typeof form.shiftup == "number"?form.shiftup:255;
        itm.v_letu_files = form.v_letu_files;
        itm.flags = itm_flags.value || 0;
        if (!key_mode.value) itm.keynum = 0;
        else if (key_mode.value < 0 && itm.keynum >=0) itm.keynum = -1;
        else if (key_mode.value > 0 && itm.keynum <=0) itm.keynum = 0;
        StatusBar.setChangedFlag(true);
    }
}

function loadItemData() {
    if (selected_item.value!==undefined && item_list.value) {
        if (whandle.value) whandle.value();
        const itm = item_list.value[selected_item.value];
        form.jmeno = itm.jmeno;
        form.popis = itm.popis;
        form.zmeny = itm.zmeny;
        itm_effects.value = itm.zmeny[CharacterStats.VLS_KOUZLA];
        form.podminky = itm.podminky;
        form.hmotnost = itm.hmotnost;
        form.nosnost = itm.nosnost;
        form.druh = itm.druh;
        form.umisteni = itm.umisteni;
        form.spell = itm.spell;
        form.magie = itm.magie;
        form.ikona = itm.ikona;
        form.arrow_type = itm.druh_sipu;
        form.vzhled_on_ground = itm.vzhled_on_ground || "";
        form.vzhled_on_male = itm.vzhled_on_male || "";
        form.vzhled_on_female = itm.vzhled_on_female || "";
        form.user_value = itm.user_value;
        form.keynum = itm.keynum;
        form.polohy = itm.polohy;
        form.typ_zbrane = itm.typ_zbrane;
        form.sound_file = itm.sound_file || "";
        form.cena = itm.cena;
        form.weapon_animation_file = itm.weapon_animation_file || "";
        form.hitpos = itm.hitpos;
        form.shiftup = itm.shiftup == 255?null:itm.shiftup;;
        if (itm.v_letu_files) form.v_letu_files = itm.v_letu_files;
        itm_flags.value = itm.flags;
        key_mode.value = Math.sign(form.keynum);
        whandle.value = watch([form,itm_flags,itm_effects,key_mode],saveItemData,{deep:true});
    }
}


async function onChangeSelection() {
    loadItemData();
}

function recalc_place_preview() {
    if (preview_canvas.value) {
        const parent = preview_canvas.value.parentElement;
        const app_bottom = preview_canvas.value.offsetTop + preview_canvas.value.offsetHeight;
        const app_top = preview_canvas.value.offsetTop;
        const app_center = parent?parent.clientWidth / 2.0:0;
        [left_hand_place,right_hand_place].forEach((place,idx) => {
            if (place.value) {
                const c= place.value;
                const x = form.polohy[idx][0]+app_center-c.width/2;
                const y = app_bottom - form.polohy[idx][1] - c.height;
                c.style.left = `${x}px`;
                c.style.top = `${y}px`;
            }
        })
    }
}

watch(()=>form.vzhled_on_ground,()=>{
    if (form.vzhled_on_ground) {
        server.getDDLFile(form.vzhled_on_ground).then(x=>{
            appearence.value = PCX.fromArrayBuffer(x);
        })
    } else {
        appearence.value = undefined;
    }
})
watch(()=>form.vzhled_on_male,()=>{
    if (form.vzhled_on_male) {
        server.getDDLFile(form.vzhled_on_male).then(x=>{
            const pcx = PCX.fromArrayBuffer(x);
            const single = form.umisteni != ItemWearPlace.PL_RUKA && form.umisteni != ItemWearPlace.PL_OBOUR;
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
        appearence.value = undefined;
    }
})

watch(()=>form.polohy,()=>{
    recalc_place_preview();

},{deep:true});

watch([selected_item], onChangeSelection);
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
    get:()=>-form.keynum,
    set:(n:number)=>form.keynum=-n,
});


function save() {
    if (item_list.value) {
        const buff = itemsToArrayBuffers(item_list.value);
        server.putDDLFile("ITEMS.DAT",buff, AssetGroup.MAPS);
    }
}

onMounted(init);
onUnmounted(StatusBar.onFinalSave);

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
    <div class="editor" v-if="selected_item !== undefined">
        <x-section>
            <x-section-title>Basic parameters</x-section-title>
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
                <label v-if="form.druh == ItemType.TYP_JIDLO || form.druh == ItemType.TYP_VODA"><span>Hours</span><input type="number"  v-model="form.user_value" v-watch-range min="1" max="9999"/></label>
                <label v-if="form.druh == ItemType.TYP_SVITXT"><span>Book page</span><input type="number"  v-model="form.user_value" v-watch-range min="0" max="9999"/></label>
                <label v-if="form.druh == ItemType.TYP_VRHACI"><span>Split on destroy</span><input type="number"  v-model="form.user_value" v-watch-range min="0" max="4"/></label>
                <label><span>Wear on</span><select  v-model="form.umisteni">
                    <option v-for="(n, v) of ItemWearPlaceName" :key="v" :value="v"> {{  n }}</option>
                </select></label>
                <label v-if="form.umisteni == ItemWearPlace.PL_SIP"><span>Arrow type</span><input type="number" :list="ds_arrows.id" v-model="form.arrow_type" v-watch-range min="0" max="255"/></label>
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
                    </span><input type="number" v-model="form.spell"  v-watch-range min="0" max="10000"/></label>
                </template>
                <label  v-if="form.umisteni == ItemWearPlace.PL_BATOH"><span>Capacity</span><input type="number" v-watch-range min="1" max="24" v-model="form.nosnost"/></label>
                <label><input type="checkbox" v-model="chk_flags.DESTROY"><span>Destroy on hit when thrown</span></label>
                <label><input type="checkbox" v-model="chk_flags.NOREMOVE"><span>Destroy when removed</span></label>
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
            <x-form>
                <x-section-title>Wear conditions</x-section-title>
                <label><span>Min strenght</span><input type="number" v-model="form.podminky[CharacterStats.VLS_SILA]" v-watch-range min="0" max="100"/></label>
                <label><span>Min magic</span><input type="number" v-model="form.podminky[CharacterStats.VLS_SMAGIE]" v-watch-range min="0" max="100"/></label>
                <label><span>Min dexterity</span><input type="number" v-model="form.podminky[CharacterStats.VLS_OBRAT]" v-watch-range min="0" max="100"/></label>
                <label><span>Min speed</span><input type="number" v-model="form.podminky[CharacterStats.VLS_POHYB]" v-watch-range min="0" max="100"/></label>
            </x-form>
        </x-section>
            <x-section>
                <x-section-title>Niche / table</x-section-title>
               <div class="appear-ground checkerboard" >
                    <CanvasView :canvas="itemCanvas(PCXProfile.item,appearence,form.shiftup?form.shiftup:0)" ></CanvasView>
                </div>            
            </x-section>
        </div>
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
        </div>
        <x-section>
            <x-section-title>Appearence</x-section-title>
            <div class="place-item checkerboard">
                <CanvasView :canvas="preview_canvas" />
                <CanvasView :canvas="left_hand_place"/>
                <CanvasView :canvas="right_hand_place"/>
            </div>
        </x-section>
        <x-section>
            <x-section-title>When flying</x-section-title>
            <x-form>
                <label><span>Front</span><div>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[0]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[1]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[2]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[3]"/>
                    </div></label>
                <label><span>Left/Right</span><div>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[4]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[5]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[6]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[7]"/>
                    </div></label>
                <label><span>Back</span><div>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[8]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[9]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[10]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[11]"/>
                    </div></label>
                <label><span>Destroy</span><div>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[12]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[13]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[14]"/>
                        <input :list="ds_graphics.id" v-model="form.v_letu_files[15]"/>
                    </div></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Modified stats</x-section-title>
            <x-form>
                <label><span>Strength</span><input v-model="form.zmeny[CharacterStats.VLS_SILA]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Magic</span><input v-model="form.zmeny[CharacterStats.VLS_SMAGIE]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Speed</span><input v-model="form.zmeny[CharacterStats.VLS_POHYB]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Dexterity</span><input v-model="form.zmeny[CharacterStats.VLS_OBRAT]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Max hitpoints</span><input v-model="form.zmeny[CharacterStats.VLS_MAXHIT]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Max vitality</span><input v-model="form.zmeny[CharacterStats.VLS_KONDIC]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Max mana</span><input v-model="form.zmeny[CharacterStats.VLS_MAXMANA]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Attack</span><div><input type="number" v-model="form.zmeny[CharacterStats.VLS_UTOK_L]" v-watch-range min="-100" max="100"/>-<input type="number" v-model="form.zmeny[CharacterStats.VLS_UTOK_H]" v-watch-range min="-100" max="100"/></div></label>
                <label><span>Defese</span><div><input type="number" v-model="form.zmeny[CharacterStats.VLS_OBRAN_L]" v-watch-range min="-100" max="100"/>-<input type="number" v-model="form.zmeny[CharacterStats.VLS_OBRAN_H]" v-watch-range min="-100" max="100"/></div></label>
                <label><span>Magic attack</span><div><input type="number" v-model="form.zmeny[CharacterStats.VLS_MGSIL_L]" v-watch-range min="-100" max="100"/>-<input type="number" v-model="form.zmeny[CharacterStats.VLS_MGSIL_H]" v-watch-range min="-100" max="100"/></div></label>
                <label><span>Magic attack type</span><div><select v-model="form.zmeny[CharacterStats.VLS_MGZIVEL]">
                    <option value="-1">--select--</option>
                    <option value="0">fire</option>
                    <option value="1">water</option>
                    <option value="2">earth</option>
                    <option value="3">air</option>
                    <option value="4">mind</option>
                </select></div></label>
                <label><span>Extra damage</span><input v-model="form.zmeny[CharacterStats.VLS_DAMAGE]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection fire</span><input v-model="form.zmeny[CharacterStats.VLS_OHEN]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection water</span><input v-model="form.zmeny[CharacterStats.VLS_VODA]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection earth</span><input v-model="form.zmeny[CharacterStats.VLS_ZEME]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection air</span><input v-model="form.zmeny[CharacterStats.VLS_VZDUCH]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Protection mind</span><input v-model="form.zmeny[CharacterStats.VLS_MYSL]" type="number" v-watch-range min="-100" max="100" /></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Effects</x-section-title>
            <x-form>
                <label><input type="checkbox" v-model="chk_effects.SPL_INVIS"/><span>Invisible</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_TVAR"/><span>Deflecting stance</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_OKO"/><span>Eye by eye</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_DRAIN"/><span>Live drain</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_MANASHIELD"/><span>Mana shield</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_SANC"/><span>Physical resistance (50%)</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_HSANC"/><span>Magical resistance (50%)</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_BLIND"/><span>Blinded</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_REGEN"/><span>Regenerate during battle</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_ICE_RES"/><span>Cold resitance</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_FIRE_RES"/><span>Hot resistance</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_KNOCK"/><span>Hit knock back</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_FEAR"/><span>Fear (flee from battle)</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_LEVITATION"/><span>Levitation</span></label>
                <label><input type="checkbox" v-model="chk_effects.SPL_STONED"/><span>Stoned</span></label>
                <label><span>Regen. HP</span><input v-model="form.zmeny[CharacterStats.VLS_HPREG]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Regen. mana</span><input v-model="form.zmeny[CharacterStats.VLS_MPREG]" type="number" v-watch-range min="-100" max="100" /></label>
                <label><span>Regen. vitality</span><input v-model="form.zmeny[CharacterStats.VLS_VPREG]" type="number" v-watch-range min="-100" max="100" /></label>
            </x-form>
        </x-section>
    </div>
    </div>
    <div class="popup" v-if="change_icon_model"><div>
        <template v-for="(ic, idx) of allIcons">
            <CanvasView :canvas="ic.createCanvas(PCXProfile.transp0)" @click="change_icon_model = idx"/>
        </template>
        
    </div><button class="close" @click="change_icon_model=undefined"></button></div>
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


</style>