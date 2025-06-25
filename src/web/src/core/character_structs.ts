import { ItemWearPlace } from "./items_struct";
import { string_from_keybcs2 } from "./keybcs2";

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
  npcflags: number;
}

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
        npcflags:0,
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

class Runes {
    fire:boolean[] = new Array(7).fill(false);
    water: boolean[] = new Array(7).fill(false);
    earth: boolean[] = new Array(7).fill(false);
    air: boolean[] = new Array(7).fill(false);
    mind: boolean[] = new Array(7).fill(false);
    constructor() {}
};



interface THumanData  {
    characters: THuman[],
    runes: Runes;
}

export function humanDataFromArrayBuffer(buff: ArrayBuffer): THumanData {
  const data = string_from_keybcs2(Array.from(new Uint8Array(buff)));
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
            case 139:
                human.npcflags = iter.getNumber() || 0;
                break
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



  return {
    runes: runes,
    characters: humans
  };
}

