import { parse } from "vue/compiler-sfc";
import { BinaryIterator, BinaryWriter, joinUint8Arrays, loadBinaryContent, parseSection, splitArrayBuffer, writeSection, type Schema } from "./binary"
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
    USERPAL: 0x8100, // user palette settings
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
    NOT_AUTOMAP: 0x1,   //this flag is reversed in editor
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
    target_side :number = 0;
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
    xsec:number=500>>2;
    ysec:number=320>>2;
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

type NicheDef = Omit<TNICHE, "sector" | "dir" | "reserved" | "getSchema">;


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

class EnemyPlace extends WithSchema {

    sector: number = 0;
    enemy_dir: number = 0;
    getSchema(): Schema {
        return {
            sector: "uint16",
            enemy_dir: "uint16"
        }
    }
};

class EnemyOnSector {
    enemy_index: number = 0;
    direction: number = 0;

    static from(enemy_dir: number) : EnemyOnSector {
        const r = new EnemyOnSector();
        r.direction = enemy_dir >> 14;
        r.enemy_index = enemy_dir & 0x3FFF;
        return r;
    }

    to() : number {
        return this.direction << 14 | this.enemy_index;
    }

}

function parseItems(iter: BinaryIterator) : number [][] {
    const out : number[][] = [];
    while (!iter.eof()) {
        let place = iter.parse_type("int32");
        let n = iter.parse_type("uint16");
        let items = [];
        while (n != 0) {
            items.push(n-1);
            n = iter.parse_type("uint16");
        }
        out[place] = items;        
    }
    return out;
}

function serializeItems(items: number[][]): ArrayBuffer {
    const wr = new BinaryWriter();
    items.forEach((x,idx)=>{
        if (x.length) {
            wr.write_type("int32", idx);                
            x.forEach(itm=>{
                wr.write_type("int16", itm+1);
            })
                wr.write_type("int16", 0);
        }
    })
    return wr.getBuffer();
}

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


class TMA_GEN extends WithSchema {
    
    action:number = 0;
    flags:number = 0;

    getSchema() : Schema { return {
        action: "uint8",
        flags: "uint16",    
    }};;

