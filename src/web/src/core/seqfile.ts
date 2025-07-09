import { BinaryIterator, BinaryWriter, joinUint8Arrays, parseSection, splitArrayBuffer, writeSection } from "./binary";

export type FrameSequence = {
    name: string;
    offset_x: number;
    offset_y: number;
}
export type AnimationPhase = FrameSequence[];
export type AnimationSet = AnimationPhase[];

export const AnimationTotalPhases = 6

export const AnimationTypeIndex = {
    WALK_FRONT: 0,
    WALK_LEFT: 1,
    WALK_BACK: 2,
    WALK_RIGHT: 3,
    COMBAT: 4,
    DAMAGED: 5,
    IDLE_FRONT: 6,
    IDLE_LEFT: 7,
    IDLE_BACK: 8,
    IDLE_RIGHT: 9,
} as const;

export type AnimationTypeIndexType = typeof AnimationTypeIndex[keyof typeof  AnimationTypeIndex];
export const AnimationTypeLetter : string[] = ['F','L','B','L','C','H'] as const;
export const AnimationTypeMirror = [false,false,false,true,false,false,false,true,false,false] as const;



export class SeqFile {


    animation: AnimationSet = [];    
    hit_pos: number|null = null;
    big: boolean = false;
    old_format: boolean = false;
    
    constructor(a: AnimationSet, hit_pos?: number, big? : boolean) {
        this.animation = a;
        this.hit_pos = hit_pos || null;
        this.big = !!big;
    };

    static NewHeader = {
        row: "uint8",
        count: "uint8",
    };

    static NewItem = {
        file: "uint16",
        offsetx: "int16",
        offsety: "int16",
    };
    static Config = {
        big: "uint8",
        hitpos: "uint8"
    };

    static fromArrayBuffer(buffer: ArrayBuffer, baseName: string) : SeqFile {

        const header = new Uint8Array(buffer, 0, 7);
        const headerStr = Array.from(header).map(b => String.fromCharCode(b)).join('');
        if (headerStr === "<BLOCK>") {
            const iter = new BinaryIterator(buffer);
            let animData : BinaryIterator | null = null;
            let configData : BinaryIterator | null = null;
            let stringTable : string[] | null = null;
            let sect = parseSection(iter);
            while (sect.type != 0) {
                if (sect.type == 1) {
                    animData = new BinaryIterator(sect.data);
                } else if (sect.type == 2) {
                    const dec = new TextDecoder();
                    stringTable = splitArrayBuffer(sect.data,0).map(x=>dec.decode(x));
                } else if (sect.type == 3) {
                    configData = new BinaryIterator(sect.data);
                }
                sect = parseSection(iter);
            }
            if (stringTable && animData && configData) {
                const a : AnimationSet = [];
                while (!animData.eof()) {
                    const h1 = animData.parse(SeqFile.NewHeader);
                    a[h1.row] = [];
                    const r = a[h1.row];
                    for (let x = 0; x<h1.count; ++x) {                        
                        const itm = animData.parse(SeqFile.NewItem);
                        r.push({
                            name: stringTable[itm.file],
                            offset_x: itm.offsetx,
                            offset_y: itm.offsety
                        });
                    }
                }
                const cfg = configData.parse(SeqFile.Config);
                return new SeqFile(a, cfg.hitpos, cfg.big != 0);
            }

        }
        
        const decoder = new TextDecoder('utf-8');
        const str = decoder.decode(buffer);
        const all_lines =  str.split("\r\n");
        const set : AnimationSet = (new Array(10)).fill(0).map(()=>new Array());
        let big : boolean = false;
        let hit_pos = undefined;
        const seq_lines = all_lines.slice(0,6);        
        const a = seq_lines.map((ln:string,ph:number)=>ln.split('').map((n:string,fr:number)=>(
            {
                name: baseName+AnimationTypeLetter[ph]+n.toUpperCase()+".PCX",
                offset_x: -1000,
                offset_y: 0
            }))) as AnimationSet;
        set.splice(0,6,...a);

        for (let i = 0; i < 4;++i) {    //create idle animations from first frame and remove it
            set[i+6] = [set[i][0]];
            set[i].splice(0,1);
        }
        

        return new SeqFile(set, hit_pos, big);

    };

    isOldFormat() {
        return this.hit_pos === null;
    }

    toArrayBuffer() : ArrayBuffer{
        const strtable : Record<string, number>= {};
        let nxtidx = 0;
        const animData = new BinaryWriter;
        const data = this.animation.forEach((x,idx)=>{
            animData.write(SeqFile.NewHeader, {row:idx, count: x.length});
            x.forEach(s=>{
                let fnd = strtable[s.name];
                if (fnd === undefined) {
                    fnd = nxtidx++;
                    strtable[s.name] = fnd;
                }
                animData.write(SeqFile.NewItem, {
                    file: fnd,
                    offsetx: s.offset_x,
                    offsety: s.offset_y
                });
            })
        });
        const config = new BinaryWriter();
        config.write(SeqFile.Config, {big: this.big?1:0, hitpos: this.hit_pos || 0})

        const enc = new TextEncoder();        
        const strings = joinUint8Arrays(Object.entries(strtable).sort((a,b)=>a[1] - b[1]).map(x=>enc.encode(x[0])).concat([new Uint8Array(0)]),0);
        const out =  new BinaryWriter();
        writeSection(out, 1, animData.getBuffer());
        writeSection(out, 2, strings.buffer);
        writeSection(out, 3, config.getBuffer());
        writeSection(out, 0, new ArrayBuffer(0));
        return out.getBuffer();
    }
};