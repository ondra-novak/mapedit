import { BinaryIterator, BinaryWriter, joinUint8Arrays, make1DArray, make2DArray, parseSection, splitArrayBuffer, writeSection, type Schema, type SchemaObject, type SchemaType } from "./binary";


const MOBS_INV = 16;
const MOB_SOUNDS = 4;


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

export class EnemyDef{
  name: string = ""; // jméno moba (char[30])
  casting: number = 0; // číslo kouzla (short)
  adjusting: number[][] = make2DArray(16,6,0); // volba středu pro animace (short[16*6] = short[96])
  sector: number = 0; // pozice (word)
  dir: number = 0; // směr (word)
  locx: number = 0; // přesná pozice (char)
  locy: number = 0;
  headx: number = 0; // pozice kam mob míří (char)
  heady: number = 0;
  anim_counter: number = 0; // čítač animací (word)
  vlastnosti: number[] = make1DArray(24,0); // základní vlastnosti potvory (short[24])
  inv: number[] = []; // batoh potvory (short[MOBS_INV]) – délka bude třeba určit podle definice
  lives: number = 0; // počet životů (short)
  cislo_vzoru: number = 0; // vzor ze kterého vznikl (short)
  speed: number = 0; // rychlost (short)
  dohled: number = 0; // dohled (short)
  dosah: number = 0; // dosah (short)
  stay_strategy = 0;
  walk_data: number = 0; // číslo pro pohyb v bludišti (char)
  bonus: number = 0; // bonus za zabití (word)
  flee_num: number = 0; // pravděpodobnost útěku (char)
  anim_counts: number[] = make1DArray(6,0); // počet animačních fází (char[6])
  mobs_name: string = ""; // jméno souboru (char[7])
  experience: number = 0; // zkušenost (long)
  vlajky = 0;
  anim_phase: number = 0; // fáze animace (char)
  csektor: number = 0; // cílový sektor (short)
  home_pos: number = 0; // domácí pozice (short)
  next: number = 0; // číslo dalšího moba (short)
  actions: number = 0; // počet akcí (char)
  hit_pos: number = 0; // pozice zásahu (char)
  sounds: number[] = make1DArray(MOB_SOUNDS,0); // zvukové události (word[MOB_SOUNDS]) – délka bude třeba doplnit
  sound_files: string[] = make1DArray(MOB_SOUNDS,""); //associated sound files
  paletts_count: number = 0; // počet palet (signed char)
  mode: number = 0; // režim (char)
  dialog: number = 0; // dialog (short)
  dialog_reserved: number = 0; // rezervace (char)
  money: number = 0; // peníze (word)
  specproc: number = 0; // speciální akce (word)
  reserved: number[] = []; // rezervovaná data (char[3])
};

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


const EnemySchemaNew : Schema = {
  name: "char[30]",                 //30
  casting: "int16",                 //32
  adjusting: ["int16", 6, 16],      //224
  sector: "uint16",                 //226
  dir: "uint16",                    //228
  locx: "int8",
  locy: "int8",
  headx: "int8",
  heady: "int8",                    //232
  anim_counter: "uint16",           //234
  vlastnosti: ["uint16", 24],       //282
  inv: ["int16", MOBS_INV],         //314
  lives: "int16",                   //316
  cislo_vzoru: "int16",             //318
  speed: "int16",                   //320
  dohled: "int16",                  //322
  dosah: "int16",                   //324
  stay_strategy: "uint8",           //325
  walk_data: "int8",                //326
  bonus: "uint16",                  //328
  flee_num: "int8",                 //329
  anim_counts: ["int8", 6],         //335
  mobs_name: "char[7]",             //342
  flags2:  "uint8",                 //343
  reserved: "uint8",                //344
  experience: "int32",              //348
  vlajky: "uint8",                  //349
  anim_phase: "uint8",              //350
  csektor: "int16",                 //352
  home_pos: "int16",                //354
  next: "int16",                    //356
  actions: "uint8",                 //357
  hit_pos: "uint8",                 //358
  sounds: ["uint16", MOB_SOUNDS],   //366
  paletts_count: "int8",            //367
  mode: "int8",                     //368
  dialog: "int16",                  //370
  dialog_flags: "int16",            //372
  money: "uint16",                  //374
  specproc: "uint16",               //376
  reserved2: "uint16",              //378
  reserved3: "uint16",              //380
} as const;

export type Enemies = EnemyDef[];
export type EnemySounds = string[];


const EnemyHdrSchema : Schema= {
    "ver":"int32",
    "itemsz":"int32"
};

const EnemyHdr = {
    "ver":256,
    "itemsz":376
};

function enemyFromArrayBufferOld(buffer:ArrayBuffer ): Enemies {
    const iter = new BinaryIterator(buffer);
    const hdr = iter.parse(EnemyHdrSchema);
    if (hdr.ver != 256) throw new Error("Invalid ENEMY.DAT version");
    const enms = [] as Enemies;
    while (!iter.eof()) {
        const e = new EnemyDef;
        Object.assign(e, iter.parse(EnemySchema));
        enms.push(e);
    }
    return enms;
}

export function enemyFromArrayBufferNew(buffer:ArrayBuffer ): Enemies {
    const iter = new BinaryIterator(buffer);
    const enms = [] as Enemies;
    while (!iter.eof()) {
        const e = new EnemyDef;
        Object.assign(e, iter.parse(EnemySchemaNew));
        enms.push(e);
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
export function enemyToArrayBufferNew(enms: Enemies) : ArrayBuffer {
    const wrt = new BinaryWriter();
    enms.forEach(x=>{
        wrt.write(EnemySchemaNew, x);
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
    const bcount = new Uint8Array(new ArrayBuffer(3));
    const count = sounds.length;
    bcount[0] = count & 0xFF;    
    bcount[1] = (count>>8) & 0xFF;
    bcount[2] = (count>>16) & 0xFF;
    strs.unshift(bcount.buffer);
    strs.push(new ArrayBuffer(0));
    strs.push(new ArrayBuffer(0));
    return joinUint8Arrays(strs,0).buffer;
}

export function enemyAndSoundToArrayBuffer(enms:Enemies, sounds: EnemySounds) {
    const e = enemyToArrayBufferNew(enms);
    const s = enemySoundsToArrayBuffer(sounds);
    const wr = new BinaryWriter();
    writeSection(wr, 1, e);
    writeSection(wr, 2, s);
    writeSection(wr,0x8000, new ArrayBuffer());    
    return wr.getBuffer();
}

export function enemyAndSoundFromArrayBuffer(buff: ArrayBuffer): [Enemies, EnemySounds]|null {
    try {
        parseSection(new BinaryIterator(buff));
    } catch (e) {
        return null;
    }    
    const rd = new BinaryIterator(buff);
    let enemies: Enemies = [];
    let sounds: EnemySounds = [];
    let s = parseSection(rd);
    while (s.type != 0x8000) {
        switch (s.type) {
            case 1: enemies = enemyFromArrayBufferNew(s.data);break;
            case 2: sounds = enemySoundsFromArrayBuffer(s.data);break;            
        }
        s = parseSection(rd);
    }
    return [enemies, sounds];
}

export function enemyFromArrayBuffer(buffer:ArrayBuffer ): Enemies {
    const s = enemyAndSoundFromArrayBuffer(buffer);
    if (s == null) {
        return enemyFromArrayBufferOld(buffer);
    } else {
        return s[0];
    }
}


export const EnemySounds = {
    "MBS_WALK": 0,
    "MBS_ATTACK": 1,
    "MBS_HIT": 2
} as const;