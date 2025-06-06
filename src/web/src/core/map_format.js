import { BinaryIterator, loadBinaryContent } from "./binary.js"
import * as ActionDef from "./action_script.js"


export const MapSections = Object.freeze({
    SIDEMAP: 0x8001,
    SECTMAP: 0x8002,
    STRTAB1: 0x8003, // stena main
    STRTAB2: 0x8004, // stena leva
    STRTAB3: 0x8005, // stena prava
    STRTAB4: 0x8006, // strop
    STRTAB5: 0x8007, // podlaha
    STRTAB6: 0x8008, // oblouk levy
    MAPINFO: 0x8009,
    MAPGLOB: 0x800A,
    STRTAB7: 0x800B, // oblouk pravy
    MAPITEM: 0x800C, // itemy
    MAPMACR: 0x800D, // Makra multiakce
    MAPFLY: 0x800E, // Letajici predmety
    MAPMOBS: 0x800F, // Potvory v bludišti
    MAPVYK: 0x8010, // Vyklenky
    MOBS: 0x8011, // Potvory definice
    MOBSND: 0x8012, // Potvory zvuky
    PASSW: 0x8013, // Heslo 1
    PASSW2: 0x8014, // Heslo 2
    MAPEND: 0x8000
});

export const SectorType = Object.freeze({
    Empty: 0,
    Normal: 1,
    Stairs: 2,
    Ship: 3,
    Lava: 4,
    DirectEnemyNorth: 5,
    DirectEnemyEast: 6,
    DirectEnemySouth: 7,
    DirectEnemyWest: 8,
    Water: 9,
    Column: 10,
    Pit: 11,
    Teleport: 12,
    Button: 13,
    ButtonPressed: 14,
    FluteNorth: 15,
    FluteEast: 16,
    FluteSouth: 17,
    FluteWest: 18,
    LeavePlace: 19,
    Whirpool: 20,
    DeathColumn: 21,
    Acid: 22
})

export const SideFlag = Object.freeze({
    AUTOMAP: 0x1,
    PLAY_IMPS: 0x2,
    MONST_IMPS: 0x4,
    THING_IMPS: 0x8,
    SOUND_IMPS: 0x10,
    ALARM: 0x20,
    PASS_ACTION: 0x40,
    TRANSPARENT: 0x80,
    PRIM_ANIM: 0x100,
    PRIM_VIS: 0x200,
    PRIM_GAB: 0x400,
    PRIM_FORV: 0x800,
    SEC_ANIM: 0x1000,
    SEC_VIS: 0x2000,
    SEC_GAB: 0x4000,
    SEC_FORV: 0x8000,
    LEFT_ARC: 0x10000,
    RIGHT_ARC: 0x20000,
    DOUBLE_SIDE: 0x40000,
    SPEC: 0x80000,
    COPY_ACTION: 0x100000,
    SEND_ACTION: 0x200000,
    APPLY_2ND: 0x400000,
    AUTOANIM: 0x800000,
    SECRET: 0x20000000,
    TRUESEE: 0x40000000,
    INVIS: 0x80000000
});

export const SectorTypeFromNumber = (()=>{
    const arr = [];
    for (const [key, value] of Object.entries(SectorType)) {
        arr[value] = key;
    }
    return arr;
})();

export const TSECTOR  = {
    floor:"uint8",
    ceil:"uint8",
    flags:"uint8",
    type:"uint8",
    action:"uint8",
    target_side:"uint8",
    exit: ["uint16",4],
    target_sector:"uint16"
};

export const TSIDE = {
    prim:"uint8",
    sec:"uint8",
    oblouk:"uint8",
    target_side:"uint8",
    target_sector:"uint16",
    xsec:"uint8",
    ysec:"uint8",
    flags:"uint32",
    prim_anim:"uint8",
    sec_anim:"uint8",
    lclip:"uint8",
    action:"uint8",
};

