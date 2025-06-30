import { BinaryIterator, BinaryWriter, loadBinaryContent, parseSection, splitArrayBuffer, type Schema } from "./binary"
import { ItemDef, ItemSchema } from "./items_struct";
import { string_from_keybcs2 } from "./keybcs2";

const MapSections = {
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
} as const;


export const SectorType = {
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
} as const;

export const SectorTypeName = Object.entries(SectorType).reduce((a,b)=>{
                                a[b[1]] = b[0]; return a;}, [] as string[]);

export const SideFlag = {
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
} as const;


export const SectorFlags = {
    FloorModeMask: 0x7,
    CeilModeMask: 0x70,
    FloorAnim: 0x8,
    CeilAnim: 0x80,
 } as const;

 export const SectorFlags2={
    DarkFog: 0x100,        //fog to dark
    Secret: 0x800,          //can't be disclosed by automap
    NoSummon: 0x1000,       //summon fails
    Automapped: 0x1,        //visible on map (from beginning)    
 }

abstract class WithSchema  {
    abstract getSchema():Schema;
};



class TSECTOR extends WithSchema {

    floor: number = 0;
    ceil: number = 0;
    flags: number = 0;
    type: number = 0;
    action: number = 0;
    target_size :number = 0;
    target_sector: number = 0;
    exit: number[] = new Array(4).fill(0);

    getSchema() : Schema { return {
        floor:"uint8",
        ceil:"uint8",
        flags:"uint8",
        type:"uint8",
        action:"uint8",
        target_side:"uint8",
        exit: ["uint16",4],
        target_sector:"uint16"
    }};

};

class TSIDE extends WithSchema {

    prim:number=0;
    sec:number=0;
    oblouk:number=0;
    target_side:number=0;
    target_sector:number=0;
    xsec:number=0;
    ysec:number=0;
    flags:number=0;
    prim_anim:number=0;
    sec_anim:number=0;
    lclip:number=0;
    action:number=0;

    getSchema() : Schema { return {
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
     }};
     
};

class TNICHE extends WithSchema {

    sector:number=0;
    dir:number=0;
    xpos:number=0;
    ypos:number=0;
    xs:number=0;
    ys:number=0;
    items:number[]=new Array(9).fill(0);
    reserved:number=0;


    getSchema() : Schema { return {
        sector:"int16",
        dir:"int16",
        xpos:"int16",
        ypos:"int16",
        xs:"int16",
        ys:"int16",
        items:["int16",9],
        reserved:"int16"
    }};;
};

type NicheDef = Omit<TNICHE, "sector" | "dir">;


class TMAP_LAYOUT extends WithSchema {

    x:number=0;
    y:number=0;
    layer:number=0;
    flags:number=0;

    getSchema() : Schema { return {
        x: "int16",
        y: "int16",
        layer: "int16",
        flags: "int16"
    }};;
};

class MAPGLOBAL extends WithSchema {

    back_fnames:string[]=new Array(4).fill("");
    mapname:string="";
    fade_r:number=0;
    fade_g:number=0;
    fade_b:number=0;
    start_sector:number=0;
    start_direction:number=0;
    map_effector:number=0;
    local_monsters:number=0;
    map_autofadefc:number=0;

    getSchema() : Schema { return {
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
    }};;
};

class MAP_ITEM_PLACES  {
    
    item_map:Map<number, number[]> = new Map<number, number[]>();


    parse(iter: BinaryIterator) {
        while (!iter.eof()) {
            let place = iter.parse_type("int32");
            let n = iter.parse_type("uint16");
            let items = [];
            while (n != 0) {
                items.push(n);
                n = iter.parse_type("uint16");
            }
            this.item_map.set(place, items);
        }
    }

    serialize(iter: BinaryWriter) {        
        this.item_map.forEach((v,k)=>{
            iter.write_type("int32", k);
            let n = v.length;
            v.forEach(w=>iter.write_type("uint16", w))            
        })
    }

    set(sector:number, side:number, items:number[]) {
        if (items.length) {
            this.item_map.set(sector * 4+side, items);
        } else {
            this.item_map.delete(sector * 4+side);
        }
    }
    get(sector:number, side:number): number[] {
        const k = sector * 4 + side ;
        return this.item_map.get(k) || [];
    }

}

