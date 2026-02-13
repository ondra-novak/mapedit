import { BinaryIterator, BinaryWriter, make1DArray, type Schema } from "./binary";
import type { CharacterStats, CharacterWeaponBonus } from "./common_defs";
import type { directions } from "./map_structs";

class DialogParagraphDef {
    header = {
        id: 0,
        alt: 0,     //if id != alt, go alt for first time, so id == alt to turn off this feature
        visited: false, //true when visited
        second_visit: false    //true if visited second time 
    }
    position = 0;


    getSchema() : Schema {
        return {
            header: ["bitmap","uint32", {
                id:      0x00007FFF,
                alt:     0x3FFF8000,
                visited: 0x40000000,
                second_visit:   0x80000000,
            }],
            position: "uint32"
        };
    }
}

  
interface Instruction {
    value?: number,
    text?: string,
    variable? :number
}

function read_instruction(iter: BinaryIterator) : Instruction {
    const type = iter.parse("int8");
    switch(type){
        case 1: {
            let s = iter.parse_stringz();
            let b = iter.parse("uint8");
            while (b == 1) {
                s = s + iter.parse_stringz();;
                b = iter.parse("uint8");
            }
            iter.seek_rel(-1);
            return {text:s};
        }
        case 2: return {value: iter.parse("int16")};
        case 3: return {variable: iter.parse("int16")};        
        default: throw Error(`Unknown type ${type}`);
    }
}

function write_instruction(iter: BinaryWriter, instr: Instruction) {
    if ("value" in instr) {
        iter.write("uint8",2);
        iter.write("int16",instr.value);
    } else if ("text" in instr) {
        iter.write("uint8",1);
        iter.write("int16",instr.text);
    } else  if ("variable" in instr) {
        iter.write("uint8",3);
        iter.write("int16",instr.variable);
    }
}

export class DialogDef {

    pgfs: [string, any][][] = [];

    load_from_buffer(buffer: ArrayBuffer) {
        const iter = new BinaryIterator(buffer);
        const count:number = iter.parse("uint32");
        iter.parse("int32");    //dummy
        const pgf_map = new Map<number, number>()  //[id, [offset, alt]]
        for (let i = 0; i < count; ++i) {
            const pgfdef  = new DialogParagraphDef();
            Object.assign(pgfdef, iter.parse(pgfdef.getSchema()));
            pgf_map.set(pgfdef.header.id, pgfdef.position);
        }
        const state = {local_pgf: 0};
        for (const itm of pgf_map) {
            const part = buffer.slice(8+8*count+itm[1]);
            this.pgfs[itm[0]] = DialogDef.parse_code(part,state);
        }
        const m = this.pgfs.reduce((a, v,idx)=>{a.push([idx,v]);return a},[] as [number,any][] );
        console.log(Object.fromEntries(m));
        const mm = new Set<string>;
        m.forEach(x=>x[1].forEach((y:["string",any])=>mm.add(y[0])));
        console.log(mm);
        return pgf_map;
    }

    static instruction_table : Record<number, [string, number]>= {
        128: ["add_desc",1],
        129: ["show_emote",1],
        130: ["save_name",1],       //*
        131: ["not", 0],
        132: ["load_name",1],
        133: ["nahodne",1],
        134: ["nahodne_magie",2],   //*
        135: ["nahodne_sila",2],    //*
        136: ["nahodne_obrat",2],   //*
        137: ["set_name",2],
        138: ["set_iff",1],
        139: ["goto_paragraph",1],
        140: ["goto_iff",1],
        141: ["goto_not_iff",1],
        142: ["add_choice",2],
        143: ["add_choice_iff", 3],
        144: ["dialog_select(1)", 0],
        145: ["visited",1],
        146: ["add_choice_not_visited", 2],
        147: ["picture",1],
        148: ["echo",1],
        149: ["add_to_book",1],
        150: ["set_nvisited",1],
        151: ["random_roll",1],
        152: ["has_item",1],
        153: ["create_item",1],
        154: ["destroy_item",1],
        155: ["add_money",1],
        156: ["pay",1],
        157: ["start_battle",0],
        158: ["send_action",2],
        160: ["teleport_group",2],
        161: ["play_animation",3],
        162: ["add_to_story",1],
        163: ["test_flag",1],
        164: ["dialog_select(0)",0],
        165: ["dialog_select_jump",0],
        166: ["first_visited",1],
        167: ["local_pgf",1],
        168: ["starting_shop",1],
        169: ["jump_not_iff",1],
        170: ["jump_iff",1],
        171: ["jump",1],
        172: ["code_page",1],
        174: ["join_character",1],
        189: ["ask_who_dead",2],
        175: ["ask_who",2],
        176: ["pract_to",2],
        177: ["test_vls",3],
        178: ["add_rune",1],
        179: ["has_rune",1],
        180: ["has_money",1],
        181: ["pract",3],
        182: ["dark_screen",2],
        183: ["sleep",1],
        184: ["eat",1],
        185: ["isall",0],
	    186: ["enable_glmap",1],
        187: ["atsector",2],
        188: ["cast_spell",1],
        190: ["spell_sound",1],
        191: ["test_choice",2],
        192: ["set_var",2],
        193: ["add_var",2],
        194: ["compare_var",3],
        195: ["set_var_pgf",1],
        196: ["set_var_iff",1],
        197: ["add_choice_var",2],
        198: ["add_choice_var_iff",3],
        199: ["goto_var",1],
        200: ["drop_character",0],
        201: ["pc_xicht",1],
        518: ["set_flag",1],
        519: ["reset_flag",1],
        255: ["exit_dialog",0]
    }


