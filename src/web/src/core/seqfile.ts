
export type FrameSequence = number;
export type AnimationPhase = FrameSequence[];
export type AnimationSet = AnimationPhase[];

export const AnimationTotalPhases = 6

export const AnimationTypeIndex = {
    WALK_FRONT: 0,
    WALK_LEFT: 1,
    WALK_BACK: 2,
    WALK_RIGHT: 3,
    COMBAT: 4,
    DAMAGED: 5
} as const;

export type AnimationTypeIndexType = typeof AnimationTypeIndex[keyof typeof  AnimationTypeIndex];
export const AnimationTypeLetter : string[] = ['F','L','B','L','C','H'] as const;
export const AnimationTypeMirror = [false,false,false,true,false,false] as const;


export class SeqFile {


    animation: AnimationSet = [];    
    xoffsets: AnimationSet|null = null;
    
    constructor(a: AnimationSet, ofs?: AnimationSet) {
        this.animation = a;
        this.xoffsets = ofs || null;
    };

    static fromArrayBuffer(buffer: ArrayBuffer) : SeqFile {

        const decoder = new TextDecoder('utf-8');
        const str = decoder.decode(buffer);
        const all_lines =  str.split("\r\n");
        const seq_lines = all_lines.slice(0,6);
        const a = seq_lines.map((ln:string)=>{return ln.split('').filter((n:string)=>n != 'Z').map((n:string)=>{
            return parseInt(n, 32);
        })}) as AnimationSet;
        let ofs = null;

        if (all_lines[AnimationTotalPhases] && all_lines[AnimationTotalPhases].length>0) {
            try {
                ofs = JSON.parse(all_lines[AnimationTotalPhases]);
            } catch (e) {

            }
        }
        return new SeqFile(a, ofs);
    };

    toArrayBuffer() : ArrayBuffer{

        const ln1 = this.animation.map((s:AnimationPhase)=>{
            let r =  s.map((p:FrameSequence) => {
                return p.toString(32).toUpperCase();
            }).join('');
            while (r.length < 16) r = r + 'Z';
            return r + "\r\n";
        }).join('');

        const ln2 = (this.xoffsets?JSON.stringify(this.xoffsets):"")+"\r\n";
        const tdec = new TextEncoder();
        return tdec.encode(ln1+ln2).buffer;
    }

    init_xoffsets() {
        if (!this.xoffsets) {
            this.xoffsets = new Array(AnimationTotalPhases);
        }
    }

    set_xoffset(type: AnimationTypeIndexType, frame: number, xofs: number) : void{
        if (!this.xoffsets) this.xoffsets = [];
        if (!this.xoffsets[type]) this.xoffsets[type] = [];
        this.xoffsets[type][frame] = xofs;
    }

    get_xoffset(type: AnimationTypeIndexType, frame: number) : number{
        if (!this.xoffsets) return 0;
        if (!this.xoffsets[type]) return 0;
        return this.xoffsets[type][frame] || 0;
    }

    are_xoffsets_defined() : boolean{
        return !!this.xoffsets;
    }


};