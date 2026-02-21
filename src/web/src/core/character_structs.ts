import { make_identifiers } from "./common_defs";
import { keybcs2string, string2keybcs } from "./keybcs2";
import Hive from "@/utils/hive"

export interface THuman {
  jmeno: string;
  female: boolean;
  xicht: number;
  level: number;
  exp: number;
  inv: number[];
  wearing: number[];
  rings: number[];
  stats: number[];
  sipy: number;
  sip_druh:number;
  npcflags: {HIDE_INV: boolean, HIDE_GEAR: boolean}
}

export class HumanHive extends Hive<THuman> {};

export  const createTHuman = (): THuman => {
        return {
        jmeno: '',
        female: false,
        xicht: 0,
        level: 0,
        exp: 0,
        inv: [],
        wearing: [],
        stats: new Array(24).fill(0),
        sipy: 0,
        sip_druh:0,
        npcflags:{HIDE_GEAR:false,HIDE_INV:false},
        rings:[]
        }
    }



export const HumanWearPlace = {
BATOH: 0,
TELO_H: 1,
TELO_D: 2,
HLAVA: 3,
NOHY: 4,
KUTNA: 5,
KRK: 6,
RUKA_L: 7,
RUKA_R: 8
} as const

export const HumanWearPlaceName = [
    "Bag slot","Upper body","Lower body","Head","Feet","Robe","Neck","Left hand","Right hand"
] as const;


export const HumanWearPlaceVariables = make_identifiers("equipment.", HumanWearPlaceName);

class Iterator {
    lines:string[] = [];
    i:number = 0;
    constructor(text:string) {
        this.lines = text.split(/\r?\n/);
        this.i = 0;
    }
    eof() : boolean {
        return this.i >= this.lines.length;
    }
    get() : string|null {
        if (this.eof()) return null;
        const s =  this.lines[this.i++].trim();
        if (s == "") return "-1";
        return s;
    }
    getNumber() : number|null {
        const s = this.get();
        if (s !== null) {
            const n =  parseInt(s);
            if (isNaN(n)) return null;
            return n;
        }
        return null;
    }
    getString() {
        const c= this.get();
        if (c) {
            return c.substring(1);
        }
        return c;
    }
}

export class Runes {
    fire:boolean[] = new Array(7).fill(false);
    water: boolean[] = new Array(7).fill(false);
    earth: boolean[] = new Array(7).fill(false);
    air: boolean[] = new Array(7).fill(false);
    mind: boolean[] = new Array(7).fill(false);
    constructor() {}
};



export interface THumanData  {
    characters: HumanHive,
    runes: Runes;
}

const NpcFlags = {
    HIDE_GEAR: 0x2,
    HIDE_INV: 0x1
} as const;

export function humanDataFromArrayBuffer(buff: ArrayBuffer): THumanData {
  const data = keybcs2string(Array.from(new Uint8Array(buff)));
  const iter = new Iterator(data);
  const humans: THuman[] = [];
  const runes: Runes = new Runes();



    let human = createTHuman();
    let skip_add = true;


    while (!iter.eof()) {
        const code = iter.getNumber();
        skip_add = skip_add && code == -1;
        switch (code){
            case 64: case 65: case 66: case 67: case 68: {
                let z = iter.getNumber();
                let r = ["fire","water","earth","air","mind"][code-64];
                while (z !== null && z !== -1) {
                    runes[r as keyof Runes][z-1] = true;
                    z = iter.getNumber();
                }
                break;
            }
            case 128: 
                human.jmeno = iter.getString() || "";
            break;
            case 129:
                human.female = (iter.getNumber() || 0) != 0;
            break;
            case 130:
                human.xicht = iter.getNumber() || 0;
            break;
            case 131:
                human.level = iter.getNumber() || 0;
            break;
            case 132:
                human.exp = iter.getNumber() || 0;
            break;
            case 133: {
                let num = iter.getNumber();
                while (num !== null && num !== -1) {
                    human.inv.push(num);
                    num = iter.getNumber();
                }
                break;
            }
            case 134: {
                const batoh = iter.getNumber() || 0;
                human.wearing[HumanWearPlace.BATOH] = batoh;
                break;
            }
            case 135: {
                const index = iter.getNumber() || 0;
                const value = iter.getNumber() || 0;
                human.wearing[index] = value;
                break;
            }
            case 136:
                human.sipy = iter.getNumber() || 0;
                break;
            case 137: 
                human.sip_druh = iter.getNumber() || 0;
                break;
            case 138:
                let num = iter.getNumber();
                while (num !== null && num !== -1) {
                    human.rings.push(num);
                    num = iter.getNumber();
                }
                break;
            case 139: {
                const npcflags = iter.getNumber() || 0;
                human.npcflags.HIDE_GEAR = (npcflags & NpcFlags.HIDE_GEAR) != 0;
                human.npcflags.HIDE_INV = (npcflags & NpcFlags.HIDE_INV) != 0;
                } break
            case -1:
                if (!skip_add) humans.push(human);
                skip_add = true;
                human = createTHuman();
                break;
            default:
                const val = iter.getNumber() || 0;
                human.stats[code || 0] = val;
                break;
        }
    }

    const hive = new HumanHive();
    humans.forEach((v, idx) => v.jmeno == "#"?null:hive.set(idx,v));

  return {
    runes: runes,
    characters: hive
  };
}

export function humanDataToArrayBuffer(data: THumanData) : ArrayBuffer {
    const lines :(string | number | null)[] = [];
    let r = [data.runes.fire,
             data.runes.water,
             data.runes.earth,
             data.runes.air,
             data.runes.mind].forEach((x,idx)=>{
        lines.push((64+idx))
        for (let i = 0; i < 7; ++i) {
            if (x[i]) {
                lines.push(i+1);
            }
        }
        lines.push(-1);
    })

    data.characters.get_raw().forEach(h=>{
        if (h === null) {
            h = createTHuman();
            h.jmeno = "#";
        }
        lines.push(128,h.jmeno);
        lines.push(129,h.female?1:0);
        lines.push(130,h.xicht);
        lines.push(131,h.level);
        lines.push(132,h.exp);
        lines.push(133,...h.inv,-1);

        if (h.wearing[HumanWearPlace.BATOH] !== undefined)  {
            lines.push(134, h.wearing[HumanWearPlace.BATOH]);
        }

        h.wearing.forEach((x, idx)=>{
            if (idx != HumanWearPlace.BATOH) {
                lines.push(135);
                lines.push(idx);
                lines.push(x);
            }
        })

        lines.push(136,h.sipy);
        lines.push(137,h.sip_druh);
        lines.push(138,...h.rings, -1);
        lines.push(139,(h.npcflags.HIDE_GEAR?NpcFlags.HIDE_GEAR:0)+(h.npcflags.HIDE_INV?NpcFlags.HIDE_INV:0));
        h.stats.forEach((v,idx) => {
            lines.push(idx, v);
        });
        lines.push(null);
    })
    const whole_str = lines.map(x=>{
        if (x === null) return "";
        if (typeof x == "string") return "$"+x;
        else {
            return `${x}`;
        }
    }).join("\r\n")+"\r\n";

    return Uint8Array.from(string2keybcs(whole_str)).buffer;
}