    getAction() {return this.action & 0x3F;}
    getCancel() {return this.action & 0x40;}
    getOnce() {return this.action & 0x80;}
    

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

export class TMA_SEND_ACTION extends TMA_GEN {

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

export const ActionType = {
    GEN: 0,
    SOUND: 1,
    TEXTG: 2,
    TEXTL: 3,
    SENDA: 4,
    FIREB: 5,
    DESTI: 6,
    LOADL: 7,
    DROPI: 8,
    DIALG: 9,
    SSHOP: 10,
    CLOCK: 11,
    CACTN: 12,
    LOCK:  13,
    SWAPS: 14,
    WOUND: 15,
    IFJMP: 16,
    CALLS: 17,
    HAVIT: 18,
    STORY: 19,
    IFACT: 20,
    SNDEX: 21,
    MOVEG: 22,
    PLAYA: 23,
    CREAT: 24,
    ISFLG: 25,
    CHFLG: 26,
    CUNIQ: 27,
    MONEY: 28,
    GUNIQ: 29,
    PICKI: 30,
    WBOOK: 31,
    RANDJ: 32,
    ENDGM: 33,
    GOMOB: 34,
    SHRMA: 35,
    MUSIC: 36,
    GLOBE: 37,  //global events
    IFSEC: 38,	 //if sector num
    IFSTP: 39,  //if sector type
}

export const SimpleActionType = {
NONE: 0,
OPEN_DOOR: 1,
CLOSE_DOOR: 2,
OPEN_CLOSE: 3,
RUN_PRIM: 4,
SHOW_PRIM: 5,
HIDE_PRIM: 6,
SHOW_HIDE_PRIM: 7,
RUN_SEC: 8,
SHOW_SEC: 9,
HIDE_SEC: 10,
SHOW_HIDE_SEC: 11,
HIDE_PRIM_SEC: 12,
OPEN_TELEPORT: 15,
CLOSE_TELEPORT: 16,
CODELOCK_LOG2: 17,
CODELOCK_LOG3: 18,
}

export const SimpleActionTypeName = [
    "None",
/*OPEN_DOOR: 1,*/ "Open door",
/*CLOSE_DOOR: 2,*/ "Close door",
/*OPEN_CLOSE: 3,*/ "Open/Close door",
/*RUN_PRIM: 4,*/   "Animate primary",
/*SHOW_PRIM: 5,*/  "Show primary",
/*HIDE_PRIM: 6,*/  "Hide primary",
/*SHOW_HIDE_PRIM: 7,*/ "Show/Hide primary",
/*RUN_SEC: 8,*/    "Animate secodary",
/*SHOW_SEC: 9,*/   "Show secondary",
/*HIDE_SEC: 10,*/  "Hide secondary",
/*SHOW_HIDE_SEC: 11,*/ "Show/Hide secondary",
/*HIDE_PRIM_SEC: 12,*/ "Hide primary and secondary",
/*DISPLAY_TEXT: 13,*/  null,    //defunc
/*CODELOCK_LOG: 14,*/  null,    //defunc
/*OPEN_TELEPORT: 15,*/ "Open teleport",
/*CLOSE_TELEPORT: 16,*/ "Close teleport",
/*CODELOCK_LOG2: 17,*/ "Logical (invert)",
/*CODELOCK_LOG3: 18,*/ "Logical (set)"

]


function parseActions(iter:BinaryIterator) : TMA_GEN[][] {
    const ret:TMA_GEN[][] = [];
    
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
        ret[sector * 4 + side] = lst;
    }        
    return ret;
}

function serializeActions(a:  TMA_GEN[][]) : ArrayBuffer{
    const wr = new BinaryWriter;
    a.forEach((alist,idx)=>{
        if (alist.length) {
            wr.write_type("uint32", idx);
            alist.forEach(a=>{
                const wr2 = new BinaryWriter();
                serialize(wr2,a);
                const buff = wr2.getBuffer()
                wr.write_type("uint32", buff.byteLength);
                wr.write_buffer(buff);
            })
            wr.write_type("uint32", 0);
        }
    })
    return wr.getBuffer();
}



export class RawMapFile {

    sectors: TSECTOR[] = [];
    sides: TSIDE[] = [];
    info: MAPGLOBAL = new MAPGLOBAL;
    layout: TMAP_LAYOUT[] = [];
    items: number[][] = [];
    enemies: EnemyOnSector[] = [];
    niches: NicheDef[] = [];
    actions: TMA_GEN[][] = [];
    pixmap_front: string[] = [];
    pixmap_left: string[] = [];
    pixmap_right: string[] = [];
    pixmap_floor: string[] = [];
    pixmap_ceil: string[] = [];
    pixmap_arc_left: string[] = [];
    pixmap_arc_right: string[] = [];
    user_palette  = "";

    

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
                    this.items = parseItems(new BinaryIterator(nfo.data));
                    break;
                case MapSections.MAPMOBS: {
                    this.enemies = deserialize_arr(EnemyPlace, new BinaryIterator(nfo.data))
                        .reduce((a,b)=>{
                            a[b.sector] = EnemyOnSector.from(b.enemy_dir);
                            return a;
                        },[] as EnemyOnSector[])
                    break;
                }
                case MapSections.MAPMACR:
                    this.actions = parseActions(new BinaryIterator(nfo.data));
                    break;                
                case MapSections.MAPVYK:
                    this.niches = deserialize_arr(TNICHE, new BinaryIterator(nfo.data))
                        .reduce((a,b:TNICHE)=>{
                            const place = b.sector * 4 + b.dir;
                            a[place] = {items: b.items.filter(x=>x).map(x=>x-1),xpos: b.xpos,ypos: b.ypos,xs: b.xs,ys: b.ys};
                            return a;
                        },[] as NicheDef[])
                    break;
                case MapSections.USERPAL: {
                    const dec = new TextDecoder();
                    this.user_palette = dec.decode(nfo.data);
                }

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


export abstract class AssetConfiguration {
    name : string | null = null;
    abstract get_key() : string 
    get_name() : string {
        if (this.name) return this.name;
        const pxms = this.get_pixmaps();
        const s = pxms.map(x=>x.find(y=>y && y.toUpperCase() != "EMPTY.PCX")).find(x=>x);
        if (s) {
            if (pxms.length == 1) return s;
            else return `${s} (${pxms.length})`;
        } else {
            return this.name || this.get_key();
        }
    }
    abstract get_pixmaps():string[][];
    abstract clone(): AssetConfiguration;

}


export class WallConfiguration extends AssetConfiguration{
    graphics: string[][] = [["","",""]];
    anim_frames: number = 0;
    position: number=0;
    alternate: boolean = false;
    forward_dir: boolean = false;
    repeat_anim: boolean = false;
    ping_pong: boolean = false;
    allow_offset: boolean = false;
    secondary_front: boolean = false;
    offset_x:number = 250;
    offset_y:number = 160;
    lclip: number = 0;    
    


