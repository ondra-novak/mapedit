
export type FrameSequence = {
    suffix: string;
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
    DAMAGED: 5
} as const;

export type AnimationTypeIndexType = typeof AnimationTypeIndex[keyof typeof  AnimationTypeIndex];
export const AnimationTypeLetter : string[] = ['F','L','B','L','C','H'] as const;
export const AnimationTypeMirror = [false,false,false,true,false,false] as const;



export class SeqFile {


    animation: AnimationSet = [];    
    hit_pos: number|null = null;
    big: boolean = false;
    
    constructor(a: AnimationSet, hit_pos?: number, big? : boolean) {
        this.animation = a;
        this.hit_pos = hit_pos || null;
        this.big = !!big;
    };

    static fromArrayBuffer(buffer: ArrayBuffer) : SeqFile {

        const decoder = new TextDecoder('utf-8');
        const str = decoder.decode(buffer);
        const all_lines =  str.split("\r\n");
        const set : AnimationSet = [];
        let big : boolean = false;
        let hit_pos = undefined;
        if (all_lines[0] == "ver2") {
            all_lines.shift();
            all_lines.forEach(ln=>{
                if (ln == "big") {
                    big = true;
                    return;
                }
                const [ph,fr,ofsx,ofsy,hit,name] = ln.split(",",6);
                const phn = parseInt(ph);
                const frn = parseInt(fr);
                if (!set[phn]) set[phn] = [];
                set[phn][frn] = {
                    suffix:name,
                    offset_x:parseInt(ofsx),
                    offset_y:parseInt(ofsy),
                }                
                if (parseInt(hit)) {
                    hit_pos = frn;
                }
            });
        } else {
            const seq_lines = all_lines.slice(0,6);        
            const a = seq_lines.map((ln:string,ph:number)=>ln.split('').map((n:string,fr:number)=>(
                {
                    suffix: AnimationTypeLetter[ph]+n,
                    offset_x: -1000,
                    offset_y: 0
                }))) as AnimationSet;
            set.push(...a);

        }
        return new SeqFile(set, hit_pos, big);

    };

    toArrayBuffer() : ArrayBuffer{
        let out :string = "ver2\r\n";
        if (this.big) out = out + "big\r\n";

        this.animation.forEach((ph: AnimationPhase, phidx: number) => (ph || []).forEach((fr: FrameSequence, fridx:number)=>{
            if (fr) {
                out = out + `${phidx},${fridx},${fr.offset_x},${fr.offset_y},${this.hit_pos == fridx && phidx == AnimationTypeIndex.COMBAT?1:0},${fr.suffix}\r\n`;
            }
        }));
        const tdec = new TextEncoder();
        return tdec.encode(out).buffer;
    }
};