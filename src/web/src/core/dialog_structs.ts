import { BinaryIterator, type Schema } from "./binary";
import type { CharacterStats, CharacterWeaponBonus } from "./common_defs";
import type { directions } from "./map_structs";

class DialogParagraphDef {
    header = {
        id: 0,
        alt: 0,     //never used in original dialog scheme
        visited: false, //not used in Steam Version
        first: false    //not used in Steam Version
    }
    position = 0;


    getSchema() : Schema {
        return {
            header: ["bitmap","uint32", {
                id:      0x00007FFF,
                alt:     0x3FFF8000,
                visited: 0x40000000,
                first:   0x80000000,
            }],
            position: "uint32"
        };
    }
}

/*
type DialogCondition = ["and", DialogCommand[]] | ["or", DialogCommand[]] | ["not", DialogCommand[]];


const DialogOperator = {
    "=":32,
    ">":35,
    "<":33,
    ">=":36,
    "<=":34,
    "<>":37,
}

export type DialogCommandDef = {
    show_desc: string,
    show_emote: string,
    save_char: number,
    load_char: number,
    not: DialogCondition,
    and: DialogCondition,
    or: DialogCondition,
    char_select:{
        ability:keyof typeof CharacterStats,
        limit: number,
        can_duplicate: boolean
    },
    manual_char_select: {
        name: string,
        female: boolean
    }
    goto: number,
    choice: [string, number],
    dialog_select: number,
    visited:number,
    picture:string,
    echo:string,
    add_book:number,
    clear_visited: number,
    random100:number,
    has_item:number,
    create_item:number,
    destroy_item:number,
    add_money:number,
    sub_money:number,
    start_battle:[],
    send_action: [number, typeof directions],
    relocate_group: [number, typeof directions],
    run_animation: {
        name: string,
        speed: number,
        rep?:boolean
    },
    update_story: string,
    test_flag:number,
    dialog_select_jump: null,
    unknown: [number|string][],
    local_pgf: number,
    start_shop: number,
    join:number,
    char_input:{
        prompt: string,
        goto: number,
        dead? : boolean
    },
    practice: [(keyof typeof CharacterStats) | (keyof typeof CharacterWeaponBonus), number, number?],
    test_ability: [(keyof typeof CharacterStats) | (keyof typeof CharacterWeaponBonus), keyof typeof DialogOperator, number],
    has_rune:[number, number],
    activate_rune:[number, number],
    deactivate_rune:[number, number],
    has_money:number,
    dark_screen:[number, number],
    sleep: number,
    feast: number,
    whole_group:null,
    enable_global_map:boolean,
    current_sector:[keyof typeof DialogOperator],
    cast_spell:number,
    play_sound:string,








    
}

type DialogCommand =
  {
    [K in keyof DialogCommandDef]:
      [K, DialogCommandDef[K]]
  }[keyof DialogCommandDef]

*/
  
interface Instruction {
    short?: number,
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
        case 2: return {short: iter.parse("int16")};
        case 3: return {variable: iter.parse("int16")};        
        default: throw Error(`Unknown type ${type}`);
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
        return (c == 144 || c == 164 || c== 165|| c == 255 || c == 139);
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
                    if (instr_code.short === undefined) throw Error(`Parse error, instruction ${JSON.stringify(instr_code)}`);
                    const c = instr_code.short;
                    const instr = DialogDef.instruction_table[c];
                    if (!instr) out.push(["?unknown",[instr_code]]);
                    else {
                        const arg_cnt = instr[1];
                        const args : Instruction[]= [];
                        for (let i = 0; i < arg_cnt; ++i) {
                            args.push(read_instruction(iter));                        
                        }
                        if (c >= 169 && c<=171 && args[0].short !== undefined) {
                            fill_jump.push([iter.tell()+args[0].short,out.length]);
                        } else if (c == 167) {
                            state.local_pgf = args[0].short || state.local_pgf;
                        } else if ((c == 139 || c == 140 || c == 141 || c == 142 || c == 146 || c == 145 || c== 166) && args[0].short !== undefined) {
                            args[0].short = args[0].short+state.local_pgf;
                        } else if ((c == 143 )&& args[1].short !== undefined) {
                            args[1].short = args[1].short+state.local_pgf;
                        } else if (( c==175 || c == 189)&& args[1].short) {
                            args[1].short = args[1].short+state.local_pgf;
                        }
                        
                        out.push([instr[0], args]);
                        if (DialogDef.is_exit_code(c)) break;
                    }                
                }            

                fill_jump.sort((a,b)=>a[0] - b[0]);
                fill_jump = fill_jump.filter(r=>{
                    const ofs = r[0];
                    const ln = r[1];
                    const v = out[ln][1][0].short;
                    if (v) {
                        const addr = ofs;
                        const lb = label_map.get(addr);
                        if (lb) {
                            out[ln][1][0].short = lb;
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
    seldead:4     //ask for dead character and continue to target (for example ressurection)
} as const;

export const DialogBranchTypeStr = Object.entries(DialogBranchType).reduce((a,b)=>{
    a[b[1]] = b[0];
    return a;
},[] as string[]);

export interface DialogBranch {
    ///type of this branch
    type: typeof DialogBranchType[keyof typeof DialogBranchType];
    ///who speaks (for choice, 0 default)
    speaker?: number;
    ///text of this branch (not for jump)
    text?: string;
    ///condition when this branch is taken - undefined, no condition
    condition?: string;
    ///target node, if not defined, dialog ends 
    target: number|null;
};

export interface DialogAction {
    source: string ;
    ast: Record<string, any> ;
}

export interface DialogNode {
    name?: string;
    picture?: string;
    description?: string;    
    action?: DialogAction;
    branches: DialogBranch[];
}

export interface DialogStory {
    nodes: Record<number, DialogNode>;
    picture: string;
    description: string;
    conditions: Record<string, DialogAction[]>
    name: string;
}

export class DialogManager {
    _dlg: DialogStory[] = [];

    static new_node() : DialogNode{
        return {
            branches:[]
        }
    }

    static new_branch(): DialogBranch {
        return {
            type: DialogBranchType.choice,
            target: null
        };
    }

    static new_story(): DialogStory {
        return {
            nodes: {},
            picture:"",
            description:"",
            conditions:{},
            name: ""
        };
    }

    static create_node(story: DialogStory) : [number, DialogNode] {
        let i = 0;
        while (story.nodes[i]) ++i;
        story.nodes[i] = DialogManager.new_node();
        return [i, story.nodes[i]];
    }

    save() : string {
        return JSON.stringify({"dialogs":this._dlg});
    }

    load(txt:string) {
        const s = JSON.parse(txt);;
        this._dlg = s["dialogs"];
    }

}