<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, shallowRef, toRaw, watch } from 'vue';
import StatusBar, { type SaveRevertControl } from '@/components/statusBar.ts'
import { server } from '@/core/api';
import { ArcConfiguration, FloorCeilConfiguration, GlobalMapPalettes, MapFile, MAPGLOBAL, MapPalettes, MapSector, MapSide, SectorFlags2, SectorType, SectorTypeName, SideFlag, SimpleActionType, SimpleActionTypeName, TMA_GEN, WallConfiguration, type NicheDef } from '@/core/map_structs';
import { AssetGroup } from '@/core/asset_groups';
import {findSectorAtPos, makeSectorSelection, MapContainer, MapDraw } from '@/core/map_draw';
import { shallowClone, Document } from '@/utils/document';

import svg_pointer from '@/assets/toolbar/pointer.svg'
import svg_pencil from '@/assets/toolbar/pencil.svg'
import svg_eraser from '@/assets/toolbar/eraser.svg'
import svg_chest from '@/assets/toolbar/chest.svg'
import svg_enemy from '@/assets/toolbar/enemy.svg'
import PalleteEditor from '@/components/PalleteEditor.vue';
import { messageBox } from '@/utils/messageBox';
import { create_datalist } from '@/utils/datalist';
import NicheEditor from './NicheEditor.vue';
import type { MultiactionModelDef } from '@/components/MultiactionEditor.vue';
import MultiactionEditor from '@/components/MultiactionEditor.vue';
import { apply_array_diff, create_array_diff } from '@/utils/madiff';
import MapSelectDlg from '@/components/MapSelectDlg.vue';
import { map_load_stringtable, map_save_stringtable } from '@/core/string_table';
import MapSettingsDlg from '@/components/MapSettingsDlg.vue';
const list_assets = ref<string[]>([]);

const EditMode = {
    Edit:0,
    Draw:1,
    Erase:2,
    Items:3,
    Enemies:4
} as const;

class MapFileWithStringtable extends MapFile{

    strtable: string[];

    constructor(f?: MapFile, s?: string[]) {
        super();
        this.strtable = s || [];
        if (f) Object.assign(this, f);        
    }
}

const map_filename = ref<string>("");
const open_map_dlg = ref<boolean>(false);
const props = defineProps<{active:boolean}>();

const mapview = ref<HTMLElement>();
const mapdraw :MapDraw=  new MapDraw();
const map_document = new Document<MapFileWithStringtable>(new MapFileWithStringtable);
const curmap = shallowRef<MapFileWithStringtable>(new MapFileWithStringtable());
let original_string_table:string[] = [];
const settings = reactive({
    curlevel : 0 as number,
    edit_mode: EditMode.Edit as number,
    sector_type: SectorType.Normal as number,
    split_mode: 0 as number,
    wall:null as WallConfiguration | null,
    floor:null as FloorCeilConfiguration| null,
    ceil:null as FloorCeilConfiguration | null,
    arc:null as ArcConfiguration | null,
});


type FocusItem = {
    sector: number;
    side: number;
    sector_def: MapSector ;
    side_def: MapSide;    
    script: MultiactionModelDef;
}
type LinkRef = {
    sector: number;
    side: number;
}

const ApplyMode = {
    ACTIVE:{t:"Active wall",v:-1},
    BOTH_SIDES:{t:"Active wall both sides",v:-2},
    SELECTION_DIR:{t:"Selected in direction",v:8},
    PERIMETER:{t:"Perimeter walls ☐",v:4},
    INNER_SIDES:{t:"Inner walls ",v:5},
    EDGE_SIDES:{t:"Edge walls",v:6},
    ALL_SIDES:{t:"All selected walls",v:7},
    NORTH:{t:"North ↑",v:0},
    EAST:{t:"East →",v:1},
    SOUTH:{t:"South ↓",v:2},
    WEST:{t:"West ←",v:3},
};

const ActionEvent = [
"Before leaving tile", //MC_PASSSUC 0x1
"On wall bump", //MC_PASSFAIL 0x2
"On interaction", //MC_TOUCHSUC 0x4
"On wrong key", //MC_TOUCHFAIL 0x8
"On locked", //MC_LOCKINFO 0x10
"After leaving tile", //MC_EXIT 0x20
"On message received", //MC_INCOMING 0x40
"On level start", //MC_STARTLEV 0x80
"On door closed", //MC_CLOSEDOOR 0x100
"On animation frame", //MC_ANIM  0x200
"On odd anim. frame", //MC_ANIM2 0x400
"On message applied", //MC_SUCC_DONE 0x800
"On specproc", //MC_SPEC_SUCC 0x1000
"On door opened", //MC_OPENDOOR 0x2000
"On niche interaction", //MC_VYKEVENT 0x4000
"On wall attack", //MC_WALLATTACK 0x8000
]

