import { BinaryIterator, BinaryWriter, make1DArray, type Schema } from "./binary";
import { HumanWearPlaceVariables } from "./character_structs";
import { CharacterStatVariables, CharacterWeaponBonus, CharacterWeaponBonusVariables, type CharacterStats } from "./common_defs";
import type { directions } from "./map_structs";

const MAX_IDENTIFIERS = 32;

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
    value?: number;
    text?: string;
    variable? :number;
    pop?:boolean;
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
        case 4: return {pop: true};        
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
    } else if (instr.pop) {
        iter.write("uint8",4);
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
    map : Map<DialogStory|DialogNode|number, number>;
    stories : Map<DialogNode, DialogStory>;
};

function instruction_size(i: Instruction) {
    if ("text" in i) return 1+i.text!.length+1;  //text instruction has 1+text_length+zero
    else if (i.pop) return 1;
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

    compile(consts: Record<string, DialogConstant> ) {
        const compiler = new DialogCompiler(this, consts);
        return compiler.compile();
    }

}


// name, param type - n=number,s=string, code
type FunctionList = Record<string,[ ('n'|'s')[], number]>;

const functionList: FunctionList = 
{
    "have_item":[['n'],152],
    "have_money":[['n'],180],
    "pay":[['n'],156],
    "add_money":[['n'],155],
    "set_flag":[['n'],518],
    "is_flag":[['n'],152],
    "reset_flag":[['n'],519],
    "set_fact":[['n'],31],
    "reset_fact":[['n'],32],
    "is_fact":[['n'],30],
    "get_lever":[['n','n'],45],
    "send_action":[['n','n'],158],
    "teleport_group":[['n','n'],160],
    "load_level":[['s','n','n'],46],
    "teleport_character":[['s','n','n'],33],
    "create_item":[['n'],153],
    "destroy_item":[['n'],154],
    "add_to_book":[['n'],149],
    "select_speaker":[['n'],132],
    "set_speaker":[['n'],130],
    "join_character":[['n'],174],
    "drop_character":[['n'],200],
    "have_rune":[['n'],179],
    "set_rune":[['n'],178],
    "remove_rune":[['n'],202],
    "sleep":[['n'],183],
    "timepass":[['n','n'],182],
    "eat":[['n'],184],
    "change_music":[['s'],36],
    "play_sound":[['s'],190],
    "replace_monster":[['n'],37],
    "replace_monsters":[['n','n'],38],
    "replace_monsters_radius":[['n','n','n','n'],39],
    "cast_spell":[['n'],188],
    "cast_to_enemy":[['n'],40],
    "enable_global_map":[['n'],186],
    
};

export class DialogCompileError extends Error {
  location: DialogNode|null;
  cause?: unknown;

  constructor(location: DialogNode|null, message: string, cause?: unknown) {
    super(message);
    this.name = "CompileError";
    this.location = location;
    this.cause = cause;
  }
}

class DialogCompiler {

    

    stories: Record<number, DialogStory>;
    nodes: DialogNodeMap;
    consts: Record<string, DialogConstant> ;        
    identifiers: Map<DialogStory|null, {map: Record<string, [number, number]>, cntr:number} >= new Map;
    cur_node_id:number = 0;
    cur_node: DialogNode|null = null;

    static create_node_map(d: DialogManager) : DialogNodeMap {        
        const nodes : (DialogNode|DialogStory)[] = [];
        const map : Map<DialogNode|DialogStory|number, number> = new Map;
        const stories : Map<DialogNode, DialogStory> = new Map;
        for (const id in d._dlg) {
            const st = d._dlg[id];
            const vid = parseInt(id) *128;
            nodes[vid] = st;
            map.set(st, vid);
        }
        let idx = 1;
        for (const id in d._dlg) {
            const st = d._dlg[id];
            for (const subid in st.nodes) {                
                while (nodes[idx]) ++idx;
                nodes[idx] = st.nodes[subid];
                map.set(parseInt(subid), idx);
                map.set(st.nodes[subid], idx);
                stories.set(st.nodes[subid], st);
            }
        }
        const exitNode : DialogNode = {
            node_type:DlgNodeType.standard,
            branches:[],      
            name:""      
        }
        nodes[0] = exitNode;
        map.set(exitNode, 0);

        return {map, nodes, stories};
    }


    constructor(dlgm: DialogManager, external_consts: Record<string, DialogConstant> ) {
        this.nodes = DialogCompiler.create_node_map(dlgm);
        this.consts = Object.assign(Object.assign({},external_consts), dlgm._consts);
        this.stories = dlgm._dlg;
    }