export const TNICHE = {
    sector:"int16",
    dir:"int16",
    xpos:"int16",
    ypos:"int16",
    xs:"int16",
    ys:"int16",
    items:["int16",9],
    reserved:"int16"
};

export const TMAP_LAYOUT = {
    x: "int16",
    y: "int16",
    layer: "int16",
    flags: "int16"
};

export const MAPGLOBAL =  {
 back_fnames:["char[13]",4],
 fade_r:"int32",
 fade_g:"int32",
 fade_b:"int32",
 start_sector:"int32",
 start_direction:"int32",
 mapname:"char[30]",
 map_effector:"uint8",
 local_monsters:"uint8", 
 map_autofadefc:"uint8" 
};


export const TMA_SOUND = {
    action: "uint8",
    flags: "uint16",    
    bit16: "uint8",
    volume: "uint8",
    soundid: "uint8",
    freq: "uint16",
    start_loop: "int32",
    end_loop: "int32",
    offset: "int32",
    filename: "char[12]"
};

export const TMA_GEN = {
    action: "uint8",
    flags: "uint16",    
}

export const TMA_TEXT = {
    action: "uint8",
    flags: "uint16",    
    pflags: "uint8",
    textindex: "int32"
};

export const TMA_SEND_ACTION = {
    action: "uint8",
    flags: "uint16",    
    change_bits: "uint8",
    sector: "uint16",
    side: "uint16",
    s_action: "uint16",
    delay: "uint8"
};

export const TMA_FIREBALL = {
    action: "uint8",
    flags: "uint16",    
    xpos: "int16",
    ypos: "int16",
    zpos: "int16",
    speed: "int16",
    item: "int16"
};

export const TMA_LOADLEV = {
    action: "uint8",
    flags: "uint16",    
    start_pos: "int16",
    dir: "uint8",
    name: "char[13]"
};

export const TMA_DROPITM = {
    action: "uint8",
    flags: "uint16",    
    item: "int16"
};

export const TMA_CODELOCK = {
    action: "uint8",
    flags: "uint16",    
    znak: "char",
    string: "char[8]",
    codenum: "char"
};

export const TMA_CANCELACTION = {
    action: "uint8",
    flags: "uint16",    
    pflags: "uint8",
    sector: "int16",
    dir: "int16"
};

export const TMA_SWAPS = {
    action: "uint8",
    flags: "uint16",    
    pflags: "uint8",
    sector1: "int16",
    sector2: "int16"
};

export const TMA_WOUND = {
    action: "uint8",
    flags: "uint16",    
    pflags: "uint8",
    minor: "int16",
    major: "int16"
};

export const TMA_LOCK = {
    action: "uint8",
    flags: "uint16",    
    key_id: "int16",
    thieflevel: "int16"
};

export const TMA_TWOP = {
    action: "uint8",
    flags: "uint16",    
    parm1: "int16",
    parm2: "int16"
};

export const TMA_UNIQUE = {
    action: "uint8",
    flags: "uint16",    
    item: "TITEM"
};

export const TMA_GLOBE = {
    action: "uint8",
    flags: "uint16",    
    event: "uint8",
    sector: "uint16",
    side: "uint8",
    cancel: "uint8",
    param: "uint32"
};

export const TMA_IFSEC = {
    action: "uint8",
    flags: "uint16",    
    side: "uint8",
    sector: "uint16",
    line: "int16",
    invert: "uint8"
};

const action_to_schema = [
   TMA_GEN,TMA_SOUND,TMA_TEXT,TMA_TEXT,
   TMA_SEND_ACTION,TMA_FIREBALL,TMA_GEN,TMA_LOADLEV,
   TMA_DROPITM,TMA_TEXT,TMA_TEXT,TMA_CODELOCK,
   TMA_CANCELACTION,TMA_LOCK,TMA_SWAPS,TMA_WOUND,
   TMA_TWOP,TMA_TWOP,TMA_TWOP,TMA_TEXT,TMA_TWOP,
   TMA_TWOP,TMA_TWOP,TMA_LOADLEV,TMA_DROPITM,
   TMA_TWOP,TMA_TWOP,TMA_UNIQUE,TMA_TWOP,TMA_UNIQUE,
   TMA_TWOP,TMA_LOADLEV,TMA_TWOP,TMA_LOADLEV,
   TMA_TWOP,TMA_TWOP,TMA_TEXT,TMA_GLOBE,TMA_IFSEC,TMA_TWOP
]