const focus = ref<FocusItem>();
const selection = ref<number[]>();
const link = ref<LinkRef>();
const applyMode = ref<number>(ApplyMode.ACTIVE.v);
const curNiche = ref<NicheDef|null>(null);
const goto_sector_n = ref(1);
const goto_sector_dlg = ref(false);
const goto_sector_input = ref<HTMLInputElement>();
const map_settings = ref<MAPGLOBAL>();
const action_ui = ref(false);
const wall_props = ref(false);

let warn_empty_tool = true;
const mapcontainer = new MapContainer;
const layers_opened = ref(false);
const control_state = reactive({
    can_undo: false,
    can_redo: false
});

const mapLoadedPalettes = ref(new GlobalMapPalettes);
let save_state: SaveRevertControl;

const SectorFlagsNames = {
    Secret: "Secret",
    NoSummon: "No Teleport",
    Automapped: "Already automapped"
};

const SideFlagsNames_Map = {
    NOT_AUTOMAP: "No automap",
    INVIS: "Invisible on map",
    SECRET: "Secret wall",
};
const SideFlagsNames_Barriers = {
    PLAY_IMPS: "Player barrier",
    MONST_IMPS: "Monster barrier",
    THING_IMPS: "Item barrier",
    SOUND_IMPS: "Sound barrier",
    ALARM: "Alarm",
};
const SideFlagsNames_Visibility= {
    PRIM_VIS: "Primary visible",
    SEC_VIS: "Secondary visible",
    LEFT_ARC: "Left arc",
    RIGHT_ARC: "Right arc",
    TRUESEE: "True Seeing transp.",
    AUTOANIM: "Animate Lever"
};
const SideFlagsNames_ActionBehavior= {
    COPY_ACTION: "Forward action",
    SEND_ACTION: "Chain action",
    APPLY_2ND: "Apply both sides",
};

const SideFlagsNames_Actions = {
    PASS_ACTION: "Activate by pass",
};

const SideFlagsNames_Changes = {
    CHANGE_AUTOMAP: "Automapping",
    CHANGE_PLAY_IMPS: "Player barrier",
    CHANGE_MONST_IMPS: "Monster barrier",
    CHANGE_THING_IMPS: "Item barrier",
    CHANGE_SOUND_IMPS: "Sound barrier",
};

const SideFlagsNames_All = {
    "side_visibility": {t:"Visibility",f:SideFlagsNames_Visibility},
    "side_barriers": {t:"Barriers",f:SideFlagsNames_Barriers},
    "side_automapping": {t:"Map appearence",f:SideFlagsNames_Map},
    "side_action_behavior": {t:"Action reaction",f:SideFlagsNames_ActionBehavior},
}
 


function updateControls() {
    control_state.can_redo = map_document.can_redo();
    control_state.can_undo = map_document.can_undo();
}

function begin_edit() : MapFileWithStringtable{
    return shallowClone(map_document.get_current());        
}

function end_edit(map : MapFileWithStringtable) {
    map_document.add_change(map);
    curmap.value = map_document.get_current();
    updateControls();
    save_state.set_changed(true);
}

function doUndo() {
    if (map_document.can_undo()) {
        map_document.do_undo();
        curmap.value = map_document.get_current();
        updateControls();
        if (focus.value) updateFocusData(focus.value.sector, focus.value.side);
    }
}

function doRedo() {
    if (map_document.can_redo()) {
        map_document.do_redo();
        curmap.value = map_document.get_current();
        updateControls();
        if (focus.value) updateFocusData(focus.value.sector, focus.value.side);
    }
}

async function saveOnTeleport() {
    if (save_state.get_changed()) {
        await saveMap();
        save_state.set_changed(false);
    }
    return true;

}

