<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { ArcConfiguration, AssetConfiguration, ConfigurationPalette, FloorCeilConfiguration, MapFile, MapPalettes, MapSector, RawMapFile, SectorType, SectorTypeName, SideFlag, WallConfiguration } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import MissingFiles from '@/components/MissingFiles.vue';
import {MapContainer, MapDraw } from '@/core/map_draw';
import { shallowClone, type Document } from '@/utils/document';
import  globalState from '@/utils/global';

import svg_pointer from '@/assets/toolbar/pointer.svg'
import svg_pencil from '@/assets/toolbar/pencil.svg'
import svg_eraser from '@/assets/toolbar/eraser.svg'
import svg_chest from '@/assets/toolbar/chest.svg'
import svg_enemy from '@/assets/toolbar/enemy.svg'
import PalleteEditor from '@/components/PalleteEditor.vue';
import { walk } from 'vue/compiler-sfc';

const EditMode = {
    Edit:0,
    Draw:1,
    Erase:2,
    Items:3,
    Enemies:4
} as const;

const mapview = ref<HTMLElement>();
const mapdraw :MapDraw=  new MapDraw();
const curmap = shallowRef<MapFile>(new MapFile());
const settings = reactive(globalState("mapview_settings",{
    curlevel : 0 as number,
    edit_mode: EditMode.Edit as number,
    sector_type: SectorType.Normal as number,
    split_mode: 0 as number,
}));
const mapcontainer = globalState("mapcontainer",()=>new MapContainer);
const layers_opened = ref(false);
const control_state = reactive({
    can_undo: false,
    can_redo: false
});

const mapLoadedPalettes = ref(new MapPalettes);

type PaletteModels = {
    wall: WallConfiguration|null;
    arc: ArcConfiguration|null;
    floor: FloorCeilConfiguration|null;   
    ceil: FloorCeilConfiguration|null;
};



const cur_palettes = reactive(globalState<PaletteModels>("palette", {wall:null,floor:null,ceil:null,arc:null}));

function updateControls() {
    control_state.can_redo = StatusBar.cur_map.can_redo();
    control_state.can_undo = StatusBar.cur_map.can_undo();
}

function begin_edit() : MapFile{
    return shallowClone(StatusBar.cur_map.get_current());        
}

function end_edit(map : MapFile) {
    StatusBar.cur_map.add_change(map);
    curmap.value = StatusBar.cur_map.get_current();
    updateControls();
}

function doUndo() {
    if (StatusBar.cur_map.can_undo()) {
        StatusBar.cur_map.do_undo();
        curmap.value = StatusBar.cur_map.get_current();
        updateControls();
    }
}

function doRedo() {
    if (StatusBar.cur_map.can_redo()) {
        StatusBar.cur_map.do_redo();
        curmap.value = StatusBar.cur_map.get_current();
        updateControls();
    }
}

function onMapClickXY(pt: DOMPointReadOnly, shift: boolean, control: boolean) {

}


function eraseRect(rc: DOMRectReadOnly) {

}

function connectSectors(sectors: MapSector[], from: number, to:number, dir: number) {
    const revdir = (dir +2) & 3;
    sectors[from] = shallowClone(sectors[from]);
    sectors[from].exit = shallowClone(sectors[from].exit);
    sectors[to] = shallowClone(sectors[to]);
    sectors[to].exit = shallowClone(sectors[to].exit);
    sectors[from].exit[dir] = to;
    sectors[to].exit[revdir] = from;
    sectors[from].side = shallowClone(sectors[from].side);
    const sd1 = sectors[from].side[dir] = shallowClone(sectors[from].side[dir]);
    sectors[to].side = shallowClone(sectors[to].side);
    const sd2 = sectors[to].side[revdir] = shallowClone(sectors[to].side[revdir]);
    const flags_off = SideFlag.PRIM_VIS|SideFlag.SEC_VIS|SideFlag.PLAY_IMPS|SideFlag.MONST_IMPS|SideFlag.THING_IMPS|SideFlag.SOUND_IMPS;
    sd1.flags &= ~flags_off;
    sd2.flags &= ~flags_off;
}