    static is_exit_code(c: number) {
        return (c == 164 || c== 165|| c == 255 || c == 139);
    }


    static parse_code(buffer: ArrayBuffer, state: {local_pgf: number}) : [string, Instruction[] ][] {
        const iter = new BinaryIterator(buffer);
        const out : [string,Instruction[]][] = [];
        const label_map = new Map<number, number>()
        let fill_jump : [number,number][] = [];
        try {
            while (true) {
                while(true) {                
                    label_map.set(iter.tell(), out.length);
                    const instr_code = read_instruction(iter);
                    if (instr_code.value === undefined) throw Error(`Parse error, instruction ${JSON.stringify(instr_code)}`);
                    const c = instr_code.value;
                    const instr = DialogDef.instruction_table[c];
                    if (!instr) out.push(["?unknown",[instr_code]]);
                    else {
                        const arg_cnt = instr[1];
                        const args : Instruction[]= [];
                        for (let i = 0; i < arg_cnt; ++i) {
                            args.push(read_instruction(iter));                        
                        }
                        if (c >= 169 && c<=171 && args[0].value !== undefined) {
                            fill_jump.push([iter.tell()+args[0].value,out.length]);
                        } else if (c == 167) {
                            state.local_pgf = args[0].value || state.local_pgf;
                        } else if ((c == 139 || c == 140 || c == 141 || c == 142 || c == 146 || c == 145 || c== 166) && args[0].value !== undefined) {
                            args[0].value = args[0].value+state.local_pgf;
                        } else if ((c == 143 )&& args[1].value !== undefined) {
                            args[1].value = args[1].value+state.local_pgf;
                        } else if (( c==175 || c == 189)&& args[1].value) {
                            args[1].value = args[1].value+state.local_pgf;
                        }
                        
                        out.push([instr[0], args]);
                        if (DialogDef.is_exit_code(c)) break;
                    }                
                }            

                fill_jump.sort((a,b)=>a[0] - b[0]);
                fill_jump = fill_jump.filter(r=>{
                    const ofs = r[0];
                    const ln = r[1];
                    const v = out[ln][1][0].value;
                    if (v) {
                        const addr = ofs;
                        const lb = label_map.get(addr);
                        if (lb) {
                            out[ln][1][0].value = lb;
                            return false;
                        }
                    }
                    return true;
                });
                
                if (fill_jump.length == 0) break;
                const f = fill_jump[0];

                iter.seek_rel(f[0]-iter.tell());
            }
                
        } catch (e) {
            console.warn(e);
        }

        return out;
    }

};

export const DialogBranchType = {
    jump_to_node:0,       //jump immediately, skip node
    npctalk:1,    //npc talking, display text and pause
    choice:2,     //add choice into choices list
    selchar:3,    //ask for character and continue to target (for example cast spell on target)
    seldead:4,    //ask for dead character and continue to target (for example ressurection)
    addstory:5,   //jump but add text to story log
} as const;

export const DialogSpeakerType = {
    unset: 0,
    attribute: 1,
    random: 2,
    xicht: 3,
    character: 4,
}

export interface DialogSpeaker {
    name: string;
    type: typeof DialogBranchType[keyof typeof DialogBranchType];
    attribute?: typeof CharacterStats[keyof typeof CharacterStats];
    param?: number;
}

export interface DialogConstant {
    value: number;
    desc: string;
}


export const DialogBranchTypeStr = Object.entries(DialogBranchType).reduce((a,b)=>{
    a[b[1]] = b[0];
    return a;
},[] as string[]);

export interface DialogBranch {
    ///type of this branch
    type: typeof DialogBranchType[keyof typeof DialogBranchType];
    ///who speaks (for choice, 0 default)
    speaker: number;
    ///text of this branch (not for jump)
    text: string;
    ///condition when this branch is taken - undefined, no condition
    condition: string;
    ///target node, if not defined, dialog ends 
    target: number|null;
};

export interface DialogAction {
    source: string ;
    ast: any[]|null ;
}

export const DlgNodeType = {
    standard: 0,
    battle: 1,
    shopping: 2
} as const

export const DlgNodeTypeStr = Object.entries(DlgNodeType).reduce((a,b)=>{
    a[b[1]] = b[0];
    return a;
},[] as string[]);



export interface DialogNode {
    name: string;
    picture?: string;
    description?: string;    
    action?: DialogAction;
    branches: DialogBranch[];
    node_type: typeof DlgNodeType[keyof typeof DlgNodeType];
    shop_id?: number;
}