function updateFocusData(sect: number, side: number) {
            if (sect > 0) {
                const sdef = shallowClone(curmap.value.sectors[sect]);
                sdef.exit = shallowClone(sdef.exit);
                const wdef = shallowClone(sdef.side[side]);                
                focus.value = {sector: sect, 
                               side: side, 
                               sector_def: sdef,
                               side_def: wdef,
                               script: {
                                    actionList:wdef.actions.map(x=>toRaw(shallowClone(x))),
                                    stringTable:curmap.value.strtable.map(x=>toRaw(x))
                               }
                            };                
                            updateFocus();
                StatusBar.set_current_sector(sect,side, saveOnTeleport);
            } else {
                StatusBar.unset_current_sector();
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
                            | SideFlag.PRIM_VIS | SideFlag.SEC_FORV | SideFlag.CHANGE_AUTOMAP
                            | SideFlag.CHANGE_MONST_IMPS | SideFlag.CHANGE_PLAY_IMPS | SideFlag.CHANGE_SOUND_IMPS
                            | SideFlag.CHANGE_THING_IMPS;
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
        if (selection.value.length == 0 && applyMode.value >= 0) applyMode.value = -1;
    } else {
        mapdraw.drawSelectedSectors(curmap.value, settings.curlevel, []);
        if (applyMode.value >= 0) applyMode.value = -1;

    }

}

function redraw() {
    mapdraw.draw(curmap.value,settings.curlevel);
    updateFocus();
    updateSelection();
    mapcontainer.set_map(mapdraw);    
}

const layers= reactive({
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
    items: true,
});

watch([()=>settings.curlevel, curmap], ()=>{
    redraw();
});
watch([()=>settings.edit_mode, curmap], ()=>{
    switch (settings.edit_mode) {
        case EditMode.Draw:
        case EditMode.Erase: mapcontainer.set_cursor("crosshair");
             StatusBar.unset_current_sector();
            break;
        default: 
            mapcontainer.set_cursor("default");
            break;

    }
});


async function loadMap(mapname: string)   {
    try {
        const buff = await server.getDDLFile(mapname);
        const mapdata = MapFile.from(buff);            
        let ss: string[] = [];
        if (mapdata.map.sectors.length) {
            ss = await map_load_stringtable(mapname);            
        }
        original_string_table = ss;
        map_document.reset(new MapFileWithStringtable(mapdata.map,ss));
        mapLoadedPalettes.value.merge(mapdata.palette);


    } catch (e) {
        map_document.reset(new MapFileWithStringtable());
        original_string_table = [];
    }
    curmap.value = map_document.get_current();
    const start = curmap.value.info.start_sector;
    settings.curlevel = curmap.value.sectors[start].level;
    redraw();        
    mapcontainer.zoom_reset();
    map_filename.value = mapname;
    StatusBar.unset_current_sector();
};


async function reloadMap()  {
    const name = map_filename.value;
    if (name) {
        return await loadMap(name);
    }
}

async function saveMap() {
    const name = map_filename.value;
    if (name) {
        const map = map_document.get_current();
        await server.putDDLFile(name, map.saveToArrayBuffer(), AssetGroup.MAPS);
        if (original_string_table != map.strtable) {
            map_save_stringtable(name, map.strtable); 
            original_string_table = map.strtable;
        }
        return true;
    } else {
        return false;
    }

}

function init_save_state() {
    StatusBar.register_save_control().then(st=>{
        save_state = st;
        st.on_save(()=>{
            saveMap();    
        })
        st.on_revert(()=>{
            reloadMap();
        });
    });
}

function reload_all_lists() {
    server.getDDLFiles(AssetGroup.WALLS, null).then(f=>list_assets.value = f.files.map(x=>x.name));
    redraw();
    updateControls();
}

function open_map_prompt() {
        if (!map_filename.value) {
        StatusBar.set_map_switch("<click here>",()=>{
            open_map_dlg.value = true;
        });        
    }
}

async function init() {        
    open_map_prompt();
}

function resetFloor() {
    const start = curmap.value.info.start_sector
    const s = curmap.value.sectors[start] || curmap.value.sectors[1];    
    settings.curlevel = s?.level || 0;
}


const edit_modes = [
[svg_pointer,"Edit"],
[svg_pencil,"Draw"],
[svg_eraser,"Erase"],
[svg_chest,"Items/Loot"],
[svg_enemy,"Enemies"],
]

onMounted(init);
onUnmounted(()=>save_state?.unmount())

watch([()=>settings.edit_mode,focus],()=>{
    updateFocus();
});
watch([()=>settings.edit_mode,selection],()=>{
    updateSelection();
})