type MapEnemyPlacement = {
    enemy_id: number;
    direction: number;
}


class MapEnemyMap extends Map<number, MapEnemyPlacement> {
    

    static Schema:Schema = {
        "sector":"int16",
        "def":"uint16"            
    }

    parse(iter: BinaryIterator) {
        while (!iter.eof()) {
            const def = iter.parse(MapEnemyMap.Schema);
            this.set(def.sector, {enemy_id: def.def & 0x3fff, direction: def.def >> 14});
        }
    }

    serialize(iter: BinaryWriter) {
        this.forEach((v,k)=> {
            const def = {
                sector: k,
                def : (v.direction << 14 | v.enemy_id)
            }
            iter.write(MapEnemyMap.Schema, def);
        });
    }
}


class NicheMap {

    map: Map<number, TNICHE> = new Map<number, TNICHE>;

    constructor(v: TNICHE[]) {
        v.forEach(w=>{
            this.set(w);
        })
    }

    set(def: TNICHE) {
        this.map.set(def.sector * 4 + def.dir, def);
    }

    get(sector: number, dir: number) : TNICHE | undefined{
        return this.map.get(sector * 4 + dir);
    }

    erase(sector: number, dir: number) {
         this.map.delete(sector * 4 + dir);;
    }

}


class TMA_GEN extends WithSchema {
    
    action:number = 0;
    flags:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
    }};;
};

class TMA_SOUND extends TMA_GEN {

    bit16:number=0;
    volume:number=0;
    soundid:number=0;
    freq:number=0;
    start_loop:number=0;
    end_loop:number=0;
    offset:number=0;
    filename: string = "";

    getSchema(): Schema { return {
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
    } };
};


class TMA_TEXT extends TMA_GEN{

    pflags:number = 0;
    textindex:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        pflags: "uint8",
        textindex: "int32"
    }};
}

class TMA_SEND_ACTION extends TMA_GEN {

    change_bits:number= 0;
    sector:number= 0;
    side:number= 0;
    s_action:number= 0;
    delay:number= 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        change_bits: "uint8",
        sector: "uint16",
        side: "uint16",
        s_action: "uint16",
        delay: "uint8"
    }};;
};

class TMA_FIREBALL extends TMA_GEN {

    xpos:number = 0;
    ypos:number = 0;
    zpos:number = 0;
    speed:number = 0;
    item:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        xpos: "int16",
        ypos: "int16",
        zpos: "int16",
        speed: "int16",
        item: "int16"
    }};;
};

class TMA_LOADLEV extends TMA_GEN {

    start_pos:number = 0;
    dir:number = 0;
    name:string = "";

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        start_pos: "int16",
        dir: "uint8",
        name: "char[13]"
    }};;
};

class TMA_DROPITM extends TMA_GEN {

    item: number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        item: "int16"
    }};;
};


class TMA_CODELOCK extends TMA_GEN {

    znak:string="";
    string: string = "";
    codenum: number =0;


    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        znak: "char[1]",
        string: "char[8]",
        codenum: "uint8"
    }};;
};

class TMA_CANCELACTION extends TMA_GEN {

    pflags:number = 0;
    sector:number = 0;
    dir:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        pflags: "uint8",
        sector: "int16",
        dir: "int16"
    }};;
};

class TMA_SWAPS extends TMA_GEN {

    pflags: number = 0;
    sector1: number = 0;
    sector2: number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        pflags: "uint8",
        sector1: "int16",
        sector2: "int16"
    }};;
};

class TMA_WOUND extends TMA_GEN {

    pflags:number = 0;
    minor:number = 0;
    major:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        pflags: "uint8",
        minor: "int16",
        major: "int16"
    }};;
};

class TMA_LOCK extends TMA_GEN {

    key_id: number = 0;
    thieflevel: number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        key_id: "int16",
        thieflevel: "int16"
    }};;
};

class TMA_TWOP extends TMA_GEN {

    parm1:number = 0;
    parm2:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        parm1: "int16",
        parm2: "int16"
    }};;
};