    compile(): Instruction[][] {

        try {
            return this.nodes.nodes.map(nd=>{
                return this.compile_node(nd);
            })
        } catch (e) {
            throw new DialogCompileError(this.cur_node, (e as Error).message, e);
        }
    }

    reg_id(s: string, assignment: boolean) {
        const st = (this.cur_node  && this.nodes.stories.get(this.cur_node )) || null;
        let m = this.identifiers.get(st);        
        if (!m) {
            this.identifiers.set(st, m = {cntr:0,map:{}});            
        }
        let v = m.map[s];
        if (!v) {
            if (m.cntr == MAX_IDENTIFIERS) this.compile_error("Too many variables!");
            v = m.map[s] = [m.cntr, 0];
            ++m.cntr;            
        }
        if (assignment) v[1] |= 1;
        else v[1] |= 2;
        return v[0];
    }

    is_id(s: string) : boolean{
        const st = (this.cur_node  && this.nodes.stories.get(this.cur_node )) || null;
        let m = this.identifiers.get(st);
        if (!m) return false;
        return !!m.map[s];
    }


    compile_node(nd: DialogStory| DialogNode) : Instruction[]{
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
            this.compile_story(nd as DialogStory, out);
        } else {
            this.compile_node2(nd as DialogNode, out);
        }
        