function applyChanges() {
    if (focus.value) {
        const changesSector : ((s:MapSector)=>void)[] = [];
        const changesSide : ((s:MapSide)=>void)[] = [];
        let any_change = false;

        const old_sec = curmap.value.sectors[focus.value.sector];
        const nw_sec = focus.value.sector_def;
        const old_sid = curmap.value.sectors[focus.value.sector].side[focus.value.side]
        const nw_sid = focus.value.side_def;
        if (old_sec.action != nw_sec.action) changesSector.push((s:MapSector)=>s.action = nw_sec.action);
        if (old_sec.ceil != nw_sec.ceil) changesSector.push((s:MapSector)=>s.ceil = nw_sec.ceil);
        if (old_sec.flags != nw_sec.flags) changesSector.push((s:MapSector)=>{
            s.flags &= old_sec.flags & ~nw_sec.flags;
            s.flags |= nw_sec.flags & ~old_sec.flags;
        });
        if (old_sec.floor != nw_sec.floor) changesSector.push((s:MapSector)=>s.floor =nw_sec.floor);
        if (old_sec.target_sector != nw_sec.target_sector || old_sec.target_side != nw_sec.target_side) changesSector.push((s:MapSector)=>{
            s.target_sector = nw_sec.target_sector;
            s.target_side = nw_sec.target_side;
        }); 
        if (old_sec.exit.findIndex((x,idx)=>x != nw_sec.exit[idx]) != -1) {
            changesSector.push((s:MapSector)=>{
                s.exit = shallowClone(s.exit);
                nw_sec.exit.forEach((x,idx)=>{if (x != old_sec.exit[idx]) s.exit[idx] = x;});                    
            });
        }

        if (old_sec.type != nw_sec.type) changesSector.push((s:MapSector)=>s.type =nw_sec.type);

        if (old_sid.primary != nw_sid.primary) changesSide.push((s:MapSide)=>s.primary = nw_sid.primary);
        if (old_sid.secondary != nw_sid.secondary) changesSide.push((s:MapSide)=>s.secondary = nw_sid.secondary);
        if (old_sid.arc != nw_sid.arc) changesSide.push((s:MapSide)=>s.arc = nw_sid.arc);
        if (old_sid.target_sector != nw_sid.target_sector) changesSide.push((s:MapSide)=>s.target_sector = nw_sid.target_sector);
        if (old_sid.target_side != nw_sid.target_side) changesSide.push((s:MapSide)=>s.target_side = nw_sid.target_side);
        if (old_sid.action != nw_sid.action) changesSide.push((s:MapSide)=>s.action = nw_sid.action);
        if (old_sid.flags != nw_sid.flags) {
            const f_add = ~old_sid.flags & nw_sid.flags;
            const f_rem = ~old_sid.flags | nw_sid.flags;
            changesSide.push((s:MapSide)=>s.flags = (s.flags & f_rem)|f_add);
        }
        if (JSON.stringify(old_sid.actions) != JSON.stringify(focus.value.script.actionList)) {
            const diff = create_array_diff<TMA_GEN>(old_sid.actions, toRaw(focus.value.script.actionList), (a,b)=>{
                return JSON.stringify(a) == JSON.stringify(b);
            })
            changesSide.push((s:MapSide)=>{
                s.actions = apply_array_diff(s.actions, diff, (a,b)=>{
                    return a._action == b._action && a.flags == b.flags;
                });
            });
        }

        if (changesSector.length || changesSide.length) {
            any_change = true;
            const m  = begin_edit();
            m.sectors = shallowClone(m.sectors)
            if (changesSector.length) {
                if (selection.value?.length  && applyMode.value != ApplyMode.ACTIVE.v && applyMode.value != ApplyMode.BOTH_SIDES.v) {            
                    selection.value.forEach(sect=>{
                        const s = m.sectors[sect] = shallowClone(m.sectors[sect]);
                        for (const f of changesSector) f(s);
                        
                    });
                } else {
                    const s = m.sectors[focus.value.sector] = shallowClone(m.sectors[focus.value.sector]);
                    for(const f of changesSector) f(s);
                }
            }

            if (changesSide.length) {
                if (applyMode.value == ApplyMode.ACTIVE.v || applyMode.value == ApplyMode.BOTH_SIDES.v) {
                    const s = m.sectors[focus.value.sector] = shallowClone(m.sectors[focus.value.sector]);
                    s.side = shallowClone(s.side);
                    const sid = s.side[focus.value.side] = shallowClone(s.side[focus.value.side]);
                    for (const f of changesSide) f(sid);
                    if (applyMode.value == ApplyMode.BOTH_SIDES.v) {
                        const s2num = s.exit[focus.value.side];
                        if (s2num) {
                            const sid2num = (focus.value.side+2) & 3;
                            const s2 = m.sectors[s2num] = shallowClone(m.sectors[s2num]);
                            s2.side = shallowClone(s2.side);
                            const sid2 = s2.side[sid2num] = shallowClone(s2.side[sid2num]);
                            for (const f of changesSide) f(sid2);
                        }
                    }
                } else if (selection.value?.length) {
                    const selset = new Set<number>();
                    selection.value.forEach(sect=>selset.add(sect));
                    let filter : ((sect:number,sid:number)=>boolean)|null = null;
                    switch (applyMode.value) {
                        case ApplyMode.ALL_SIDES.v: filter = ()=>true;break;
                        case ApplyMode.SELECTION_DIR.v: filter = (_,sid)=>sid == focus.value?.side;break;
                        case ApplyMode.EDGE_SIDES.v: filter = (sect,sid)=>m.sectors[sect].exit[sid] == 0;break;
                        case ApplyMode.INNER_SIDES.v: filter = (sect,sid)=>selset.has(m.sectors[sect].exit[sid]);break;
                        case ApplyMode.PERIMETER.v: filter = (sect,sid)=>m.sectors[sect].exit[sid]!=0 && !selset.has(m.sectors[sect].exit[sid]);break;
                        case ApplyMode.EAST.v: filter = (sect,sid)=>sid==3;break;
                        case ApplyMode.WEST.v: filter = (sect,sid)=>sid==1;break;
                        case ApplyMode.NORTH.v: filter = (sect,sid)=>sid==0;break;
                        case ApplyMode.SOUTH.v: filter = (sect,sid)=>sid==2;break;
                    }
                    if (filter) {
                        selection.value.forEach((sect)=>{
                            for (let i = 0; i < 4; ++i) {
                                if (filter(sect, i)) {
                                    const s = m.sectors[sect] = shallowClone(m.sectors[sect]);
                                    s.side = shallowClone(s.side);
                                    const sid = s.side[i] = shallowClone(s.side[i]);
                                    for (const f of changesSide) f(sid);
                                }
                            }
                        });
                    }
                }
            }
            if (focus.value.script.stringTable) {
                m.strtable = focus.value.script.stringTable;
            }
            if (any_change) {
                end_edit(m);
                updateFocusData(focus.value.sector, focus.value.side);
                StatusBar.invoke_teleport();
            }
        }
    }
}

