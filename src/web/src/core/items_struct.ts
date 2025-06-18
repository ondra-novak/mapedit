import ItemsEditor from "@/views/ItemsEditor.vue";
import { BinaryIterator, parseSection, splitArrayBuffer, type Schema, type SectionInfo } from "./binary";


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
  vzhled_on_ground?: string;
  vzhled_on_male?:string;
  vzhled_on_female?:string;
  user_value:number;
  keynum:number;
  polohy: number[][];
  typ_zbrane: number;
  unused: number;
  sound: number;
  sound_file?:string;
  v_letu: number[];
  v_letu_files? :string[];
  cena:number;
  weapon_animation:number;
  weapon_animation_file?:string;
  hitpos:number;
  shiftup:number;
  byteres:number;
  rezerva:number;
} ;

const SV_ITLIST =  0x8001;
const SV_SNDLIST =  0x8002;
const SV_ON_GROUND = 1
const SV_ON_MALE = 2
const SV_ON_FEMALE = 3
const SV_ON_FLY = 4
const SV_WEAPON_ANIM = 5
const SV_END =     0x8000;

function parseItems(iter: BinaryIterator) : ItemDef[] {
  const def : ItemDef[] = [];

  while (!iter.eof()) {
    const itm = iter.parse(ItemsSchema);
    def.push(itm as ItemDef);
  }

  return def;

}

export function itemsFromArrayBuffer(buffer: ArrayBuffer) : ItemDef[]{
  const iter = new BinaryIterator(buffer);
  let items: ItemDef[] = [];
  let on_ground:string[] = [];
  let on_female:string[] = [];
  let on_male:string[] = [];
  let sounds: string[] =[];
  let in_fly: string[] = [];
  let animation: string[] = [];
  const dec = new TextDecoder();
  let sec: SectionInfo = parseSection(iter);
  while (sec.type != SV_END) {
    switch(sec.type) {
      case SV_ITLIST:
          items = parseItems(sec.data);
        break;
      case SV_SNDLIST:
        sounds = splitArrayBuffer(sec.data.binaryContent,0)
                  .map(x=>dec.decode(x));
        break;
      case SV_ON_GROUND:
        on_ground = splitArrayBuffer(sec.data.binaryContent,0)
                  .map(x=>dec.decode(x));
        break;
      case SV_ON_MALE:
        on_male= splitArrayBuffer(sec.data.binaryContent,0)
                  .map(x=>dec.decode(x));
        break;
      case SV_ON_FEMALE:
        on_female = splitArrayBuffer(sec.data.binaryContent,0)
                  .map(x=>dec.decode(x));
        break;
      case SV_ON_FLY:
        in_fly = splitArrayBuffer(sec.data.binaryContent,0)
                  .map(x=>dec.decode(x));
        break;
      case SV_WEAPON_ANIM:
        animation = splitArrayBuffer(sec.data.binaryContent,0)
                  .map(x=>dec.decode(x));

        break;

    }
     sec = parseSection(iter);

  }
  animation.unshift("");
  sounds.unshift("");
  in_fly.unshift("");
  on_ground.unshift("");
  on_male.unshift("");
  on_female.unshift("");

  items.forEach((x:ItemDef)=>{
    x.vzhled_on_ground = on_ground[x.vzhled];
    x.vzhled_on_male = on_male[x.vzhled];
    x.vzhled_on_female = on_female[x.vzhled];
    x.v_letu_files = x.v_letu.map(y=>in_fly[y]);
    x.weapon_animation_file = animation[x.weapon_animation];
    x.sound_file = sounds[x.sound];
  });

  return items;
}

export const ItemType = {
IT_UNSPECIFIED:    0,

IT_ARMOR:    1,
IT_WEAPON:   2,
IT_SCROLL:   3,
IT_SHOOTING: 4,
IT_THROW:    5,
IT_LEKTVAR:  6,
IT_JIDLO:    7,
IT_BATOH:    8,
IT_SPECIAL:  9,
IT_RUNE:    10,
IT_MONEY:   11,
IT_TEXTSCROLL: 12,
IT_DUST:    13,
IT_OTHER:    14,
} as const;

export const ItemTypeName = [
  [ItemType.IT_ARMOR,"Armor"],
  [ItemType.IT_WEAPON,"Melee Weapon"],
  [ItemType.IT_SCROLL,"Scroll/Wand"],
  [ItemType.IT_SHOOTING,"Ranged Weapon"],
  [ItemType.IT_THROW,"Throwing Weapon" ],
  [ItemType.IT_LEKTVAR,"Potion"],
  [ItemType.IT_JIDLO,"Food"],
  [ItemType.IT_BATOH,"Container"],
  [ItemType.IT_SPECIAL,"Special"],
  [ItemType.IT_SPECIAL,"Special"],
  [ItemType.IT_UNSPECIFIED,"Unspecified"],
  [ItemType.IT_RUNE,"Rune"],
  [ItemType.IT_MONEY,"Money"],
  [ItemType.IT_TEXTSCROLL,"Scroll with text"],
  [ItemType.IT_DUST,"Dust"],
  [ItemType.IT_OTHER,"Other"],
].reduce((a,b:any[])=>{
  a[b[0]] = b[1];
  return a;
},[] as string[]);