    static from(side:TSIDE, fronts: string[], lefts: string[], rights: string[], sec: boolean ) : WallConfiguration | null{
        const r = new WallConfiguration;
        let side_id = (sec?side.sec:side.prim);
        if (side_id == 0) return null;

        r.alternate = sec?false:((side.flags & SideFlag.DOUBLE_SIDE) != 0);
        r.anim_frames = ((sec?side.sec_anim:side.prim_anim) & 0xF)+1;
        r.forward_dir = sec?((side.flags & SideFlag.SEC_FORV) != 0):((side.flags & SideFlag.PRIM_FORV) != 0);
        r.ping_pong = sec?((side.flags & SideFlag.SEC_GAB) != 0):((side.flags & SideFlag.PRIM_GAB) != 0);
        r.repeat_anim = sec?((side.flags & SideFlag.SEC_ANIM) != 0):((side.flags & SideFlag.PRIM_ANIM) != 0);
        r.position = sec?0:((side.oblouk & 0x60)>>5);
        const count_graphics = r.anim_frames*(r.alternate?2:1);
        r.graphics = [];
        for (let l = 0; l < count_graphics; ++l) {
            const idx = l+side_id-1;
            r.graphics.push([fronts[idx],lefts[idx],rights[idx]]);
        }
        r.offset_x = side.xsec*2;
        r.offset_y = side.ysec*2;
        if ((side.flags & SideFlag.SPEC) == 0 && sec) {
            r.allow_offset = true;
        }
        r.lclip = side.lclip;
        r.secondary_front = (side.target_side & 0x80) != 0
        return r;
    }

    get_key(): string {
        if (this.graphics.length == 0) return "";
        const ln = [
            this.graphics[0][0],
            this.graphics[0][1],
            this.graphics[0][2],
            this.anim_frames.toString(36),
            this.alternate?"X":"S",
            this.repeat_anim?"R":"N",
            this.ping_pong?"P":"N",
            this.allow_offset?"O":"S",                      
            this.position,
            this.secondary_front?"F":"B",
            this.lclip.toString(36),
        ]
        if (this.allow_offset) {
            ln.push(this.offset_x.toString(36),this.offset_y.toString(36));
        }
        return ln.join("");
    }

    get_pixmaps(): string[][] {
        return this.graphics;
    }

    adjust_flags_prim(side: TSIDE) {
        side.flags &= ~(SideFlag.PRIM_ANIM|SideFlag.PRIM_FORV|SideFlag.PRIM_GAB|SideFlag.DOUBLE_SIDE);
        if (this.alternate) side.flags |=SideFlag.DOUBLE_SIDE;
        if (this.repeat_anim) side.flags |=SideFlag.PRIM_ANIM;
        if (this.forward_dir) side.flags |= SideFlag.PRIM_FORV;
        if (this.ping_pong) side.flags |= SideFlag.PRIM_GAB;
    }
    adjust_flags_sec(side: TSIDE){
        side.flags &= ~(SideFlag.SEC_ANIM|SideFlag.SEC_FORV|SideFlag.SEC_GAB|SideFlag.SPEC);
        if (!this.allow_offset) side.flags |=SideFlag.SPEC;
        if (this.repeat_anim) side.flags |=SideFlag.SEC_ANIM;
        if (this.forward_dir) side.flags |= SideFlag.SEC_FORV;
        if (this.ping_pong) side.flags |= SideFlag.SEC_GAB;
        return side.flags;
    }
    get_anim() : number {
        if (this.anim_frames > 1 && this.anim_frames <= 16) {
            const r = this.repeat_anim?Math.round(Math.random()*(this.anim_frames-1)):0;
            return (r << 4) | (this.anim_frames-1);
        } else {
            return 0;
        }

    }