function create_niche() {
    const def : NicheDef = {items:[],xpos:250,ypos:160,xs:160,ys:80};
    curNiche.value = def;    
}
function open_niche() {
    const n = focus.value;
    if (n) {
        const cn = shallowClone(n.side_def.niche);
        if (cn) {
            cn.items = shallowClone(cn.items);
        }
        curNiche.value = cn;
    }
    
}
function save_niche(n: NicheDef|null) {
    const f = focus.value;
    if (f) {
        const mp = begin_edit();
        mp.sectors = shallowClone(mp.sectors);
        const sec = mp.sectors[f.sector] = shallowClone(mp.sectors[f.sector]);
        sec.side = shallowClone(sec.side);
        const sid = sec.side[f.side] = shallowClone(sec.side[f.side]);
        sid.niche = n;
        end_edit(mp);
        updateFocusData(f.sector,f.side);
    }
}

function save_cur_niche() {
    save_niche(curNiche.value);
    curNiche.value = null;
}

function delete_cur_niche() {
    save_niche(null);
    curNiche.value = null;
}
function goto_sector_open(ev: Event) {
    if (goto_sector_dlg.value) return;
    ev.stopPropagation();
    ev.preventDefault();
    if (focus.value) goto_sector_n.value = focus.value.sector;
    goto_sector_dlg.value = true;
}

function goto_sector_find() {
    const s = goto_sector_n.value;
    const m = curmap.value;
    if (s && m) {
        const l = m.sectors[s].level;
        settings.curlevel = l;
        updateFocusData(s, focus.value?.side || 0);
        updateFocus();
    }
    setTimeout(()=>goto_sector_dlg.value = false,1);
}