function disconnectSectors(sectors: MapSector[], from :number, dir:number) {
    const revdir = (dir+2) & 3;
    const s1 = sectors[from] = shallowClone(sectors[from]);
    const t = s1.exit[dir];
    if (!t || sectors[t].exit[revdir] != from) return false;
    const s2 = sectors[t] = shallowClone(sectors[t]);
    s1.exit = shallowClone(s1.exit);
    s1.exit[dir] = 0;
    s2.exit = shallowClone(s2.exit);
    s2.exit[revdir] = 0;
    const sds1 = s1.side = shallowClone(s1.side);
    const sds2 = s2.side = shallowClone(s2.side);
    const sd1 = sds1[dir] = shallowClone(sds1[dir]);
    const sd2 = sds2[revdir] = shallowClone(sds2[revdir]);
    const flags_on = SideFlag.PRIM_VIS|SideFlag.SEC_VIS|SideFlag.PLAY_IMPS|SideFlag.MONST_IMPS|SideFlag.THING_IMPS|SideFlag.SOUND_IMPS;
    const flags_off = SideFlag.LEFT_ARC|SideFlag.RIGHT_ARC;
    sd1.flags &= flags_off;
    sd1.flags |= flags_on;
    sd2.flags &= flags_off;
    sd2.flags |= flags_on;
    return true;
}

function drawRect(rc: DOMRectReadOnly) {
    const map = begin_edit();
    const free_sectors :number[] =  [];
    const sectormap = map.sectors.reduce((mp, sect, idx)=>{
        if (idx == 0) return mp;
        if (sect.type == SectorType.Empty) {
            free_sectors.push(idx);
        }
        if (sect.level ==settings.curlevel && sect.type != SectorType.Empty) {
            mp[`${sect.x},${sect.y}`] = idx;
        }        
        return mp;
    }, {} as Record<string,number>);
    map.sectors = shallowClone(map.sectors);
    let done_anything = false;
    if (rc.width == 0) {
        for (let y = rc.top; y < rc.bottom; ++y) {
            let idx :number| undefined = sectormap[`${rc.left},${y}`];
            if (idx && disconnectSectors(map.sectors, idx, 3)) done_anything = true;
        }
    } else if (rc.height == 0) {
        for (let x = rc.left; x < rc.right; ++x) {
            let idx :number| undefined = sectormap[`${x},${rc.top}`];
            if (idx && disconnectSectors(map.sectors, idx, 0)) done_anything = true;
        }
    } else {
        if (map.sectors.length == 0) map.sectors.push(new MapSector()); //sector 0 is always empty
        for (let x = rc.left; x < rc.right; ++x) {
            for (let y = rc.top; y < rc.bottom; ++y) {
                done_anything = true;
                let idx :number| undefined = sectormap[`${x},${y}`];
                let sect;
                if (!idx) {
                    idx = free_sectors.shift(); 
                    if (!idx) {
                        idx = map.sectors.length;
                        map.sectors.push(new MapSector());
                    }
                    sect = map.sectors[idx] = new MapSector();                    
                    sect.x = x;
                    sect.y = y;
                    sect.level = settings.curlevel;
                    sectormap[`${x},${y}`] = idx;    
                } else {
                    sect = map.sectors[idx] = shallowClone(map.sectors[idx]);                    
                    sect.side = shallowClone(sect.side);
                    sect.side = sect.side.map(x=>shallowClone(x));
                }
                sect.type = settings.sector_type;
                sect.side.forEach(x=>{
                    x.flags = SideFlag.PLAY_IMPS | SideFlag.MONST_IMPS| SideFlag.SOUND_IMPS | SideFlag.THING_IMPS
                            | SideFlag.PRIM_VIS | SideFlag.SEC_FORV 
                    x.primary = cur_palettes.wall;
                    x.secondary = null;
                    x.arc= cur_palettes.arc;
                });                         
                sect.floor = cur_palettes.floor;
                sect.ceil = cur_palettes.ceil;          
                [[0,-1],[1,0],[0,1],[-1,0]].forEach((d,dir)=>{
                    const t = sectormap[`${x+d[0]},${y+d[1]}`];
                    if (t) {
                        connectSectors(map.sectors, idx, t, dir);
                    }
                })                
            }
        }
    }
    if (done_anything) end_edit(map);
}

function onMapSelectRect(rc: DOMRectReadOnly,shift:boolean, control:boolean) {
    switch (settings.edit_mode) {
        case EditMode.Draw: if (control) eraseRect(rc); else drawRect(rc); break;
        case EditMode.Erase: if (control) drawRect(rc); else eraseRect(rc);break;
    }    
}

mapcontainer.onClickXY = onMapClickXY;
mapcontainer.onSelectRect = onMapSelectRect;


const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"SOUND.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"ENEMY.DAT",ovr:true}
];

function redraw() {
    mapdraw.draw(curmap.value,settings.curlevel);
    mapcontainer.set_map(mapdraw);    
}