    clone(): AssetConfiguration {
        const nw = new WallConfiguration();
        Object.assign(nw, this);
        nw.graphics = nw.graphics.map(x=>x.slice());
        return nw;
    }

}

export class ArcConfiguration extends AssetConfiguration {
    left:string = "";
    right:string = "";
    constructor(left?:string,right?:string) {
        super();
        this.left =  left || "";
        this.right = right || this.left;
    }
    get_key() : string{
        return this.left+this.right;
    }
    static from(sd:TSIDE, lefts: string[], rights: string[]) : ArcConfiguration | null{
        if (sd.oblouk == 0) return null;
        else return new ArcConfiguration(lefts[sd.oblouk-1], rights[sd.oblouk-1]);
    }
    get_pixmaps(): string[][] {
        return [[this.left,this.right]];
    }

    clone(): AssetConfiguration {
        return Object.assign(new ArcConfiguration(), this);
    }
}



export const FloorCeilMode = {
    ANIMATED:-1,
    SINGLE: 0,
    ALTERNATE: 1,
    TWO_DIRECTIONS: 2,
    TWO_DIRECTIONS_ALTERNATE: 3,
    FOUR_DIRECTIONS: 4,
    FOUR_DIRECTIONS_ALTERNATE: 5,
} as const;

export const FloorCeilModeRequiredFrames = [1,2,2,4,4,8] as const;

export class FloorCeilConfiguration extends AssetConfiguration {
    pixmaps:string[] = [""];
    mode : number = FloorCeilMode.SINGLE;
    
    static from(sector: TSECTOR, layout: TMAP_LAYOUT, lists: string[], is_ceil: boolean) : FloorCeilConfiguration|null{
        const ret = new FloorCeilConfiguration;
        const idraw = is_ceil?sector.ceil:sector.floor;
        if (!idraw ) return null;
        const id = idraw-1;
        let f = sector.flags;
        if (is_ceil) f = f >> 4;
        f = f & 0xF;
        const animation = (f & 0x8) != 0;
        const frames = (f & 0x7)+1;
        ret.mode = f & 0x7;
        if (animation) {
            ret.pixmaps = lists.slice(id, id+frames);
            ret.mode = FloorCeilMode.ANIMATED;
        } else {
            const cnts  = [1,2,2,4,4,8];
            ret.pixmaps = lists.slice(id, id+cnts[ret.mode]);
        }
        return ret;
    }

    get_key() {        
        return [this.pixmaps[0],this.mode.toString(),this.pixmaps.length.toString(36)].join("");
    }

    get_pixmaps(): string[][] {
        return this.pixmaps.map(x=>[x]);
    }
    get_flags() {
        if (this.mode == FloorCeilMode.ANIMATED) return 0x8 | (this.pixmaps.length & 0x7);
        else return this.mode;
    }
    clone(): AssetConfiguration {
        const nw =  Object.assign(new FloorCeilConfiguration(), this);
        nw.pixmaps = nw.pixmaps.slice();
        return nw;
    }

}

export class ConfigurationPalette<T extends AssetConfiguration> {
    map: Record<string, T> = {};    
    type: new (...args: any[]) => T;

    constructor(ctor: new (...args: any[]) => T) {
        this.type = ctor;
    }

    holds(ctor: new (...args: any[]) => any) : boolean{
        return this.type == ctor;
    }

    add(conf: T|null) : T|null{
        if (conf === null) return conf;
        const k = conf.get_key();
        if (this.map[k] === undefined) {
            this.map[k] =  conf;
            return conf;
        } else {
            return this.map[k]
        }
    }