function open_map_settings() {
    map_settings.value = curmap.value.info;
    queueMicrotask(()=>{
        const w = watch(map_settings,()=>{
            if (map_settings.value) {
                const map = begin_edit();
                map.info = map_settings.value;
                end_edit(map);
                queueMicrotask(()=>{
                    map_settings.value = undefined;
                });
            }
            w.stop();
        });
    });
}

watch(goto_sector_input,()=>{
    const el = goto_sector_input.value;
    if (el) {
        const close = (ev:Event)=>{
            const target = ev.target as HTMLElement
            const p = el.parentElement;            
            if (target.parentElement == el.parentElement) return;
            goto_sector_dlg.value = false;
            window.removeEventListener("click",close);
        };
        el.focus();
        el.select();
        el.addEventListener("keydown",(e:KeyboardEvent)=>{
            if (e.key == "Enter") {
                goto_sector_find();
            }
        });
        window.addEventListener("click",close);
    }
})


const ds_wallassets = create_datalist();
watch(list_assets, (nw)=>ds_wallassets.update(()=>nw.map(k=>({value:k}))));
watch(map_filename, (nw)=>{
    if (nw) {
        StatusBar.set_map_switch(nw,()=>{
            open_map_dlg.value = true;
        });
        loadMap(nw)        
    }
});
watch(()=>props.active, ()=>{
    const a = props.active;
    if (a) {
        init_save_state();
        reload_all_lists();
        open_map_prompt();
    } else {
        save_state.unmount();
    }
})
watch(mapview,()=>{
    if (mapview.value){
        mapcontainer.add_to_DOM(mapview.value);        
    }    
})

</script>

<template>

<x-workspace :hidden="!props.active">
<template v-if="map_filename">
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
    <div class="sep" @click="ev=>goto_sector_open(ev)":class="{disabled: settings.edit_mode == EditMode.Draw || settings.edit_mode == EditMode.Erase}"><img src="@/assets/toolbar/srch_sec.svg">
        <div v-if="goto_sector_dlg" class="gotosec">
            <input type="number" ref="goto_sector_input" v-model="goto_sector_n" v-watch-range min="1" :max="curmap.sectors.length-1"><button @click="goto_sector_find">Go</button>
        </div>
    </div>
    <div class="sep" @click="open_map_settings"><img src="@/assets/toolbar/gear.svg"></div>
</div>
<div class="middle">
    <div class="middle-split">
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
</div>    
<div class="right draw"  v-if="settings.edit_mode == EditMode.Draw || settings.edit_mode == EditMode.Erase">        
    <div class="palette">
        <div><span class="title">Draw settings</span><x-form>
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
        <div class="h"><span class="title">Wall</span><PalleteEditor v-model:palette="mapLoadedPalettes.wall_palette" :listview="true" v-model:selection="settings.wall" type="wall" :wall_assets="ds_wallassets"></PalleteEditor></div>
        <div class="h"><span class="title">Arc</span><PalleteEditor v-model:palette="mapLoadedPalettes.arc_palette" :listview="true" v-model:selection="settings.arc" type="arc" :wall_assets="ds_wallassets"></PalleteEditor></div>
        <div class="h"><span class="title">Floor</span><PalleteEditor v-model:palette="mapLoadedPalettes.floor_pallete" :listview="true" v-model:selection="settings.floor" type="floor" :wall_assets="ds_wallassets"></PalleteEditor></div>
        <div class="h"><span class="title">Ceil</span><PalleteEditor v-model:palette="mapLoadedPalettes.ceil_palette" :listview="true" v-model:selection="settings.ceil"  type="ceil" :wall_assets="ds_wallassets"></PalleteEditor></div>
    </div>