const layers= reactive(globalState("layers",{
    grid: true,
    sector_basic: true,
    sector_features: true,
    walls: true,
    arcs: true,
    actions: true,
    arrows: true,
    ext_arrows: true,
    enemies: true,
    items: true
}));

watch([()=>settings.curlevel, curmap], ()=>{
    redraw();
});
watch([()=>settings.edit_mode, curmap], ()=>{
    switch (settings.edit_mode) {
        case EditMode.Draw:
        case EditMode.Erase: mapcontainer.set_cursor("crosshair");break;
        default: mapcontainer.set_cursor("default");break;

    }
});
function onMapLoaded() {

    function reload(doc: Document<MapFile>) {
        mapLoadedPalettes.value = StatusBar.getMapPalettes();
        curmap.value = doc.get_current();
        const start = curmap.value.info.start_sector;
        settings.curlevel = curmap.value.sectors[start].level;
        redraw();
        mapcontainer.zoom_reset();
    }

    StatusBar.registerSaveAndRevert(()=>{
        console.log("save");
    }, async ()=>{
        const doc = await StatusBar.reloadMap();
        reload(doc);
        mapLoadedPalettes.value = StatusBar.getMapPalettes();
    });    
    
    reload(StatusBar.cur_map);
}

async function init() {
    StatusBar.onMapOpen(onMapLoaded);
    if (mapview.value)     {
        mapcontainer.add_to_DOM(mapview.value);        
    }    
    if (!StatusBar.cur_map_name.value) {
        StatusBar.openMapDialog();
        return;
    } else {
        curmap.value = StatusBar.cur_map.get_current();
    }
    redraw();
    updateControls();

}

function resetFloor() {
    const start = curmap.value.info.start_sector
    const s = curmap.value.sectors[start] || curmap.value.sectors[1];    
    settings.curlevel = s?.level || 0;
}

function onCreateNew() {

}

function onImported() {
    
}

const edit_modes = [
[svg_pointer,"Edit"],
[svg_pencil,"Draw"],
[svg_eraser,"Erase"],
[svg_chest,"Items/Loot"],
[svg_enemy,"Enemies"],
]

onMounted(init);
onUnmounted(StatusBar.onFinalSave)

function add_configuration<T extends AssetConfiguration>(conf: AssetConfiguration, target: ConfigurationPalette<T>) {

}

</script>

<template>

<x-workspace>
<div class="toolbar">
    <div :class="{active: layers_opened}" @click = "layers_opened = !layers_opened"><img src="@/assets/toolbar/layers.svg"></div>
    <div v-for="(v,idx) in edit_modes" @click="settings.edit_mode = idx" :class="{active: settings.edit_mode == idx, sep: idx == 0}" :title="v[1]"><img :src="v[0]"></div>
    <div class="sep" @click="settings.curlevel++"><img src="@/assets/toolbar/go_up.svg"></div>
    <div @click="resetFloor"><img src="@/assets/toolbar/floor_reset.svg"></div>
    <div @click="settings.curlevel--"><img src="@/assets/toolbar/go_down.svg"></div>
    <div class="sep" @click="mapcontainer.zoom_rel(+ 0.2)"><img src="@/assets/toolbar/zoom_in.svg"></div>
    <div @click="mapcontainer.zoom_reset()"><img src="@/assets/toolbar/zoom_reset.svg"></div>
    <div @click="mapcontainer.zoom_rel(-0.2)"><img src="@/assets/toolbar/zoom_out.svg"></div>
    <div class="sep" @click="doUndo":class="{disabled: !control_state.can_undo}"><img src="@/assets/toolbar/undo.svg"></div>
    <div :class="{disabled: !control_state.can_redo}" @click="doRedo"><img src="@/assets/toolbar/redo.svg"></div>
</div>
<div class="middle">
<div ref="mapview" class="mapcont" :class="{disable_sector_basic: !layers.sector_basic,
                            disable_sector_features: !layers.sector_features,
                            disable_walls: !layers.walls,
                            disable_arc: !layers.arcs,
                            disable_actions: !layers.actions,
                            disable_arrows: !layers.arrows,
                            disable_ext_arrows: !layers.ext_arrows,
                            disable_enemies: !layers.enemies,
                            disable_items:!layers.items,
                            disable_grid: !layers.grid
                            }"></div>