    import_names(pfx: string, lst: Record<string,string>) {
        for (const k in this.map) {
            const n = lst[pfx+k];
            if (n) this.map[k].name = n;
        }
    }
    export_names(pfx: string, lst: Record<string,string>) {
        for (const k in this.map) {
            if (this.map[k].name) {                
                lst[pfx+k] = this.map[k].name;
            }
        }
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
    actions: TMA_GEN[] = [];
    item_can_be_placed_behind: boolean = false;
    items: number[] = [];      //items always lying in front of side on left 
}

export class MapSector {

    floor: FloorCeilConfiguration | null = null;
    ceil: FloorCeilConfiguration | null = null;
    type: number = SectorType.Empty;
    action: number = 0;
    target_side :number = 0;
    target_sector: number = 0;
    exit: number[] = new Array(4).fill(0);
    side: MapSide[] = new Array(4).fill(0).map((_)=>new MapSide());
    x: number = 0;
    y: number = 0;
    level : number = 0;
    enemy: EnemyOnSector | null = null;
    flags: number = 0;
}

class ConfigurationSaveMap {

    map : Record<string, [ string[][], number ]> = {};
    names : Record<string, string> = {};
    next_id = 1;

    to_id(conf: AssetConfiguration | null) : number {
        if (conf === null) return 0;
        const key = conf.get_key();
        const def = this.map[key]
        if (def) return def[1];
        const pxms = conf.get_pixmaps();
        if (!pxms) return 0;
        const def2 = [pxms, this.next_id] as [ string[][], number ];
        this.map[key] = def2;
        this.next_id = def2[1]+ pxms.length;
        if (conf.name) this.names[conf.get_key()] = conf.name;
        return def2[1];
    }

    create_pixmap_list(type: number) :  string[] {
        const lst: [string, number][] = [];
        for (const k in this.map) {
            const v = this.map[k];
            const id = v[1];
            const pxms = v[0];
            pxms.forEach((x,idx)=>{
                lst.push([x[type], idx+id]);
            });
        }
        lst.sort((a,b)=>a[1] - b[1]);
        return lst.map(x=>x[0]);
    }

}

export class MapPalettes {
    wall_palette = new ConfigurationPalette<WallConfiguration>(WallConfiguration);
    arc_palette = new ConfigurationPalette<ArcConfiguration>(ArcConfiguration);
    floor_pallete = new ConfigurationPalette<FloorCeilConfiguration>(FloorCeilConfiguration);
    ceil_palette = new ConfigurationPalette<FloorCeilConfiguration>(FloorCeilConfiguration)
    
}


export class MapFile {
    
    sectors: MapSector[] = [];
    info = new MAPGLOBAL;

