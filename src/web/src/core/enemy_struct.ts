import { BinaryIterator, BinaryWriter, joinUint8Arrays, splitArrayBuffer, type Schema } from "./binary";

export interface EnemyDef {
  name: string; // jméno moba (char[30])
  casting: number; // číslo kouzla (short)
  adjusting: number[]; // volba středu pro animace (short[16*6] = short[96])
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
  vlastnosti: ["int16", 24],
  inv: ["int16", MOBS_INV],
  lives: "int16",
  cislo_vzoru: "int16",
  speed: "int16",
  dohled: "int16",
  dosah: "int16",
  stay_strategy: "int8",
  walk_data: "int8",
  bonus: "uint16",
  flee_num: "int8",
  anim_counts: ["int8", 6],
  mobs_name: "char[7]",
  experience: "int32",
  vlajky: "int8",
  anim_phase: "int8",
  csektor: "int16",
  home_pos: "int16",
  next: "int16",
  actions: "int8",
  hit_pos: "int8",
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

export function enemyFromArrayBuffer(buffer:ArrayBuffer ): Enemies {
    const iter = new BinaryIterator(buffer);
    iter.position+=8;
    const enms = [] as Enemies;
    while (!iter.eof()) {
        enms.push(iter.parse(EnemySchema) as EnemyDef);
    }
    return enms;
}

export function enemyToArrayBuffer(enms: Enemies) : ArrayBuffer {
    const wrt = new BinaryWriter();
    enms.forEach(x=>{
        wrt.write(EnemySchema, x);
    });
    return wrt.getBuffer();
}

export function enemySoundsFromArrayBuffer(buffer: ArrayBuffer):  EnemySounds {
    const view = buffer.slice(8);
    const dec = new TextDecoder()
    const strings = splitArrayBuffer(view, 0).map(x=>dec.decode(x));
    return strings.slice(0,-1);
}

export function enemySoundsToArrayBuffer(sounds: EnemySounds):  ArrayBuffer {
    const enc = new TextEncoder();
    const strs  = sounds.map(x=>enc.encode(x || ".").buffer);
    strs.unshift(new ArrayBuffer(7));
    strs.push(new ArrayBuffer(0));
    strs.push(new ArrayBuffer(0));
    return joinUint8Arrays(strs,0);
}