</div>                            
<div class="right">
    <div class="palette">
        <div><span>Draw settings</span><x-form>
            <label><span>Sector type</span><select v-model="settings.sector_type" size="1">
            <option v-for="v of SectorTypeName.map((x,idx)=>[x,idx]).filter(x=>x[1])" :key="v[1]" :value="v[1]">{{ v[0] }}</option>
        </select></label>
            <label><span>Split mode</span><select v-model="settings.split_mode">
                <option :value="0">Disconnect</option>
                <option :value="-1">Thin wall</option>
                <option :value="SideFlag.PLAY_IMPS">Player barrier</option>
                <option :value="SideFlag.MONST_IMPS">Enemy barrier</option>
                <option :value="SideFlag.THING_IMPS">Item barrier</option>
                <option :value="SideFlag.SOUND_IMPS">Sound barrier</option>
                <option :value="SideFlag.SECRET|SideFlag.PRIM_VIS|SideFlag.NOT_AUTOMAP">Secret wall</option>                
            </select></label>
        </x-form></div>
        <div class="h"><span>Wall</span><PalleteEditor :palette="mapLoadedPalettes.wall_palette" :listview="true" v-model="cur_palettes.wall" type="wall"></PalleteEditor></div>
        <div class="h"><span>Arc</span><PalleteEditor :palette="mapLoadedPalettes.arc_palette" :listview="true" v-model="cur_palettes.arc" type="arc"></PalleteEditor></div>
        <div class="h"><span>Floor</span><PalleteEditor :palette="mapLoadedPalettes.floor_pallete" :listview="true" v-model="cur_palettes.floor" type="floor"></PalleteEditor></div>
        <div class="h"><span>Ceil</span><PalleteEditor :palette="mapLoadedPalettes.ceil_palette" :listview="true" v-model="cur_palettes.ceil"  type="ceil"></PalleteEditor></div>
    </div>
</div>
<div class="layers" v-if="layers_opened">
    <button class="close" @click="layers_opened=false"></button>
    <x-form>
        <label><input type="checkbox" v-model="layers.grid"><span>Grid</span></label>
        <label><input type="checkbox" v-model="layers.sector_basic"><span>Sector type</span></label>
        <label><input type="checkbox" v-model="layers.sector_features"><span>Sector features</span></label>
        <label><input type="checkbox" v-model="layers.walls"><span>Walls</span></label>
        <label><input type="checkbox" v-model="layers.arcs"><span>Arcs</span></label>
        <label><input type="checkbox" v-model="layers.actions"><span>Actions</span></label>
        <label><input type="checkbox" v-model="layers.arrows"><span>Connections</span></label>
        <label><input type="checkbox" v-model="layers.ext_arrows"><span>External Cnnections</span></label>
        <label><input type="checkbox" v-model="layers.enemies"><span>Enemies</span></label>
        <label><input type="checkbox" v-model="layers.items"><span>Items</span></label>
    </x-form>
</div>
</x-workspace>

<MissingFiles :files="required_files" @created_new="onCreateNew" @imported="onImported" />

</template>


<style lang="css" scoped>
x-workspace {
    display: flex;
    align-items: stretch;
    height: 100%;
}
.toolbar {
    display: flex;
    flex-direction: column;
    background-color: #aaa;
    width: 3em;
    gap:1px;
}
.toolbar > * {
    height: 1.5rem;
    text-align: center;
    padding: 0.25rem;
    background: linear-gradient(90deg, white, #ccc);
    border-radius: 2rem 0 0 2rem;
    cursor: pointer;
}

.toolbar > *.active,.toolbar > *:active {
    background: linear-gradient(90deg, #aaa, #ccc);
}
.toolbar > *:active  img {
    transform: translateX(-1px);
}

.toolbar > *.sep {
    margin-top: 4px;
}

.toolbar   img {
    height: 1.5rem;
}
.middle {
    flex-grow: 1;
    
}

.layers {
    position: absolute;
    border:1px solid;
    background-color: #eee;
    padding: 2em 1em 1em 1em;
    box-shadow: 3px 3px 5px black;
    left: 3.1rem;
}

.mapcont {
    height: 100%;
}

.right {
    width: 20rem;

}

.right .palette {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    height: 100%;
    padding: 0.5rem;
    box-sizing: border-box;
}

.right .palette div {
    flex-grow: 1;    
}
.right .palette div>span {
    font-weight: bold;
    display: block;
    background: linear-gradient(45deg, #aaa, transparent);
}

.right .palette > div.h {
    display: flex;
    flex-direction: column;    
}

.toolbar > .disabled img {
    opacity: 0.1;
}
.toolbar > .disabled {
    cursor: default;
}
.toolbar > .disabled:active {
    background: linear-gradient(90deg, white, #ccc);;
}
.toolbar > .disabled:active  img {
    transform: none;
}
.toolbar {
    user-select: none;
}


</style>