export function loadMapAsSections(binaryContent) {
    let iter = new BinaryIterator(binaryContent);
    let result = [];
    do {
        const header =iter.parse({tag:"char[8]",
                                type:"uint32",
                                size:"uint32",
                                ofs:"uint32"});
        const data = iter.readBytes(header.size);
        if (header.type == MapSections.MAPEND) return result;
        result.push([header.type, data]);
    } while (true);
}

function loadArray(data, schema) {
    const r = [];
    let iter = new BinaryIterator(data);
    while (!iter.eof()) {
        r.push(iter.parse(schema));
    }
    return r;
}

function loadStringTables(data) {
    let iter = new BinaryIterator(data);
    let r = [];
    while (!iter.eof()) {
        r.push(iter.parse_stringz());
    }
    return r;
}

function parseMapItem(data) {
    let iter = new BinaryIterator(data);
    let res = []
    while (!iter.eof()) {
        let place = iter.parse_type("int32");
        let n = iter.parse_type("uint16");
        let items = [];
        while (n != 0) {
            items.push(n);
            n = iter.parse_type("uint16");
        }
        let sector = Math.floor(place/4);
        let side = place % 4;
        res.push([sector,side, items]);
    }
    return res;
}

function parseMapMobs(data) {
    let iter = new BinaryIterator(data);
    let res = [];
    while (!iter.eof()) {
        const def = iter.parse({
            "sector":"int16",
            "def":"uint16"
        });

        res.push([def.sector,def.def >> 14, def.def & 0x3FFF])
    }
    return res;
}

function parseNiche(data) {
    const n = loadArray(data, TNICHE);
    const r = [];
    for (const x of n) {
        if (x.sector) {
            r.push([x.sector,x.dir,{
                xpos: x.xpos,
                ypos: x.ypos,
                xs: x.xs,
                ys: x.ys,
                items: x.items.filter(z=>z !=0)
            }]);
        }
    }
    return r;
}

function parseActionScripts(data) {
    const r = [];
    let iter = new BinaryIterator(data);
    while (!iter.eof()) {
        const sectorside = iter.parse_type("uint32");
        if (sectorside == 0) break;
        const sector = sectorside >> 2;
        const side = sectorside & 0x3;
        let lst = []; 
        let size = iter.parse_type("uint32");
        while (size) {
            const action = iter.readBytes(size);
            let iter2 = new BinaryIterator(action);
            const a = iter2.parse_type("uint8");
            const atype = a & 0x3F;
            const cancel = (a & 0x40) != 0;
            const once = (a & 0x80) != 0;
            if (!action_to_schema[atype]) {
                throw new Error("invalid action");
            }

            iter2 = new BinaryIterator(action);
            const action_def = iter2.parse(action_to_schema[atype]);
            const flags = action_def.flags;
            action_def.action = atype;
            action_def.flags = {
                on_pass: (flags & 0x1) != 0,
                on_pass_failed: (flags & 0x2) != 0,
                on_touch: (flags & 0x4) != 0,
                on_touch_failed: (flags & 0x8) != 0,
                on_lock_info: (flags & 0x10) != 0,
                on_leave: (flags & 0x20) != 0,
                on_action: (flags & 0x40) != 0,
                on_start: (flags & 0x80) != 0,
                on_door_closed: (flags & 0x100) != 0,
                on_every_frame: (flags & 0x200) != 0,
                on_every_other_frame: (flags & 0x400) != 0,
                on_action_executed: (flags & 0x800) != 0,
                on_specproc: (flags & 0x1000) != 0,
                on_door_opened: (flags & 0x2000) != 0,
                on_niche_action: (flags & 0x4000) != 0,
                on_pass: (flags & 0x8000) != 0,
            }
            if (action_def.change_bits) {
                const b = action_def.change_bits;
                action_def.change_bits = {
                    automap: (b & 0x1) != 0,
                    player_can_pass: (b & 0x2) != 0,
                    enem_can_pass: (b & 0x4) != 0,
                    item_can_pass: (b & 0x8) != 0,
                    sound_can_pass: (b & 0x16) != 0,
                }
            }
            action_def.cancel = cancel;
            action_def.once = once;
            lst.push(action_def);
            size = iter.parse_type("uint32");
        }
        r.push([sector,side, lst]);
    }
    return r;

}

