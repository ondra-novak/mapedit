<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue';
import StatusBar from '@/core/status_bar_control'
import { server, type FileItem } from '@/core/api';
import { ArcConfiguration, AssetConfiguration, ConfigurationPalette, FloorCeilConfiguration, MapFile, MapPalettes, MapSector, MapSide, SectorFlags2, SectorType, SectorTypeName, SideFlag, SimpleActionType, SimpleActionTypeName, WallConfiguration } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import MissingFiles from '@/components/MissingFiles.vue';
import {findSectorAtPos, makeSectorSelection, MapContainer, MapDraw } from '@/core/map_draw';
import { shallowClone, type Document } from '@/utils/document';
import  globalState from '@/utils/global';

import svg_pointer from '@/assets/toolbar/pointer.svg'
import svg_pencil from '@/assets/toolbar/pencil.svg'
import svg_eraser from '@/assets/toolbar/eraser.svg'
import svg_chest from '@/assets/toolbar/chest.svg'
import svg_enemy from '@/assets/toolbar/enemy.svg'
import PalleteEditor from '@/components/PalleteEditor.vue';
import { messageBox } from '@/utils/messageBox';
const list_assets = ref<string[]>();

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
    wall:null as WallConfiguration | null,
    floor:null as FloorCeilConfiguration| null,
    ceil:null as FloorCeilConfiguration | null,
    arc:null as ArcConfiguration | null
}));

type FocusItem = {
    sector: number;
    side: number;
    sector_def: MapSector ;
    side_def: MapSide;    
}
type LinkRef = {
    sector: number;
    side: number;
}

const focus = ref<FocusItem>();
const selection = ref<number[]>();
const link = ref<LinkRef>();

let warn_empty_tool = true;
const mapcontainer = globalState("mapcontainer",()=>new MapContainer);
const layers_opened = ref(false);
const control_state = reactive({
    can_undo: false,
    can_redo: false
});
const editor_models = reactive({
    side: new MapSide,
    sector: new MapSector
})

const mapLoadedPalettes = ref(new MapPalettes);

type PaletteModels = {
    wall: WallConfiguration|null;
    arc: ArcConfiguration|null;
    floor: FloorCeilConfiguration|null;   
    ceil: FloorCeilConfiguration|null;
};

const SectorFlagsNames = {
    DarkFog: "Always fog to black",
    Secret: "Secret",
    NoSummon: "No Teleport",
    Automapped: "Already automapped"
}


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

function updateFocusData(sect: number, side: number) {
            if (sect > 0) {
                const sdef = shallowClone(curmap.value.sectors[sect]);
                sdef.exit = shallowClone(sdef.exit);
                const wdef = shallowClone(sdef.side[side]);                
                focus.value = {sector: sect, 
                               side: side, 
                               sector_def: sdef,
                               side_def: wdef};                
                               updateFocus();
                StatusBar.setCurSectorSide(sect, side);
            } else {
                StatusBar.setCurSectorSide(0, 0);
                focus.value = undefined;
            }

}

function onMapClickXY(pt: DOMPointReadOnly, side:number,  shift: boolean, control: boolean) {
    if ((settings.edit_mode == EditMode.Edit || settings.edit_mode == EditMode.Items)) {
        if (!control) {
            const sect = findSectorAtPos(curmap.value, settings.curlevel, pt);
            updateFocusData(sect,side);
            if (!shift) {
                selection.value = [];
            }
        } else {
            if (Array.isArray(selection.value)) {
                const sect = findSectorAtPos(curmap.value, settings.curlevel, pt);
                if (sect) {
                    const idx = selection.value.findIndex(x=>x==sect);
                    if (idx != -1) selection.value = [...selection.value.slice(0,idx),...selection.value.slice(idx+1)];
                    else selection.value = [...selection.value, sect];
                }
            }
        }
    }

}