</div>
<div class="right side" v-if="settings.edit_mode == EditMode.Edit && focus && focus.sector > 0 && wall_props">
        <div v-for="(s,n) of SideFlagsNames_All" :key="n"><span class="title">{{ s.t }}</span>
        <x-form>
            <label v-for="(v,k) of s.f" :key="k">
                <input type="checkbox" @change="focus.side_def.flags^=SideFlag[k]" :checked="(focus.side_def.flags & SideFlag[k])!=0">
                <span> {{ v }}</span>
            </label>
            <label v-if="n == 'side_barriers'"><input type="checkbox" v-model="focus.side_def.item_can_be_placed_behind">Item can be placed behind wall</input></label>
        </x-form>
        </div>
        <div v-if="action_ui || focus.side_def.action"><span class="title">Action</span>
        <x-form>
            <div class="label"><span>Target</span><div>            
                <button :disabled="(link?.side || 0) == -1" @click="focus.side_def.target_sector=link?.sector || 0;focus.side_def.target_side = link?.side || 0"> Side {{ focus.side_def.target_sector }}:{{focus.side_def.target_side }} </button>
                <button :disabled="focus.side_def.target_sector == 0" @click="focus.side_def.target_sector = focus.side_def.target_side = 0">X</button>
            </div></div>
            <label><span>Type</span><select v-model="focus.side_def.action">
                <option v-for="v of SimpleActionType" :key="v" :value="v"> {{ SimpleActionTypeName[v]}}</option>
            </select></label>
            <label v-for="(v,k) of SideFlagsNames_Actions" :key="k">
                <input type="checkbox" @change="focus.side_def.flags^=SideFlag[k]" :checked="(focus.side_def.flags & SideFlag[k])!=0">
                <span> {{ v }}</span>
            </label>
        </x-form>
        </div>
        <div  v-if="focus.side_def.action"><span class="title">Action changes:</span>
            <x-form>
                <label v-for="(v,k) of SideFlagsNames_Changes" :key="k">
                    <input type="checkbox" @change="focus.side_def.flags^=SideFlag[k]" :checked="(focus.side_def.flags & SideFlag[k])!=0">
                    <span> {{ v }}</span>
                </label>
            </x-form>
        </div>
        <div class="actui">
            <x-form>
                <label><input type="checkbox" v-model="action_ui"><span>Show old action UI</span></label>
            </x-form>
        </div>

</div>                        
<div class="right edit" v-if="settings.edit_mode == EditMode.Edit">
    <div class="palette" v-if="focus && focus.sector > 0" >
        <div><span class="title"><button class="link" @click="link = {sector: focus.sector, side: -1}"></button> Sector {{ focus.sector }}</span><x-form>
            <label><span>Type</span><select v-model="focus.sector_def.type" size="1">
            <option v-for="v of SectorTypeName.map((x,idx)=>[x,idx]).filter(x=>x[1])" :key="v[1]" :value="v[1]">{{ v[0] }}</option>
            </select></label>
            <label><span>Ceil</span><PalleteEditor v-model:palette="mapLoadedPalettes.ceil_palette" :listview="false" v-model:selection="focus.sector_def.ceil" type="ceil" :wall_assets="ds_wallassets"></PalleteEditor></label>
            <label><span>Floor</span><PalleteEditor v-model:palette="mapLoadedPalettes.floor_pallete" :listview="false" v-model:selection="focus.sector_def.floor" type="floor" :wall_assets="ds_wallassets"></PalleteEditor></label>
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
        </x-form>
        </div>
        <div><span class="title"><button class="link" @click="link = {sector: focus.sector, side: focus.side}"></button> Side {{ focus.sector }}:{{ focus.side }} [{{ focus.sector * 4 + focus.side }}]</span>
        <x-form>
        <label><span>Primary</span><PalleteEditor v-model:palette="mapLoadedPalettes.wall_palette" :listview="false" v-model:selection="focus.side_def.primary" type="wall" :wall_assets="ds_wallassets"></PalleteEditor></label>
        <label><span>Secondary</span><PalleteEditor v-model:palette="mapLoadedPalettes.wall_palette" :listview="false" v-model:selection="focus.side_def.secondary" type="wall" :wall_assets="ds_wallassets"></PalleteEditor></label>
        <label><span>Arc</span><PalleteEditor v-model:palette="mapLoadedPalettes.arc_palette" :listview="false" v-model:selection="focus.side_def.arc" type="arc" :wall_assets="ds_wallassets"></PalleteEditor></label>
        <div class="label"><span>Exit</span><div>
            <button :disabled="!link" @click="focus.sector_def.exit[focus.side] = link?.sector || 0">Sector {{ focus.sector_def.exit[focus.side] }}</button>
            <button :disabled="focus.sector_def.exit[focus.side] == 0" @click="focus.sector_def.exit[focus.side] = 0">X</button>
        </div>
        </div>
        <div>
            <button @click="wall_props = !wall_props" class="wallprops" :class="{open:wall_props}">Flags</button>
        </div>

        </x-form>
        </div>
        <div class="maevents"><span class="title">Scripts (Multiactions)</span>
            <div>
            <MultiactionEditor v-model="focus.script"></MultiactionEditor>
            </div>
        </div>
        <div class="apply"><span class="title">Apply changes</span>
        <x-form>
            <label><span>Apply to side:</span>
                <select v-model="applyMode">
                    <template v-for="(v,n) of ApplyMode" :key="n">
                        <option v-if="selection?.length || v.v < 0" :value="v.v"> {{ v.t }}</option>
                    </template>
                </select>
            </label>
            <button class="big-apply" @click="applyChanges">Apply</button>
        </x-form>
        </div>
        <div><span class="title">Niche</span>
            <div class="buttons">
            <button v-if="!focus.side_def.niche" @click="create_niche">Create</button>
            <button v-if="focus.side_def.niche" @click="open_niche">Edit</button>
            </div>
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
<NicheEditor v-if="curNiche != null" v-model="curNiche" @ok="save_cur_niche" @cancel="curNiche=null" @delete="delete_cur_niche" :side="focus!.side_def"></NicheEditor>
</template>
<template v-else>
<div class="open-map-hlp"><div></div></div>
</template>
</x-workspace>
<MapSelectDlg v-model:filename="map_filename" v-model:show="open_map_dlg"></MapSelectDlg>
<MapSettingsDlg v-model="map_settings"></MapSettingsDlg>
</template>

