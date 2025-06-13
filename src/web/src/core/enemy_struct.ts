import { BinaryIterator, BinaryWriter, joinUint8Arrays, splitArrayBuffer, type Schema } from "./binary";

export interface EnemyDef {
  name: string; // jméno moba (char[30])
  casting: number; // číslo kouzla (short)
  adjusting: number[][]; // volba středu pro animace (short[16*6] = short[96])
  sector: number; // pozice (word)
  dir: number; // směr (word)
  locx: number; // přesná pozice (char)
  locy: number;
  headx: number; // pozice kam mob míří (char)
  heady: number;
  anim_counter: number; // čítač animací (word)
  vlastnosti: number[]; // základní vlastnosti potvory (short[24])
  inv: number[]; // batoh potvory (short[MOBS_INV]) – délka bude třeba určit podle definice
  lives: number; // počet životů (short)
  cislo_vzoru: number; // vzor ze kterého vznikl (short)
  speed: number; // rychlost (short)
  dohled: number; // dohled (short)
  dosah: number; // dosah (short)
  stay_strategy: number; // chování ve statickém režimu (char)
  walk_data: number; // číslo pro pohyb v bludišti (char)
  bonus: number; // bonus za zabití (word)
  flee_num: number; // pravděpodobnost útěku (char)
  anim_counts: number[]; // počet animačních fází (char[6])
  mobs_name: string; // jméno souboru (char[7])
  experience: number; // zkušenost (long)
  vlajky: number; // bitová vlajka (char)
  anim_phase: number; // fáze animace (char)
  csektor: number; // cílový sektor (short)
  home_pos: number; // domácí pozice (short)
  next: number; // číslo dalšího moba (short)
  actions: number; // počet akcí (char)
  hit_pos: number; // pozice zásahu (char)
  sounds: number[]; // zvukové události (word[MOB_SOUNDS]) – délka bude třeba doplnit
  sound_files?: string[]; //associated sound files
  paletts_count: number; // počet palet (signed char)
  mode: number; // režim (char)
  dialog: number; // dialog (short)
  dialog_reserved: number; // rezervace (char)
  money: number; // peníze (word)
  specproc: number; // speciální akce (word)
  reserved: number[]; // rezervovaná data (char[3])
};

const MOBS_INV = 16;
const MOB_SOUNDS = 4;

const EnemySchema : Schema = {
  name: "char[30]",
  casting: "int16",
  adjusting: ["int16", 6, 16],
  sector: "uint16",
  dir: "uint16",
  locx: "int8",
  locy: "int8",
  headx: "int8",
  heady: "int8",
  anim_counter: "uint16",
  vlastnosti: ["uint16", 24],
  inv: ["int16", MOBS_INV],
  lives: "int16",
  cislo_vzoru: "int16",
  speed: "int16",
  dohled: "int16",
  dosah: "int16",
  stay_strategy: "uint8",
  walk_data: "int8",
  bonus: "uint16",
  flee_num: "int8",
  anim_counts: ["int8", 6],
  mobs_name: "char[7]",
  experience: "int32",
  vlajky: "uint8",
  anim_phase: "uint8",
  csektor: "int16",
  home_pos: "int16",
  next: "int16",
  actions: "uint8",
  hit_pos: "uint8",
  sounds: ["uint16", MOB_SOUNDS],
  paletts_count: "int8",
  mode: "int8",
  dialog: "int16",
  dialog_reserved: "int8",
  money: "uint16",
  specproc: "uint16",
  reserved: ["int8", 3]
} as const;


export type Enemies = EnemyDef[];
export type EnemySounds = string[];


const EnemyHdrSchema = {
    "ver":"int32",
    "itemsz":"int32"
};

const EnemyHdr = {
    "ver":256,
    "itemsz":376
};

export function enemyFromArrayBuffer(buffer:ArrayBuffer ): Enemies {
    const iter = new BinaryIterator(buffer);
    const hdr = iter.parse(EnemyHdrSchema);
    if (hdr.ver != 256) throw new Error("Invalid ENEMY.DAT version");
    const enms = [] as Enemies;
    while (!iter.eof()) {
        enms.push(iter.parse(EnemySchema) as EnemyDef);
    }
    return enms;
}

export function enemyToArrayBuffer(enms: Enemies) : ArrayBuffer {
    const wrt = new BinaryWriter();
    wrt.write(EnemyHdrSchema, EnemyHdr);
    enms.forEach(x=>{
        wrt.write(EnemySchema, x);
    });
    return wrt.getBuffer();
}

export function enemySoundsFromArrayBuffer(buffer: ArrayBuffer):  EnemySounds {
    const view = buffer.slice(4);
    const dec = new TextDecoder()
    const strings = splitArrayBuffer(view, 0).map(x=>dec.decode(x));
    return strings.slice(0,-1);
}