class TMA_UNIQUE extends TMA_GEN {
    
    item: ItemDef = new ItemDef();

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        item: ItemSchema
    }};;

};

class TMA_GLOBE extends TMA_GEN {

    event:number=0;
    sector:number=0;
    side:number=0;
    cancel:number=0;
    param:number=0;

    
    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        event: "uint8",
        sector: "uint16",
        side: "uint8",
        cancel: "uint8",
        param: "uint32"
    }};;
};

class  TMA_IFSEC extends TMA_GEN {

    side: number = 0;
    sector: number = 0;
    line: number = 0;
    invert: number = 0;

    
    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
        side: "uint8",
        sector: "uint16",
        line: "int16",
        invert: "uint8"
    }};
};

type ConstructorWithSchema<T extends WithSchema> = { new(): T };

function deserialize<T extends WithSchema>(cls: ConstructorWithSchema<T>, data: BinaryIterator): T {
    const instance = new cls();
    const schema = instance.getSchema();

    const raw = data.parse(schema);
    Object.assign(instance!, raw);
    return instance;
}

function serialize<T extends WithSchema>(wr: BinaryWriter, instance: T) {
    wr.write(instance.getSchema(), instance);
}

function deserialize_arr<T extends WithSchema>(cls:ConstructorWithSchema<T>, data:BinaryIterator): T[] {
    const res : T[] = [];
    while (!data.eof()) {
        res.push(deserialize(cls, data));
    }
    return res;
}

function serialize_arr<T extends WithSchema>(wr:BinaryWriter, instance: T[]) {
    instance.forEach(x=>serialize(wr, x));
}


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


class MapActionMap {
    map: Map<number, TMA_GEN[]> = new Map<number, TMA_GEN[]>;

    set(sector:number, side:number, def: TMA_GEN[]) {
        const k = sector * 4+side;
        if (def.length) {
            this.map.set(k, def);
        } else {
            this.map.delete(k);
        }
    }
    get(sector:number, side:number) : TMA_GEN[] {
        return this.map.get(sector * 4 + side) || [];
    }   


    parse(iter : BinaryIterator ) {
        while (!iter.eof()) {
            const sectorside = iter.parse_type("uint32");
            if (sectorside == 0) break;
            const sector = sectorside >> 2;
            const side = sectorside & 0x3;
            let size = iter.parse_type("uint32");
            const lst = [];
            while (size) {
                const action = iter.readBytes(size);
                let iter2 = new BinaryIterator(action);
                const a = iter2.parse_type("uint8");
                const atype = a & 0x3F;
                if (action_to_schema[atype]) {
                    iter2 = new BinaryIterator(action);
                    const action_def = deserialize(action_to_schema[atype], iter2);
                    lst.push(action_def);
                }
                size = iter.parse_type("uint32");
            }        
            this.set(sector, side,lst);
        }        
    }

    serialize(iter: BinaryWriter) {
        this.map.forEach((v,k)=>{
            iter.write_type("uint32",k);
            v.forEach(action=>{
                const wr = new BinaryWriter;
                serialize(wr,action);
                const buff = wr.getBuffer();
                iter.write_type("uint32", buff.byteLength);
                iter.write_buffer(buff);
            })
            iter.write_type("uint32", 0);
        });
    }
}


export class RawMapFile {

    sectors: TSECTOR[] = [];
    sides: TSIDE[] = [];
    info: MAPGLOBAL = new MAPGLOBAL;
    layout: TMAP_LAYOUT[] = [];
    items: MAP_ITEM_PLACES = new MAP_ITEM_PLACES;
    enemies: MapEnemyMap = new MapEnemyMap;
    niches: NicheDef[] = [];
    actions: MapActionMap = new MapActionMap;
    pixmap_front: string[] = [];
    pixmap_left: string[] = [];
    pixmap_right: string[] = [];
    pixmap_floor: string[] = [];
    pixmap_ceil: string[] = [];
    pixmap_arc_left: string[] = [];
    pixmap_arc_right: string[] = [];

    