function eraseRect(rc: DOMRectReadOnly) {
    const m = begin_edit();
    const sectors = makeSectorSelection(m, settings.curlevel, rc);
    if (sectors.length) {
        m.sectors = shallowClone(m.sectors);
        sectors.forEach(sect=>{
            m.sectors[sect] = shallowClone(m.sectors[sect]);
            for (let sd = 0; sd < 4; ++sd) {
                disconnectSectors(m.sectors, sect, sd, 0);
            }
            m.sectors[sect] = new MapSector;
        });
        end_edit(m);
    }
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

function disconnectSectors(sectors: MapSector[], from :number, dir:number, mode: number) {
    const revdir = (dir+2) & 3;
    const s1 = sectors[from] = shallowClone(sectors[from]);
    const t = s1.exit[dir];
    if (!t || sectors[t].exit[revdir] != from) return false;
    const s2 = sectors[t] = shallowClone(sectors[t]);
    if (mode == 0) {
        s1.exit = shallowClone(s1.exit);
        s2.exit = shallowClone(s2.exit);
        s1.exit[dir] = 0;
        s2.exit[revdir] = 0;
    }
    const sds1 = s1.side = shallowClone(s1.side);
    const sds2 = s2.side = shallowClone(s2.side);
    const sd1 = sds1[dir] = shallowClone(sds1[dir]);
    const sd2 = sds2[revdir] = shallowClone(sds2[revdir]);
    const flags_on = mode < 1? SideFlag.PRIM_VIS|SideFlag.PLAY_IMPS|SideFlag.MONST_IMPS|SideFlag.THING_IMPS|SideFlag.SOUND_IMPS:mode;
    const flags_off = mode < 1? SideFlag.LEFT_ARC|SideFlag.RIGHT_ARC: 0;
    sd1.flags &= ~flags_off;
    sd1.flags |= flags_on;
    sd2.flags &= ~flags_off;
    sd2.flags |= flags_on;
    if (flags_on & SideFlag.PRIM_VIS) {
        sd1.primary = settings.wall;
        sd2.primary = settings.wall;
    }
    if (flags_on & SideFlag.SEC_VIS) {
        sd1.secondary = settings.wall;
        sd2.secondary = settings.wall;
    }
    if (flags_on & (SideFlag.LEFT_ARC | SideFlag.RIGHT_ARC)) {
        sd1.arc = settings.arc;
        sd2.arc = settings.arc;
    }
    return true;
}

function drawRectArcs(m: MapFile, rc: DOMRectReadOnly) {
    const sectors = makeSectorSelection(m, settings.curlevel, rc);
    if (sectors.length) {
        m.sectors = shallowClone(m.sectors);
        sectors.forEach(sect=>{
            const s =m.sectors[sect] = shallowClone(m.sectors[sect]);
            for (let sd = 0; sd < 4; ++sd) {
                const side = s.side[sd] = shallowClone(s.side[sd]);
                side.arc = null;
                side.flags &= ~(SideFlag.LEFT_ARC | SideFlag.RIGHT_ARC);
                const r = (sd + 1) & 0x3;
                const l = (sd + 3) & 0x3;
                if (settings.arc && s.exit[sd]) {
                    const s2 = m.sectors[s.exit[sd]];
                    let setr = false;
                    let setl = false;
                    if (s2) {
                        const sdr = s2.side[r];
                        if (sdr.primary && sdr.flags & SideFlag.PRIM_VIS)  {
                            setr = true;
                        }
                        const sdl = s2.side[l];
                        if (sdl.primary && sdl.flags & SideFlag.PRIM_VIS)  {
                            setl = true;
                        }
                    }
                    if (!s.exit[l] || (s.side[l].flags & SideFlag.PRIM_VIS) != 0) {
                        setl = false;
                    }
                    if (!s.exit[r] || (s.side[r].flags & SideFlag.PRIM_VIS) != 0) {
                        setr = false;
                    }
                    if (setr || setl) {
                        side.arc = settings.arc;
                        if (setl) {
                            side.flags |= SideFlag.LEFT_ARC;
                        }
                        if (setr) {
                            side.flags |= SideFlag.RIGHT_ARC;
                        }
                    }
                }
            }
        });
    }

}

async function drawRect(rc: DOMRectReadOnly) {
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
            if (idx && disconnectSectors(map.sectors, idx, 3, settings.split_mode)) done_anything = true;
        }
    } else if (rc.height == 0) {
        for (let x = rc.left; x < rc.right; ++x) {
            let idx :number| undefined = sectormap[`${x},${rc.top}`];
            if (idx && disconnectSectors(map.sectors, idx, 0, settings.split_mode)) done_anything = true;
        }
    } else {
        if (map.sectors.length == 0) map.sectors.push(new MapSector()); //sector 0 is always empty
        if (settings.floor == null && settings.wall == null && warn_empty_tool) {
            const d = await messageBox("You’re painting a room or a corridor without selecting wall or floor graphics. This is likely a mistake.\n\nDo you want to continue anyway?",
                ["Proceed - I Know What I’m Doing", "Cancel operation"],1,1);
            if (d == 1) return;
            warn_empty_tool = false;
        }
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
                    x.primary = settings.wall;
                    x.secondary = null;
                    x.arc= settings.arc;
                });                         
                sect.floor = settings.floor;
                sect.ceil = settings.ceil;          
                [[0,-1],[1,0],[0,1],[-1,0]].forEach((d,dir)=>{
                    const t = sectormap[`${x+d[0]},${y+d[1]}`];
                    if (t) {
                        connectSectors(map.sectors, idx, t, dir);
                    }
                })                
            }
        }
    }
    drawRectArcs(map,rc);
    if (done_anything) end_edit(map);
}