        return out;
    }

    compile_story(st: DialogStory,  out: Instruction[]) {

        st.speakers.forEach((sp,idx)=>{
            switch (sp.type) {
                case DialogSpeakerType.attribute:
                    out.push({value:22},       //nahodne
                             {value:sp.attribute || 0},
                             {value:sp.param || 99},
                             {value:130}, //save_name
                             {value:idx+1});
                    break;
                case DialogSpeakerType.random:
                    out.push({value:22},       //nahodne
                             {value:0},
                             {value:0},
                             {value:130}, //save_name
                             {value:idx+1});
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
            const t = this.nodes.map.get(nd);
            if (t !== undefined) {
                out.push({value:139}); //goto paragraph
                out.push({value:t});    //pgf id
            }
        }
    }

    //pops from stack (ignore result)
    pop_item(b: boolean, out: Instruction[]) {
        if (b) out.push({value:3});
        return false;
    }
    push_iff(b: boolean, out: Instruction[]) {
        if (!b) out.push({value: 20});
        return true;
    }

    compile_node2(nd: DialogNode, out: Instruction[]) {

        this.cur_node_id = this.nodes.map.get(nd) || 0;
        this.cur_node = nd;

        if (nd.action && nd.action.ast) {
            this.pop_item(this.compile_ast(nd.action.ast, out), out);
        }

        nd.branches.forEach(b=>{
            const brnch : Instruction[] = [];
            const condinstr : Instruction[] = [];
            if (b.condition) {
                const st = this.nodes.stories.get(nd);
                if (st) {
                    const cond = st.conditions[b.condition];
                    if (cond && cond.ast) {
                        this.compile_ast(cond.ast, condinstr);
                    }
                }
            }            
            if (b.speaker) {
                brnch.push({value:132}); //load_name;
                brnch.push({value:b.speaker});
            }
            const target =(b.target === null)?0:(this.nodes.map.get(b.target) || 0);
            switch (b.type) {
                case DialogBranchType.addstory:
                    brnch.push({value:162}); //add to story                                        
                    brnch.push({text:b.text});
                    brnch.push({value:139}); //goto paragraph;
                    brnch.push({value:target});                    
                    break;
                case DialogBranchType.choice:
                    brnch.push({value:142}); //add choice
                    brnch.push({value:target})
                    break;
                case DialogBranchType.jump_to_node:
                    brnch.push({value:139}); //goto paragraph;
                    brnch.push({value:target});         
                    break;
                case DialogBranchType.npctalk:
                    brnch.push({value:148});
                    brnch.push({text:b.text});
                    brnch.push({value:144});
                    brnch.push({value:139})
                    brnch.push({value:target})
                case DialogBranchType.selchar:
                    brnch.push({value:175}); //ask who
                    brnch.push({text: b.text})
                    brnch.push({value:0}); //no jump
                    brnch.push({value:141}); //if !iff goto paragraph
                    brnch.push({value:target});         
                    break;
                case DialogBranchType.seldead:
                    brnch.push({value:189}); //select dead
                    brnch.push({value:175}); //ask who
                    brnch.push({text: b.text})
                    brnch.push({value:0}); //no jump
                    brnch.push({value:141}); //if !iff goto paragraph
                    brnch.push({value:target});         
                    break;
            }
            if (condinstr.length) {
                out.push(...condinstr);
                out.push({value: 169}); //if !iff jump
                out.push({value: brnch.reduce((a,b)=>a+instruction_size(b),0)});
            }
            out.push(...brnch);
        })


        switch (nd.node_type) {
            case DlgNodeType.shopping:
                out.push({value:168});  //shopping
                out.push({value:nd.shop_id!});
                break;
            case DlgNodeType.battle:
                out.push({value:157});  //start_battle
                break;
            case DlgNodeType.standard:
                if (nd.branches.length) {
                    out.push({value:164});  //dialog select
                }
                    

        }
        out.push({value:255});  //exit dialog
    }

    compile_error(s: string) {
        throw new Error(s);
    }

    //return true, if push item on stack
    compile_ast(ast: any[], out: Instruction[]) : boolean {
        if (ast.length == 0) return true;
        const s = ast[0];
        switch (s) {
            case "str":  this.compile_error("String cannot be used in expression"); return true;
            case "num": out.push({value:ast[1] as number});return false;
            case "id":  return this.compile_identifier(ast[0] as string, out);
            case "call": {
                const n = ast[1];
                const def = functionList[n];
                if (!def) this.compile_error(`Unknown function ${n}`);
                const args = ast.slice(2).reverse();
                if (args.length != def[0].length) this.compile_error(`Function ${n} has incorrect count of arguments: Expected ${def[0].length}, found ${args.length}`);
                const arginstr : Instruction[] = [{value:def[1]}];                
                args.forEach((a,idx)=>{
                    const pos = args.length-idx-1;
                    const d = def[0][pos];
                    switch (d) {
                        case "s": if (a[0] != "str") this.compile_error(`Function ${n} expected string as argument ${pos+1}`);
                                  arginstr.push({text: a[1]});
                                  break;
                        case 'n': {
                            const dummy : Instruction[] = [];
                            this.compile_ast(a, dummy);
                            if (dummy[0].value === 1 && dummy.length == 2) {
                                arginstr.push(dummy[1]);
                            } else {
                                out.push(...dummy);
                                arginstr.push({pop:true});
                            }
                        }
                    }
                })
                out.push(...arginstr);
            }
            case ";": {
                const n = ast.length-1;
                if (n) {
                    for (let i = 1; i < n; ++i) {
                        this.pop_item(this.compile_ast(ast[i],out),out);
                    }
                    return this.compile_ast(ast[n],out);
                }
                return false;
            }
            case ":=" :
                this.compile_assignment(ast[1], ast[2], out);
                return false;
            case "!": {
                const r = this.compile_ast(ast[1], out);
                if (r) out.push({value:19});
                else out.push({value:131})
                return r;
            }
            case "||":
            case "&&":
                //compile condition - push 
                const p = this.compile_ast(ast[1], out);
                //if lefts result on stack, pop it as iff
                if (p) out.push({value:21});
                //contains branch
                const b : Instruction[] = [];
                //compile branch
                const r = this.compile_ast(ast[2], b);
                //contains else
                const e : Instruction[] = [];
                //if branch lefts result on stack, we must also push iff on other path
                if (r) {
                    //push iff 
                    e.push({value:20});
                    //else part, skip our push in other branch
                    b.push({value:171})
                    b.push({value:instruction_size(e[0])});                    
                }
                //calculate length of the branch
                const l = b.reduce((a,b)=>a+instruction_size(b),0);
                //for || if iff is true, skip branch
                if (s == '||') {
                    out.push({value:170});
                    out.push({value:l});
                //for && if iss is false, skip branch
                } else {
                    out.push({value:169});
                    out.push({value:l});
                }
                //add branch and else part
                out.push(...b, ...e);
                //return whethe result is on stack or iff
                return r;
            default: {
                for (let i = 1; i < ast.length; ++i) {
                    this.push_iff(this.compile_ast(ast[i],out),out);
                }

                const ops : Record<string, [number, boolean]> = {
                    "<":[14,false],
                    ">":[15,false],
                    "<=":[16,false],
                    ">=":[17,false],
                    "==":[12,false],
                    "!=":[13,false],
                    "+":[6,true],
                    "-":[7,true],
                    "*":[8,true],
                    "/":[9,true],
                    "--":[18,true]                    
                };
                const op = ops[s];
                if (!op) this.compile_error(`Internal error: Unsupported AST operation ${s}`);
                out.push({value: op[0]});
                return op[1];

            }
        }
    }

    compile_assignment(left: any[], right: any[], out: Instruction[]) {
        if (left[0] == "id") {
            const s: string = left[1];
            if (s.startsWith("stat.")) {
                const id = CharacterStatVariables[s];
                if (id !== undefined) {
                    this.push_iff(this.compile_ast(right, out),out);
                    out.push({value:176}); //attributes
                    out.push({value:id});
                    out.push({pop:true}); //pop as argument
                } else {
                    this.compile_error(`Unknown stat: ${s} not in ${Object.keys(CharacterStatVariables).join(",")}`);
                }                
            } else if (s.startsWith("weapon_bonus.")) {
                const id = CharacterWeaponBonusVariables[s];
                if (id !== undefined) {
                    this.push_iff(this.compile_ast(right, out),out);
                    out.push({value:25}); //equipment
                    out.push({value:176}); //attributes
                    out.push({value:id+100});
                    out.push({pop:true}); //pop as argument
                } else {
                    this.compile_error(`Unknown bonus slot: ${s} not in ${Object.keys(CharacterWeaponBonusVariables).join(",")}`);
                }
            } else if (this.consts[s]) {
                this.compile_error(`Cannot assign to a constant: ${s}`);
            } else {
                const d: Instruction[] = [];
                this.compile_identifier(s, d);
                if (d.length < 2 || d[0].value !== 1) {
                    this.compile_error(`Cannot assign to this variable: ${s}`);
                }
                this.push_iff(this.compile_ast(right, out),out);
                out.push({value:2});
                out.push({value:this.reg_id(s,true)});
            }
        } else {
            this.compile_error("internal error - assignment to non-identifier");            
        }    
    }

    //return true, if push item on stack
    compile_identifier(s: string, out: Instruction[]) : boolean{
        if (s.startsWith("stat.")) {
            const id = CharacterStatVariables[s];
            if (id !== undefined) {
                out.push({value:23}); //attributes
                out.push({value:id});
            } else {
                this.compile_error(`Unknown stat: ${s} not in ${Object.keys(CharacterStatVariables).join(",")}`);
            }
            return true;
        } else if (s.startsWith("equipment.")) {
            const id = HumanWearPlaceVariables[s];
            if (id !== undefined) {
                out.push({value:24}); //equipment
                out.push({value:id});
            } else {
                this.compile_error(`Unknown slot: ${s} not in ${Object.keys(HumanWearPlaceVariables).join(",")}`);
            }
            return true;
        } else if (s.startsWith("weapon_bonus.")) {
            const id = CharacterWeaponBonusVariables[s];
            if (id !== undefined) {
                out.push({value:25}); //equipment
                out.push({value:id});
            } else {
                this.compile_error(`Unknown bonus slot: ${s} not in ${Object.keys(CharacterWeaponBonusVariables).join(",")}`);
            }
            return true;
        } else {
            switch (s) {
                case "face_id": out.push({value:34});return true;
                case "first_visited":out.push({value:166},{value:this.cur_node_id});return false;
                case "whole_group": out.push({value:185});return false;
                case "slot_count": out.push({value:27});return true;
                case "is_present": out.push({value:41});return false;
                case "money": out.push({value:42});return true;
                case "gender": out.push({value:26});return true;
                case "character_sector": out.push({value:35});return true;
                case "slot_present": out.push({value:28});return true;
                case "enemy": out.push({value:43});return false;                
                case "north": out.push({value:1},{value:0});return true;                
                case "east": out.push({value:1},{value:1});return true;                
                case "south": out.push({value:1},{value:2});return true;                
                case "west": out.push({value:1},{value:3});return true;                
                case "true": out.push({value:138},{value:1});return false;                
                case "false": out.push({value:138},{value:0});return false;                
                case "position.sector": out.push({value:47});return true;
                case "position.direction": out.push({value:48});return true;
                case "random": out.push({value: 49});return true;
                default :
                    if (s in this.consts) {
                        out.push({value:1}) //push;
                        out.push({value:this.consts[s].value});            
                    } else {
                        if (this.is_id(s)) {
                            //can also refer condition
                            if (this.cur_node) {
                                const st = this.nodes.stories.get(this.cur_node);
                                if (st && st.conditions[s] && st.conditions[s].ast) {
                                    return this.compile_ast(st.conditions[s].ast, out);
                                }
                            }
                        }
                        out.push({value:1});
                        out.push({variable:this.reg_id(s,false)});
                    }
                    return true;
            }
        }        
    }

    resolve_call(name: string, param_count: number, out: Instruction[]): boolean {

        return false;
    }

}