    parseMap(buff : ArrayBuffer) {
        const iter = new BinaryIterator(buff);
        let nfo = parseSection(iter);
        const dec = new TextDecoder();

        while (nfo.type != MapSections.MAPEND) {
            switch (nfo.type) {
                case MapSections.SIDEMAP:
                    this.sides = deserialize_arr(TSIDE, new BinaryIterator(nfo.data))
                    break;
                case MapSections.SECTMAP:
                    this.sectors = deserialize_arr(TSECTOR, new BinaryIterator(nfo.data));
                    break;
                case MapSections.STRTAB1:
                    this.pixmap_front = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.STRTAB2:
                    this.pixmap_left = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.STRTAB3:
                    this.pixmap_right = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.STRTAB4:
                    this.pixmap_ceil = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.STRTAB5:
                    this.pixmap_floor = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.STRTAB6:
                    this.pixmap_arc_left = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.STRTAB7:
                    this.pixmap_arc_right = splitArrayBuffer(nfo.data,0).map(x=>dec.decode(x));
                    break;
                case MapSections.MAPINFO:
                    this.layout = deserialize_arr(TMAP_LAYOUT, new BinaryIterator(nfo.data));
                    break;
                case MapSections.MAPGLOB:
                    this.info = deserialize(MAPGLOBAL, new BinaryIterator(nfo.data))
                    break;
                case MapSections.MAPITEM:
                    this.items.parse(new BinaryIterator(nfo.data));
                    break;
                case MapSections.MAPMOBS:
                    this.enemies.parse(new BinaryIterator(nfo.data));
                    break;
                case MapSections.MAPMACR:
                    this.actions.parse(new BinaryIterator(nfo.data));
                    break;
                case MapSections.MAPVYK:
                    this.niches = deserialize_arr(TNICHE, new BinaryIterator(nfo.data))
                        .reduce((a,b)=>{
                            const place = b.sector * 4 + b.dir;
                            a[place] = b;
                            return a;
                        },[] as NicheDef[])
                    break;
            }
            nfo = parseSection(iter);
        }
        this.sides.forEach((m,idx)=>{
            const side = idx & 0x3;
            const xy = this.layout[idx >> 2];
            const alt = ((xy.x + xy.y + side) & 1) != 0;
            if (m.flags & SideFlag.DOUBLE_SIDE && alt) {
                m.prim -= (m.prim_anim & 0xF)+1;
            }
        })
    }
}

class WallGraphics {
    front: string = "";
    left: string = ""
    right: string = "";

    constructor(front?:string, left?:string, right?:string) {
        this.front = front || "";
        this.left = left || "";
        this.right= right || this.left;
    }

    get_key() : string {
        return `${this.front}|${this.left}|${this.right}`;
    }

}

class WallConfiguration {
    graphics: WallGraphics[] = [];
    anim_frames: number = 0;
    alternate: boolean = false;
    reverse_dir: boolean = false;
    repeat_anim: boolean = false;
    ping_pong: boolean = false;
    allow_offset: boolean = false;
    offset_x:number = 250;
    offset_y:number = 160;
    lclip: number = 0;    


    static from(side:TSIDE, fronts: string[], lefts: string[], rights: string[], sec: boolean ) : WallConfiguration | null{
        const r = new WallConfiguration;
        let side_id = (sec?side.sec:side.prim);
        if (side_id == 0) return null;

        r.alternate = sec?false:((side.flags & SideFlag.DOUBLE_SIDE) != 0);
        r.anim_frames = ((sec?side.sec_anim:side.prim_anim) & 0xF)+1;
        r.reverse_dir = sec?((side.flags & SideFlag.SEC_FORV) == 0):((side.flags & SideFlag.PRIM_FORV) == 0);
        r.ping_pong = sec?((side.flags & SideFlag.SEC_GAB) != 0):((side.flags & SideFlag.PRIM_GAB) != 0);
        r.repeat_anim = sec?((side.flags & SideFlag.SEC_ANIM) != 0):((side.flags & SideFlag.PRIM_ANIM) != 0);
        const count_graphics = r.anim_frames*(r.alternate?2:1);

        for (let l = 0; l < count_graphics; ++l) {
            const idx = l+side_id-1;
            r.graphics.push(new WallGraphics(fronts[idx],lefts[idx],rights[idx]));
        }
        if ((side.flags & SideFlag.SPEC) == 0 && sec) {
            r.offset_x = side.xsec*2;
            r.offset_y = side.ysec*2;
            r.allow_offset = r.offset_x != 250 || r.offset_y != 160;
        }
        r.lclip = side.lclip;
        return r;
    }