export function loadMap(binaryContent) {
    const sects = loadMapAsSections(binaryContent);
    const ret = {};
    for (const [type, data] of sects) {
        switch (type) {
            case MapSections.SIDEMAP:
                ret.sides = loadArray(data, TSIDE);
                break;
            case MapSections.SECTMAP:
                ret.sectors = loadArray(data, TSECTOR);
                break;
            case MapSections.STRTAB1:
                ret.files_main = loadStringTables(data);
                break;
            case MapSections.STRTAB2:
                ret.files_left = loadStringTables(data);
                break;
            case MapSections.STRTAB3:
                ret.files_right = loadStringTables(data);
                break;
            case MapSections.STRTAB4:
                ret.files_ceil = loadStringTables(data);
                break;
            case MapSections.STRTAB5:
                ret.files_floor = loadStringTables(data);
                break;
            case MapSections.STRTAB6:
                ret.arc_left = loadStringTables(data);
                break;
            case MapSections.MAPINFO:
                ret.layout = loadArray(data, TMAP_LAYOUT);
                break;
            case MapSections.MAPGLOB:
                ret.map_globals = (new BinaryIterator(data)).parse(MAPGLOBAL);
                break;
            case MapSections.STRTAB7:
                ret.arc_right = loadStringTables(data);
                break;
            case MapSections.MAPITEM:
                ret.items = parseMapItem(data);
                break;
            case MapSections.MAPMOBS:
                ret.enemies = parseMapMobs(data);
                break;
            case MapSections.MAPMACR:
                ret.action_scripts = parseActionScripts(data);
                break;
            case MapSections.MAPVYK:
                ret.niche =  parseNiche(data);
                break;
/*            case A_MOBS:
                ret.local_mob_defs = parseMobs(data);
                break;
            case A_MOBSND:
                ret.sounds = parseMobSnd(data);
                break;*/
        }
    }

    //build one object

    let map = ret.sectors.map((v,idx)=>{
        const s = {sector:v,side:[],loc:ret.layout[idx]};        
        for (let i = 0; i < 4; ++i) {
            s.side[i] = {
                wall: ret.sides[idx*4+i]
            };
        }
        return s;
    });
    if (ret.items) for (const [sector,side,v] of ret.items) {
        map[sector].side[side].items = v;
    }
    if (ret.action_scripts) for (const [sector,side,v] of ret.action_scripts) {
        map[sector].side[side].script = v;
    }
    if (ret.niche) for (const [sector,side,v] of ret.niche) {
        map[sector].side[side].niche = v;
    }
    if (ret.enemies) for (const [sector,side,v] of ret.enemies) {
        map[sector].enemy = {
            id:v,
            dir:side
        };
    }
    let files_sides = ret.files_main.map((v,idx)=>{
        return [v, ret.files_left[idx], ret.files_right[idx]];
    })
    let files_arc = ret.arc_left.map((v,idx)=>{
        return [v, ret.arc_right[idx]];
    })


    return {
        info: ret.map_globals,
        resources: {
            sides: files_sides,
            arcs: files_arc,
            floors: ret.files_floor,
            ceils: ret.files_ceil,            
        },
        map: map
    };
}


export async function loadMapFromURL(url) {
    const content = await loadBinaryContent(url);
    return loadMap(content);
}