    static from(buff: ArrayBuffer) : [ MapFile, MapPalettes ] {
        const w = new ConfigurationPalette<WallConfiguration>(WallConfiguration);
        const a = new ConfigurationPalette<ArcConfiguration>(ArcConfiguration);
        const f = new ConfigurationPalette<FloorCeilConfiguration>(FloorCeilConfiguration);
        const c = new ConfigurationPalette<FloorCeilConfiguration>(FloorCeilConfiguration);
        let m: RawMapFile;
        m = new RawMapFile();
        m.parseMap(buff);
        const r = m.sectors.map((s,idx)=>{
            const nw = new MapSector;
            nw.action = s.action;
            nw.ceil = c.add(FloorCeilConfiguration.from(s,m.layout[idx],m.pixmap_ceil,true));
            nw.floor = f.add(FloorCeilConfiguration.from(s,m.layout[idx],m.pixmap_floor,false));
            for (let i = 0; i < 4; ++i) {
                const place = idx * 4 +i;
                const side = m.sides[idx*4+i];
                const n = new MapSide();
                n.primary = w.add(WallConfiguration.from(side, m.pixmap_front,m.pixmap_left,m.pixmap_right, false));
                n.secondary = w.add(WallConfiguration.from(side, m.pixmap_front,m.pixmap_left,m.pixmap_right, true));
                n.arc = a.add(ArcConfiguration.from(side, m.pixmap_arc_left,m.pixmap_arc_right));
                n.action = side.action;
                n.flags = side.flags ^ SideFlag.NOT_AUTOMAP;
                n.target_sector = side.target_sector;
                n.target_side = side.target_side & 0x3;                
                n.niche = m.niches[place] || null;
                n.actions = m.actions[place] || [];
                n.items = m.items[place] || [];
                n.item_can_be_placed_behind = (side.oblouk & 0x80) != 0;
                nw.side[i] = n;
                
            }
            const ml = m.layout[idx];
            nw.target_sector = s.target_sector;
            nw.target_side = s.target_side;
            nw.x = ml.x;
            nw.type = s.type;
            nw.y = ml.y;
            nw.level = ml.layer;
            nw.exit = s.exit.slice();            
            nw.enemy = m.enemies[idx] || null;
            nw.flags = ml.flags;
            return nw;
        });

        if (m.user_palette.length) {
            const def = JSON.parse(m.user_palette);
            w.import_names("w",def);
            a.import_names("a",def);
            f.import_names("f",def);
            c.import_names("c",def);
        }

        const q = new MapFile;
        const p = new MapPalettes;
        p.wall_palette = w;
        p.arc_palette = a;
        p.floor_pallete = f;
        p.ceil_palette = c;
        q.sectors = r;        
        q.info = m.info;
        return [q,p];
    }