export interface DialogStory {
    nodes: Record<number, DialogNode>;
    picture: string;
    description: string;
    conditions: Record<string, DialogAction>
    speakers: DialogSpeaker[];
    name: string;
}

interface DialogNodeMap {
    nodes : (DialogStory|DialogNode)[];
    map : Map<DialogStory|DialogNode, number>;
    stories : Map<DialogNode, DialogStory>;
};

function instruction_size(i: Instruction) {
    if ("text" in i) return 1+i.text!.length+1;  //text instruction has 1+text_length+zero
    else return 3;  //otherwise 3 bytes
}

export class DialogManager {
    _dlg: Record<number, DialogStory> = {};
    _consts: Record<string, DialogConstant> = {};

    static new_node() : DialogNode{
        return {
            branches:[],
            name:"",
            node_type: DlgNodeType.standard
        };
    }

    static new_branch(): DialogBranch {
        return {
            type: DialogBranchType.choice,
            condition:"",
            speaker:0,
            text:"",
            target: null
        };
    }

    static new_story(): DialogStory {
        const nd = DialogManager.new_node();
        nd.name = "Start";
        return {
            nodes: {0:nd},
            picture:"",
            description:"",
            conditions:{},
            speakers: make1DArray(9, ()=>({name:"",type:DialogSpeakerType.unset} as DialogSpeaker)),
            name: "New story"
        };
    }

    static create_node(story: DialogStory) : [number, DialogNode] {
        let i = 0;
        while (story.nodes[i]) ++i;
        story.nodes[i] = DialogManager.new_node();
        return [i, story.nodes[i]];
    }

    create_story() : number {
        let i = 1;
        while (this._dlg[i]) ++i;
        this._dlg[i] = DialogManager.new_story();
        return i;
    }

    save() : string {
        return JSON.stringify({"dialogs":this._dlg,"constants":this._consts});
    }

    load(txt:string) {
        const s = JSON.parse(txt);;
        this._dlg = s["dialogs"];
        this._consts = s["constants"] || {};
    }

    create_node_map() : DialogNodeMap {        
        const nodes : (DialogNode|DialogStory)[] = [];
        const map : Map<DialogNode|DialogStory, number> = new Map;
        const stories : Map<DialogNode, DialogStory> = new Map;
        for (const id in this._dlg) {
            const st = this._dlg[id];
            const vid = parseInt(id) *128;
            nodes[vid] = st;
            map.set(st, vid);
        }
        let idx = 0;
        for (const id in this._dlg) {
            const st = this._dlg[id];
            for (const subid in st.nodes) {                
                while (nodes[idx]) ++idx;
                nodes[idx] = st.nodes[subid];
                map.set(st.nodes[subid], idx);
                stories.set(st.nodes[subid], st);
            }
        }

        return {map, nodes, stories};
    }

    compile_node(nd: DialogStory| DialogNode, mp: DialogNodeMap) : Instruction[]{
        const out : Instruction [] =[];
        if (nd.description) {
            out.push({value:128});
            out.push({text:nd.description});
        }
        if (nd.picture) {
            out.push({value:147});
            out.push({text:nd.picture});
        }
        if ("nodes" in nd) {
            this.compile_story(nd as DialogStory, mp, out);
        } else {
            this.compile_node2(nd as DialogNode,  mp, out);
        }
        

        return out;
    }

    compile_story(st: DialogStory, mp: DialogNodeMap, out: Instruction[]) {

        st.speakers.forEach((sp,idx)=>{
            switch (sp.type) {
                case DialogSpeakerType.attribute:
                    out.push({value:22});       //nahodne
                    out.push({value:sp.attribute || 0}); 
                    out.push({value:sp.param || 99});
                    out.push({value:130}); //save_name
                    out.push({value:idx+1});
                    break;
                case DialogSpeakerType.random:
                    out.push({value:22});       //nahodne
                    out.push({value:0}); 
                    out.push({value:0});
                    out.push({value:130}); //save_name
                    out.push({value:idx+1});
                    break;
                case DialogSpeakerType.xicht:
                    out.push({value:201});       //pc_xicht
                    out.push({value:sp.param}); 
                    out.push({value:130}); //save_name
                    out.push({value:idx+1});
                    break;
                case DialogSpeakerType.character:
                    out.push({value:29});       //character slot
                    out.push({value:sp.param}); 
                    out.push({value:130}); //save_name
                    out.push({value:idx+1});
                    break;
                default:
                    break; //unset
            }
        })
        const nd = st.nodes[0]; //goto start paragraph
        if (nd) {
            const t = mp.map.get(nd);
            if (t !== undefined) {
                out.push({value:139}); //goto paragraph
                out.push({value:t});    //pgf id
            }
        }
    }

    compile_node2(nd: DialogNode, mp: DialogNodeMap, out: Instruction[]) {
        switch (nd.node_type) {
            case DialogNo
        }
    }

    compile() {
        console.log(this.create_node_map());
    }

}