<style lang="css" scoped>
x-workspace {
    display: flex;
    align-items: stretch;
    height: 100%;
    background-color: #aaa;
}
x-workspace > * {
       background-color: #ccc;
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
    position: relative;
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
    width: 17rem;
    height: 100%;
    overflow: auto;
}

.right .palette {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 0.4rem;
    box-sizing: border-box;
}

.right x-form {
    margin:0  0.4rem;
}


.right .palette div {
    flex-grow: 0;    
}

.right .palette > div.h {
    display: flex;
    flex-direction: column;    
    flex-grow: 1;
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

.palette > div {
    overflow: auto;
    position: relative;
}

.palette > div > span.title {
    height: 1.4rem;
    line-height: 1.4rem;
    font-weight: bold;
    display: block;
    background-color: #aaa;

}
.middle-split {
    display:flex;
    flex-direction: column;
    height: 100%;
}

.right.side {
    display:flex;
    flex-direction: column;
    background-color: #aaa;
    gap: 1px;
}
.right.side > * {
    position:relative;
    background-color: #ccc;
    margin-top: 1px;
    flex-grow: 1;
}

.right.side > * > span.title {
    padding-left: 1rem;
    background-color: #eee;
    font-weight: bold;
    display:block;
}

.change-flags {
    position: absolute;
    right: 0rem;
    bottom: 90%;
    background-color: #ddd;
    padding: 2rem 0.5rem 0.5rem 0.5rem;
    border: 1px solid;
    box-shadow: 3px 3px 5px black;
}
.big-apply {
    display: block;
    width: 100%;
    box-sizing: border-box;
    font-size: 1.5rem;
}
.right .palette div.maevents {
    flex-grow: 1;
}

.right {
    margin-left: 1px;
}

.maevents {
    position:relative;
}
.maevents > span {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
}
.maevents > div {
    height: 100%;
    box-sizing: border-box;
    padding-top: 1.5rem;
}
.open-map-hlp {
    position: absolute;
    inset: 0;
    background-color: #ccc;
}
.open-map-hlp > div{
    position: absolute;
    bottom: 0;
    left:15rem;
    background-color: transparent;
}
.open-map-hlp >div::before {
    content: "↙";
    font-size: 2rem;
    vertical-align: top;
}
.open-map-hlp >div::after {
    content: " Open a map";
    vertical-align: top;
}
.gotosec {
    position: absolute;
    background-color: white;
    width: 9rem;
    z-index: 1;
    left: 3rem;
    top: 0;
    padding: 0.2rem;
    border: 1px solid;
    box-shadow: 3px 3px 6px black;
}
.gotosec input {
    width: 5rem;
    text-align: center;
}
.right.side .actui {
    flex-grow: 0;
}
.wallprops {
    position: relative;
    padding: 0.5rem 0.5rem 0.5rem 1.2rem 
}
.wallprops::before {
    display: block;
    position: absolute;
    content: "«";
    font-size: 1.5rem;
    inset: 0;
    margin: auto;
    text-align: left;

}
.wallprops.open::before {
    content: "»";
}

</style>