    saveToArrayBuffer() : ArrayBuffer {
        const wr = new BinaryWriter();
        const walls = new ConfigurationSaveMap;
        const arc = new ConfigurationSaveMap;
        const floors = new ConfigurationSaveMap;
        const ceils = new ConfigurationSaveMap;
        
        const sectors : TSECTOR[] =  this.sectors.map(s=>{

            while (s.side.length < 4) s.side.push(new MapSide);
            while (s.side.length > 4) s.side.pop();

            const out = new TSECTOR;
            out.action = s.action;
            out.exit = s.exit.slice();
            out.flags = (s.floor?s.floor.get_flags():0) | ((s.ceil?s.ceil.get_flags():0) << 4);
            out.ceil = ceils.to_id(s.ceil);
            out.floor = floors.to_id(s.floor);
            out.target_sector = s.target_sector;
            out.target_side = s.target_side
            out.type = s.type;
            return out;
        })
        
        const sides: TSIDE[] = this.sectors.map((sect)=>{
            return sect.side.map((s,side)=>{
                const out = new TSIDE;
                out.action = s.action;
                out.flags = s.flags ^ SideFlag.NOT_AUTOMAP;
                out.prim = walls.to_id(s.primary);
                out.sec = walls.to_id(s.secondary);
                out.oblouk = arc.to_id(s.arc) | ((s.primary?.position || 0) << 5) | (s.item_can_be_placed_behind?0x80:0);
                out.target_sector = s.target_sector;
                out.target_side = s.target_side;
                if (s.primary) {
                    s.primary.adjust_flags_prim(out);
                    out.prim_anim = s.primary.get_anim();
                    out.lclip = s.primary.lclip;                    
                    if (out.flags & SideFlag.DOUBLE_SIDE) {
                        const alt = ((sect.x + sect.y + side) & 1) != 0;
                        if (alt) out.prim+=(s.primary.anim_frames);
                    }
                } 
                if (s.secondary) {
                    s.secondary.adjust_flags_sec(out);
                    out.sec_anim = s.secondary.get_anim();
                    if (s.secondary.allow_offset) {
                        out.xsec = s.secondary.offset_x>>1;
                        out.ysec = s.secondary.offset_y>>1;                        
                    }                    
                }
                return out;

            });
        }).flat(1);
        const layout: TMAP_LAYOUT[] = this.sectors.map(s=>{
            const out = new TMAP_LAYOUT;
            out.x = s.x;
            out.y = s.y;
            out.layer = s.level;
            out.flags = s.flags;
            return out;
        })

        const enemies: EnemyPlace[] = this.sectors.map((s,idx)=>{
            if (s.enemy) {
                const out = new EnemyPlace;
                out.sector = idx;
                out.enemy_dir = s.enemy.to();
                return out;
            } else {
                return null;
            }
        }).filter(x=>x) as EnemyPlace[];

        const niches : TNICHE[] = this.sectors.map((s, idx)=>{
            return s.side.map((s, idx2)=>{
                if (s.niche) {
                    const out = new TNICHE;
                    out.sector = idx;
                    out.dir = idx2;
                    out.xpos = s.niche.xpos;
                    out.ypos = s.niche.ypos;
                    out.xs = s.niche.xs;
                    out.ys = s.niche.ys;
                    out.items = s.niche.items.map(x=>x+1);
                    out.reserved = 0;
                    return out;
                } else {
                    return null;
                }
            });
        }).flat(1).filter(x=>x) as TNICHE[];

        const actions : TMA_GEN[][] = this.sectors.map((s)=>{
            return s.side.map((s)=>{
                return s.actions || [];
            });
        }).flat(1);


        const items : number[][] = this.sectors.map((s)=>{
            return s.side.map((s) => {
                return s.items || [];
            });
        }).flat(1);

        function toArrayBuffer(s: WithSchema[]) {
            const wr = new BinaryWriter();
            s.forEach(x=>wr.write(x.getSchema(),x));
            return wr.getBuffer();
        }
        
        function stringsToArrayBuffer(s: string[]) {
            const enc = new TextEncoder();
            const data = s.map(x=>enc.encode(x).buffer);
            data.push(new ArrayBuffer(0));
            return joinUint8Arrays(data,0);
        }


        const userpal : Record<string, string> = {};
        for (const k in walls.names) userpal["w"+k] = walls.names[k];
        for (const k in arc.names) userpal["a"+k] = arc.names[k];
        for (const k in floors.names) userpal["f"+k] = floors.names[k];
        for (const k in ceils.names) userpal["c"+k] = ceils.names[k];

        const enc = new TextEncoder();

        writeSection(wr, MapSections.MAPGLOB, toArrayBuffer([this.info]));
        writeSection(wr, MapSections.SIDEMAP, toArrayBuffer(sides));
        writeSection(wr, MapSections.SECTMAP, toArrayBuffer(sectors));
        writeSection(wr, MapSections.MAPINFO, toArrayBuffer(layout));
        writeSection(wr, MapSections.MAPMOBS, toArrayBuffer(enemies));
        writeSection(wr, MapSections.MAPVYK, toArrayBuffer(niches));
        writeSection(wr, MapSections.STRTAB1, stringsToArrayBuffer(walls.create_pixmap_list(0)));
        writeSection(wr, MapSections.STRTAB2, stringsToArrayBuffer(walls.create_pixmap_list(1)));
        writeSection(wr, MapSections.STRTAB3, stringsToArrayBuffer(walls.create_pixmap_list(2)));
        writeSection(wr, MapSections.STRTAB4, stringsToArrayBuffer(ceils.create_pixmap_list(0)));
        writeSection(wr, MapSections.STRTAB5, stringsToArrayBuffer(floors.create_pixmap_list(0)));
        writeSection(wr, MapSections.STRTAB6, stringsToArrayBuffer(arc.create_pixmap_list(0)));
        writeSection(wr, MapSections.STRTAB7, stringsToArrayBuffer(arc.create_pixmap_list(1)));
        writeSection(wr, MapSections.MAPMACR, serializeActions(actions));
        writeSection(wr, MapSections.MAPITEM, serializeItems(items));
        writeSection(wr, MapSections.USERPAL, enc.encode(JSON.stringify(userpal)));
        writeSection(wr, MapSections.MAPEND, new ArrayBuffer);
        
        return wr.getBuffer();
    }

}

export class GlobalPaletteConfiguration<T extends AssetConfiguration> {
    list: T[] = [];

    merge(palette: ConfigurationPalette<T>) {
        const m = Object.assign({} as Record<string, T>, palette.map);
        this.list.forEach(x=>{
            const k = x.get_key();
            if (m[k]) return;
            m[k] = x;
        });
        this.list = Object.values(m);
    }
    

}