function modifySelection(rc: DOMRectReadOnly,shift:boolean, control:boolean) {
    const sectors = makeSectorSelection(curmap.value, settings.curlevel, rc);
    if (!selection.value || (!shift && !control)) {
        if (!control) selection.value = sectors;
        return;
    } else {
        const old_sectors: number[] = selection.value;
        const s = new Set<number>(old_sectors);
        if (control) {
            sectors.forEach(x=>s.delete(x));
        } else {
            sectors.forEach(x=>s.add(x));
        }
        selection.value = Array.from(s);
    }
}


function onMapSelectRect(rc: DOMRectReadOnly,shift:boolean, control:boolean) {
    switch (settings.edit_mode) {
        case EditMode.Draw: if (control) eraseRect(rc); else drawRect(rc); break;
        case EditMode.Erase: if (control) drawRect(rc); else eraseRect(rc);break;
        case EditMode.Edit:
        case EditMode.Enemies:  modifySelection(rc, shift, control);
            
    }    
}

mapcontainer.onClickXY = onMapClickXY;
mapcontainer.onSelectRect = onMapSelectRect;


const required_files: FileItem[] = [
    {group:AssetGroup.MAPS,name:"ITEMS.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"SOUND.DAT",ovr:true},
    {group:AssetGroup.MAPS,name:"ENEMY.DAT",ovr:true}
];

function updateFocus() {
    if (focus.value && (settings.edit_mode == EditMode.Edit||settings.edit_mode == EditMode.Items)) {
        mapdraw.drawFocusedWall(curmap.value, settings.curlevel, focus.value.sector, focus.value.side);
    } else {
        mapdraw.removeFocusedWall();
    }
}

function updateSelection() {
    if (selection.value && (settings.edit_mode == EditMode.Edit || settings.edit_mode == EditMode.Enemies)) {
        mapdraw.drawSelectedSectors(curmap.value, settings.curlevel, selection.value);
    } else {
        mapdraw.drawSelectedSectors(curmap.value, settings.curlevel, []);
    }
}

function redraw() {
    mapdraw.draw(curmap.value,settings.curlevel);
    updateFocus();
    updateSelection();
    mapcontainer.set_map(mapdraw);    
}

const layers= reactive(globalState("layers",{
    grid: true,
    sector_basic: true,
    sector_features: true,
    sector_connections: true,
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
        case EditMode.Erase: mapcontainer.set_cursor("crosshair");
             StatusBar.setCurSectorSide(0, 0);
            break;
        default: 
            mapcontainer.set_cursor("default");
            break;

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
    server.getDDLFiles(AssetGroup.WALLS, null).then(f=>list_assets.value = f.files.map(x=>x.name));
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

watch([()=>settings.edit_mode,focus],()=>{
    updateFocus();
});
watch([()=>settings.edit_mode,selection],()=>{
    updateSelection();
})


function applySector() {
    if (focus.value) {
        if (selection.value && selection.value.length) {
            const changes : ((s:MapSector)=>void)[] = [];

            const old = curmap.value.sectors[focus.value.sector];
            const nw = focus.value.sector_def;
            if (old.action != nw.action) changes.push((s:MapSector)=>s.action = nw.action);
            if (old.ceil != nw.ceil) changes.push((s:MapSector)=>s.ceil = nw.ceil);
            if (old.flags != nw.flags) changes.push((s:MapSector)=>{
                s.flags &= old.flags & ~nw.flags;
                s.flags |= nw.flags & ~old.flags;
            });
            if (old.floor != nw.floor) changes.push((s:MapSector)=>s.floor =nw.floor);
            if (old.target_sector != nw.target_sector || old.target_side != nw.target_side) changes.push((s:MapSector)=>{
                s.target_sector = nw.target_sector;
                s.target_side = nw.target_side;
            }); 
            if (old.type != nw.type) changes.push((s:MapSector)=>s.type =nw.type);
            if (changes.length) {
                const m  = begin_edit();
                m.sectors = shallowClone(m.sectors);            
                selection.value.forEach(sect=>{
                    const s = m.sectors[sect] = shallowClone(m.sectors[sect]);
                    for (const f of changes) f(s);
                });
                end_edit(m);
            }
            updateFocusData(focus.value.sector, focus.value.side);
        } else {
            const m = begin_edit();
            m.sectors = shallowClone(m.sectors);
            m.sectors[focus.value.sector] = focus.value.sector_def;
            end_edit(m);
            updateFocusData(focus.value.sector, focus.value.side);
        }
    }
}
</script>

<template>

<x-workspace>
<datalist id="listOfWallAssets9875487"><option v-for="v of list_assets" :key="v" :value="v"></option></datalist>
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
                            disable_sector_connections: !layers.sector_connections,
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
    <div class="palette" v-if="settings.edit_mode == EditMode.Draw || settings.edit_mode == EditMode.Erase">
        <div><span>Draw settings</span><x-form>
            <label><span class="title">Sector type</span><select v-model="settings.sector_type" size="1">
            <option v-for="v of SectorTypeName.map((x,idx)=>[x,idx]).filter(x=>x[1])" :key="v[1]" :value="v[1]">{{ v[0] }}</option>
        </select></label>
            <label><span class="title">Split mode</span><select v-model="settings.split_mode">
                <option :value="0">Disconnect</option>
                <option :value="-1">Thin wall</option>
                <option :value="SideFlag.PLAY_IMPS">Player barrier</option>
                <option :value="SideFlag.MONST_IMPS">Enemy barrier</option>
                <option :value="SideFlag.THING_IMPS">Item barrier</option>
                <option :value="SideFlag.SOUND_IMPS">Sound barrier</option>
                <option :value="SideFlag.SECRET|SideFlag.PRIM_VIS|SideFlag.NOT_AUTOMAP">Secret wall</option>                
                <option :value="SideFlag.PRIM_VIS">Primary wall visible</option>                
                <option :value="SideFlag.SEC_VIS">Secondary wall visible</option>                
                <option :value="SideFlag.ALARM">Alarm wall</option>                
                <option :value="SideFlag.LEFT_ARC|SideFlag.RIGHT_ARC">Set arcs</option>                
            </select></label>
        </x-form></div>
        <div class="h"><span class="title">Wall</span><PalleteEditor :palette="mapLoadedPalettes.wall_palette" :listview="true" v-model="settings.wall" type="wall"></PalleteEditor></div>
        <div class="h"><span class="title">Arc</span><PalleteEditor :palette="mapLoadedPalettes.arc_palette" :listview="true" v-model="settings.arc" type="arc"></PalleteEditor></div>
        <div class="h"><span class="title">Floor</span><PalleteEditor :palette="mapLoadedPalettes.floor_pallete" :listview="true" v-model="settings.floor" type="floor"></PalleteEditor></div>
        <div class="h"><span class="title">Ceil</span><PalleteEditor :palette="mapLoadedPalettes.ceil_palette" :listview="true" v-model="settings.ceil"  type="ceil"></PalleteEditor></div>
    </div>
    <div class="palette" v-if="settings.edit_mode == EditMode.Edit && focus && focus.sector > 0">
        <div><span class="title"><button class="link" @click="link = {sector: focus.sector, side: -1}"></button> Sector {{ focus.sector }}</span><x-form>
            <label><span>Type</span><select v-model="focus.sector_def.type" size="1">
            <option v-for="v of SectorTypeName.map((x,idx)=>[x,idx]).filter(x=>x[1])" :key="v[1]" :value="v[1]">{{ v[0] }}</option>
            </select></label>
            <label><span>Ceil</span><PalleteEditor :palette="mapLoadedPalettes.ceil_palette" :listview="false" v-model="focus.sector_def.ceil" type="ceil"></PalleteEditor></label>
            <label><span>Floor</span><PalleteEditor :palette="mapLoadedPalettes.floor_pallete" :listview="false" v-model="focus.sector_def.floor" type="floor"></PalleteEditor></label>
            <label v-for="(v,k) of SectorFlagsNames" :key="k">
                <input type="checkbox" @change="focus.sector_def.flags^=SectorFlags2[k]" :checked="(focus.sector_def.flags & SectorFlags2[k])!=0">
                <span> {{ v }}</span>
            </label>
            <label><span>Action</span><select v-model="focus.sector_def.action">
                <option v-for="v of SimpleActionType" :key="v" :value="v"> {{ SimpleActionTypeName[v]}}</option>
            </select></label>
            <div class="label"><span>Target</span><div class="target">
                    <button :disabled="(link?.side || 0) == -1" @click="focus.sector_def.target_sector=link?.sector || 0;focus.sector_def.target_side = link?.side || 0"> Side {{ focus.sector_def.target_sector }}:{{focus.sector_def.target_side }} </button>
                    <button :disabled="focus.sector_def.target_sector == 0" @click="focus.sector_def.target_sector = focus.sector_def.target_side = 0">X</button></div>
            </div>
            <div class="label"><span>Exits</span><div class="exits"><button :disabled="!link" 
                 v-for="v of [0,1,2,3]" :key="v" @click="focus.sector_def.exit[v] = link?.sector || 0">{{ focus.sector_def.exit[v] }}</button></div></div>
        </x-form>
        <div class="buttons"><button @click="applySector">Apply changes</button></div>
        </div>
        <div><span class="title"><button class="link" @click="link = {sector: focus.sector, side: focus.side}"></button> Side {{ focus.sector }}:{{ focus.side }}</span>
        <x-form>
        <label><span>Primary</span><PalleteEditor :palette="mapLoadedPalettes.wall_palette" :listview="false" v-model="focus.side_def.primary" type="wall"></PalleteEditor></label>
        <label><span>Secondary</span><PalleteEditor :palette="mapLoadedPalettes.wall_palette" :listview="false" v-model="focus.side_def.secondary" type="wall"></PalleteEditor></label>
        <label><span>Arc</span><PalleteEditor :palette="mapLoadedPalettes.arc_palette" :listview="false" v-model="focus.side_def.arc" type="arc"></PalleteEditor></label>
        <label><span>Basic action</span><select v-model="focus.side_def.action">
            <option v-for="v of SimpleActionType" :key="v" :value="v"> {{ SimpleActionTypeName[v]}}</option>
        </select></label>
        <label><span>Target</span><button :disabled="(link?.side || 0) == -1" @click="focus.side_def.target_sector=link?.sector || 0;focus.side_def.target_side = link?.side || 0"> Side {{ focus.side_def.target_sector }}:{{focus.side_def.target_side }} </button></label>
        </x-form>
        </div>

    </div>
</div>
<div class="layers" v-if="layers_opened">
    <button class="close" @click="layers_opened=false"></button>
    <x-form>
        <label><input type="checkbox" v-model="layers.grid"><span>Grid</span></label>
        <label><input type="checkbox" v-model="layers.sector_basic"><span>Sector type</span></label>
        <label><input type="checkbox" v-model="layers.sector_features"><span>Sector features</span></label>
        <label><input type="checkbox" v-model="layers.sector_connections"><span>Sector exit connections</span></label>
        <label><input type="checkbox" v-model="layers.walls"><span>Walls</span></label>
        <label><input type="checkbox" v-model="layers.arcs"><span>Arcs</span></label>
        <label><input type="checkbox" v-model="layers.actions"><span>Actions</span></label>
        <label><input type="checkbox" v-model="layers.arrows"><span>Action connections</span></label>
        <label><input type="checkbox" v-model="layers.ext_arrows"><span>External connections</span></label>
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
.right .palette div>span.title {
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
.palette .exits {
    position:relative;
    height: 4rem;
    max-width: 9rem;
}
.palette .exits button {
    position: absolute;
    width: fit-content;
    height: fit-content;
    width: 3rem;
}
.palette .exits button:nth-child(1) {
    left: 0;right:0;top:0;margin: auto;;
}
.palette .exits button:nth-child(2) {
    right: 0;bottom:0;top:0;margin: auto;;
}
.palette .exits button:nth-child(4) {
    left: 0;bottom:0;top:0;margin: auto;;
}

.palette .exits button:nth-child(3) {
    left: 0;right:0;bottom:0;margin: auto;;
}
.palette {
    position: relative;
}
.palette  .link {
    position: relative;
    width: 1.4rem;
    height: 1.4rem;
}
.palette  .link::after {
    content: " ";    
    display: block;
    position: absolute;
    left:0;top:0;
    width: 100%;
    height: 100%;
    background: url("@/assets/chain.svg");
    background-size: 1rem;
    background-repeat: no-repeat;
    background-position: center;
    ;

}

.palette .buttons {
    text-align: center;
}

.target {display: flex;width: 30%;}
.target > *:first-child {flex-grow: 1;}



</style>