    get_key(): string {
        if (this.graphics.length == 0) return "";
        const ln = [
            this.graphics[0].get_key(),
            this.anim_frames.toString(36),
            this.alternate?"X":"S",
            this.repeat_anim?"R":"N",
            this.ping_pong?"P":"N",
            this.allow_offset?"O":"S",                        
            this.lclip.toString(36),
        ]
        if (this.allow_offset) {
            ln.push(this.offset_x.toString(36),this.offset_y.toString(36));
        }
        return ln.join("");
    }

}

export class ArcConfiguration {
    left:string = "";
    right:string = "";
    constructor(left?:string,right?:string) {
        this.left =  left || "";
        this.right = right || this.left;
    }
    get_key() {
        return this.left+this.right;
    }
    static from(sd:TSIDE, lefts: string[], rights: string[]) : ArcConfiguration | null{
        if (sd.oblouk == 0) return null;
        else return new ArcConfiguration(lefts[sd.oblouk-1], rights[sd.oblouk-1]);
    }
}

export class WallConfigurationPalette {
    map: Map<string, WallConfiguration> = new Map<string, WallConfiguration>();

    add(conf: WallConfiguration |null) : WallConfiguration|null{
        if (!conf) return conf;
        const k = conf.get_key();
        if (!this.map.has(k)) {
            this.map.set(k, conf);
            return conf;
        } else {
            return this.map.get(k)!;
        }
    }

    static from(sides: TSIDE[], fronts: string[], lefts: string[], rights: string[]): WallConfigurationPalette {
        const p = new WallConfigurationPalette;
        sides.forEach(x=>{
            const c1 = WallConfiguration.from(x,fronts,lefts,rights, false);
            if (c1) p.add( c1 );
            const c2 =  WallConfiguration.from(x,fronts,lefts,rights, true);
            if (c2) p.add( c2 );
        });
        return p;
    }
}

export class ArcConfigurationPalette {
    map: Map<string, ArcConfiguration> = new Map<string, ArcConfiguration>();

    add(conf: ArcConfiguration | null) : ArcConfiguration|null{
        if (!conf) return conf;
        const k = conf.get_key();
        if (!this.map.has(k)) {
            this.map.set(k, conf);
            return conf;
        } else {
            return this.map.get(k)!; 
        }
    }

    static from(sides: TSIDE[], lefts: string[], rights: string[]): ArcConfigurationPalette {
        const p = new ArcConfigurationPalette;
        sides.forEach(x=>{
            const c1 =  ArcConfiguration.from(x,lefts,rights);
            if (c1) p.add( c1 );
        });
        return p;
    }
}

const FloorCeilMode = {
    SINGLE: 0,
    ALTERNATE: 1,
    TWO_DIRECTIONS: 2,
    TWO_DIRECTIONS_ALTERNATE: 3,
    FOUR_DIRECTIONS: 4,
    FOUR_DIRECTIONS_ALTERNATE: 5,
}

export class FloorCeilConfiguration {
    pixmaps:string[] = [];
    animation: boolean = false;
    frames: number = 0;
    mode = FloorCeilMode.SINGLE;
    
    static from(sector: TSECTOR, layout: TMAP_LAYOUT, lists: string[], is_ceil: boolean) : FloorCeilConfiguration|null{
        const ret = new FloorCeilConfiguration;
        const idraw = is_ceil?sector.ceil:sector.floor;
        if (!idraw ) return null;
        const id = idraw-1;
        let f = sector.flags;
        if (is_ceil) f = f >> 4;
        f = f & 0xF;
        ret.animation = (f & 0x8) != 0;
        ret.frames = (f & 0x7)+1;
        ret.mode = f & 0x7;
        if (ret.animation) {
            ret.pixmaps = lists.slice(id, id+ret.frames);
        } else {
            const cnts  = [1,2,2,4,4,8];
            ret.pixmaps = lists.slice(id, id+cnts[ret.mode]);
        }
        return ret;
    }

