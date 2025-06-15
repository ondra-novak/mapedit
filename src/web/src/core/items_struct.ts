import type { Schema } from "./binary";


const ItemsSchema : Schema =  {
  "jmeno": "char[32]",
  "popis": "char[32]",
  "zmeny": ["int16",24],
  "podminky": ["int16",4],
  "hmotnost": "int16",
  "nosnost":"int16",
  "druh":"int16",
  "umisteni": "int16",
  "flags": "uint16",
  "spell":"int16",
  "magie":"int16",
  "sila_spell":"int16",
  "use_event": "int16",
  "ikona":"uint16",
  "vzhled":"uint16",
  "user_value": "int16",
  "keynum": "int16",
  "polohy": ["int16",2,2],
  "typ_zbrane": "uint8",
  "unused": "uint8",
  "sound": "int16",
  "v_letu": ["int16",16],
  "cena":"int32",
  "weapon_animation": "uint8",
  "hitpos": "uint8",
  "shiftup": "uint8",
  "byteres": "uint8",
  "rezerva": ["int16",12],
  } as const


export interface ItemDef  {
  jmeno: string;
  popis: string;
  zmeny: number[];
  podminky: number[];
  hmotnost: number;
  nosnost:number;
  druh:number;
  umisteni:number;
  flags:number;
  spell:number;
  magie:number;
  sila_spell:number;
  use_event: number;
  ikona:number;
  vzhled:number;
  user_value:number;
  keynum:number;
  polohy: number[][];
  typ_zbrane: number;
  unused: number;
  sound: number;
  v_letu: number[];
  cena:number;
  weapon_animation:number;
  hitpos:number;
  shiftup:number;
  byteres:number;
  rezerva:number;
} ;

const SV_ITLIST =  0x8001;
const SV_SNDLIST =  0x8002;
const SV_END =     0x8000;