export function enemySoundsToArrayBuffer(sounds: EnemySounds):  ArrayBuffer {
    const enc = new TextEncoder();
    const strs  = sounds.map(x=>enc.encode(x || ".").buffer);
    const bcount = new Uint8Array(4);
    const count = sounds.length;
    bcount[0] = count & 0xFF;    
    bcount[1] = (count>>8) & 0xFF;
    bcount[2] = (count>>16) & 0xFF;
    bcount[3] = (count>>24) & 0xFF;
    strs.unshift(bcount);
    strs.push(new ArrayBuffer(0));
    strs.push(new ArrayBuffer(0));
    return joinUint8Arrays(strs,0);
}

export function newEnemy(graphic: string) : EnemyDef{
    const enm :EnemyDef = {
        name: "",
        casting: 0,
        adjusting: new Array<number>().map(x=>new Array<number>(16).fill(0)),
        sector: 0,
        dir: 0,
        locx: 0,
        locy: 0,
        headx: 0,
        heady: 0,
        anim_counter: 0,
        vlastnosti: new Array<number>(24).fill(0),
        inv: new Array<number>(MOBS_INV).fill(0),
        lives: 0,
        cislo_vzoru: 0,
        speed: 1,
        dohled: 1,
        dosah: 1,
        stay_strategy: 0,
        walk_data: 0,
        bonus: 0,
        flee_num: 0,
        anim_counts: new Array<number>(6).fill(0),
        mobs_name: graphic.substring(0,6),
        experience: 0,
        vlajky: 0,
        anim_phase: 0,
        csektor: 0,
        home_pos: 0,
        next: 0,
        actions: 0,
        hit_pos: 0,
        sounds: new Array<number>(MOB_SOUNDS),
        paletts_count: 0,
        mode: 0,
        dialog: 0,
        dialog_reserved: 0,
        money: 0,
        specproc: 0,
        reserved: new Array<number>(3).fill(0)
    };

    return enm;
}

export const EnemyFlags1 = {
    "MOB_WALK": 0x1,
    "MOB_WATCH": 0x2,
    "MOB_LISTEN": 0x4,
    "MOB_BIG": 0x8,
    "MOB_GUARD": 0x10,
    "MOB_PICK": 0x20,
    "MOB_PICKING": 0x40,
    "MOB_ROGUE": 0x80,
} as const ; 
export type EnemyFlags1Type = typeof EnemyFlags1[keyof typeof EnemyFlags1];

export const EnemyFlags2 = {
    "MOB_IN_BATTLE": 0x1,
    "MOB_PASSABLE": 0x2,
    "MOB_SENSE": 0x4,
    "MOB_MOBILE": 0x8,
    "MOB_RELOAD": 0x10,
    "MOB_CASTING": 0x20,
    "MOB_SAMPLE_LOOP": 0x40,
} as const;
export type EnemyFlags2Type = typeof EnemyFlags2[keyof typeof EnemyFlags2];

export const SpellEffects = {
    "SPL_INVIS": 0x1,           
    "SPL_OKO": 0x2,             
    "SPL_TVAR": 0x4,            
    "SPL_DRAIN": 0x8,           
    "SPL_MANASHIELD": 0x10,     
    "SPL_SANC": 0x20,           
    "SPL_HSANC": 0x40,          
    "SPL_BLIND": 0x80,          
    "SPL_REGEN": 0x100,         
    "SPL_ICE_RES": 0x200,       
    "SPL_FIRE_RES": 0x400,      
    "SPL_KNOCK":   0x800,       
    "SPL_FEAR":    0x1000,      
    "SPL_STONED":  0x2000,      
    "SPL_LEVITATION": 0x4000,   
    "SPL_DEMON": 0x8000,        
} as const;
export type SpellEffectsType = typeof SpellEffects[keyof typeof SpellEffects];

export const EnemyStats = {
    "VLS_SILA":    0,
    "VLS_SMAGIE":  1,
    "VLS_POHYB":   2,
    "VLS_OBRAT":   3,
    "VLS_MAXHIT":  4,
    "VLS_KONDIC":  5,
    "VLS_MAXMANA": 6,
    "VLS_OBRAN_L": 7,
    "VLS_OBRAN_H": 8,
    "VLS_UTOK_L":  9,
    "VLS_UTOK_H":  10,
    "VLS_OHEN":    11,
    "VLS_VODA":    12,
    "VLS_ZEME":    13,
    "VLS_VZDUCH":  14,
    "VLS_MYSL":    15,
    "VLS_HPREG":   16,
    "VLS_MPREG":   17,
    "VLS_VPREG":   18,
    "VLS_MGSIL_L": 19,
    "VLS_MGSIL_H": 20,
    "VLS_MGZIVEL": 21,
    "VLS_DAMAGE":  22,
    "VLS_KOUZLA":  23,
} as const;

export const EnemySounds = {
    "MBS_WALK": 0,
    "MBS_ATTACK": 1,
    "MBS_HIT": 2
} as const;