    get_key() {
        return this.pixmaps.concat([this.animation?"!":"#",this.frames.toString(36),this.mode.toString(36)]).join("");
    }

}

export class FloorCeilConfigurationPalette {
    map: Map<string, FloorCeilConfiguration> = new Map<string, FloorCeilConfiguration>();

    add(conf: FloorCeilConfiguration|null) : FloorCeilConfiguration|null{
        if (!conf) return conf;
        const k = conf.get_key();
        if (!this.map.has(k)) {
            this.map.set(k, conf);
            return conf;
        } else {
            return this.map.get(k)!
        }
    }

    static from(sectors: TSECTOR[], layout: TMAP_LAYOUT[], lists: string[], is_ceil:boolean): FloorCeilConfigurationPalette {
        const p = new FloorCeilConfigurationPalette;
        sectors.forEach((x,idx)=>{
            const c1 = FloorCeilConfiguration.from(x, layout[idx], lists, is_ceil);
            if (c1) p.add( c1 );
        });
        return p;
    }
}

export class MapSide {

    primary: WallConfiguration | null = null;
    secondary: WallConfiguration | null = null;
    arc: ArcConfiguration | null = null;
    flags :number = 0;
    action: number = 0;
    target_side: number = 0;
    target_sector: number = 0;
    niche: NicheDef | null = null; 
}

export class MapSector {

    floor: FloorCeilConfiguration | null = null;
    ceil: FloorCeilConfiguration | null = null;
    type: number = 0;
    flags: number = 0;
    action: number = 0;
    target_size :number = 0;
    target_sector: number = 0;
    exit: number[] = new Array(4).fill(0);
    side: MapSide[] = new Array(4).fill(0).map((_)=>new MapSide());
    x: number = 0;
    y: number = 0;
    level : number = 0;
}


export class MapFile {
    
    sectors: MapSector[] = [];
    wall_palette = new WallConfigurationPalette;
    arc_palette = new ArcConfigurationPalette;
    floor_pallete = new FloorCeilConfigurationPalette;
    ceil_palette = new FloorCeilConfigurationPalette

    static from(m: RawMapFile) {
        const w = new WallConfigurationPalette;
        const a = new ArcConfigurationPalette;
        const f = new FloorCeilConfigurationPalette;
        const c = new FloorCeilConfigurationPalette;
        const r = m.sectors.map((s,idx)=>{
            const nw = new MapSector;
            nw.action = s.action;
            nw.ceil = c.add(FloorCeilConfiguration.from(s,m.layout[idx],m.pixmap_ceil,true));
            nw.floor = f.add(FloorCeilConfiguration.from(s,m.layout[idx],m.pixmap_ceil,false));
            for (let i = 0; i < 4; ++i) {
                const place = idx * 4 +i;
                const side = m.sides[idx*4+i];
                const n = new MapSide();
                n.primary = w.add(WallConfiguration.from(side, m.pixmap_front,m.pixmap_left,m.pixmap_right, false));
                n.secondary = w.add(WallConfiguration.from(side, m.pixmap_front,m.pixmap_left,m.pixmap_right, true));
                n.arc = a.add(ArcConfiguration.from(side, m.pixmap_arc_left,m.pixmap_arc_right));
                n.action = side.action;
                n.flags = side.flags;
                n.target_sector = side.target_sector;
                n.target_side = side.target_side;                
                n.niche = m.niches[place] || null;
                nw.side[i] = n;
                
            }
            const ml = m.layout[idx];
            nw.flags = ml.flags;
            nw.target_sector = s.target_sector;
            nw.target_size = s.target_size;
            nw.x = ml.x;
            nw.y = ml.y;
            nw.level = ml.layer;
            nw.exit = s.exit.slice();            
            return nw;
        });

        const q = new MapFile;
        q.wall_palette = w;
        q.arc_palette = a;
        q.floor_pallete = f;
        q.ceil_palette = c;
        q.sectors = r;
        return q;
    }
}


