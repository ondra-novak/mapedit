import { BinaryIterator, BinaryWriter, make1DArray, type Schema } from "./binary";
import { HumanWearPlaceVariables } from "./character_structs";
import { CharacterStatVariables, CharacterWeaponBonus, CharacterWeaponBonusVariables, type CharacterStats } from "./common_defs";
import type { directions } from "./map_structs";
import type { TranslateTable } from "./translate";

export const MAX_IDENTIFIERS = 100;

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

  
export interface Instruction {
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
        const txt = instr.text ?? "";        
        const cz = 
        iter.write("uint8",1);
        iter.write_stringz(txt.substring(0,4000));
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

        const offset_set : number[] = [];
        pgf_map.forEach((v)=>offset_set.push(v));
        offset_set.sort((a,b)=>a - b);

        const state = {local_pgf: 0};
        const initial = 8*count+8;
        for (const itm of pgf_map) {
            const beg = itm[1];
            const idx = offset_set.findIndex(x=>x == beg);
            if (idx < 0) throw Error("Internal error");
            const end = idx+1 == offset_set.length?buffer.byteLength:offset_set[idx+1];
            const part = buffer.slice(initial+beg, initial+end);
            this.pgfs[itm[0]] = DialogDef.parse_code(part,state);
        }
        const m = this.pgfs.reduce((a, v,idx)=>{a.push([idx,v]);return a},[] as [number,any][] );
        console.log(Object.fromEntries(m));
        const mm = new Set<string>;
        m.forEach(x=>x[1].forEach((y:["string",any])=>mm.add(y[0])));
        console.log(mm);
        return pgf_map;
    }

    toObject() {
        const m = this.pgfs.reduce((a, v,idx)=>{a.push([idx,v]);return a},[] as [number,any][] );
        return Object.fromEntries(m);
    }


    static instruction_table : Record<number, [string, number]>= {
        1: ["stk_push",1],
        2: ["stk_pop_var",1],
        3: ["stk_del",0],
        4: ["stk_copy",0],
        5: ["stk_swap",0],
        6: ["+",0],
        7: ["-",0],
        8: ["*",0],
        9: ["/",0],
        10: ["&&",0],
        11: ["||",0],
        12: ["==",0],
        13: ["!=",0],
        14: ["<",0],
        15: [">",0],
        16: ["<=",0],
        17: [">=",0],
        18: ["un-",0],
        19: ["un!",0],
        20: ["push iff",0],
        21: ["pop iff",0],
        22: ["speaker",2],
        23: ["stk_push stat.",1],
        24: ["stk_push equip.",1],
        25: ["stk_push weapon_bonus.",1],
        26: ["stk_push gender",0],
        27: ["stk_push count_slots",0],
        28: ["stk_push count_present",0],
        29: ["speaker_xicht",1],
        30: ["q_fact",1],
        31: ["set_fact",1],
        32: ["reset_fact",1],
        33: ["teleport_char",3],
        34: ["stk_push xicht",0],
        35: ["stk_push sector",0],
        36: ["change_music",1],
        37: ["replace_monster",1],
        38: ["replace_monsters",2],
        39: ["replace_monsters_r",4],
        40: ["cast_spell_enemy",1],
        41: ["is_present",0],
        42: ["stk_push money",0],
        43: ["is_enemy_dialog",0],
        45: ["get_lever",2],
        46: ["load_level",3],
        47: ["stk_push viewsector",0],
        48: ["stk_push viewdir",0],
        49: ["stk_push random",0],
        50: ["stk_push held_item",0],
        51: ["iff = no choices",0],
        52: ["kill_current_enemy",0],
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
        139: ["goto_node",1],
        140: ["goto_node_iff",1],
        141: ["goto_node_not_iff",1],
        142: ["add_choice",2],
        143: ["add_choice_iff", 3],
        144: ["select_choice", 0],
        145: ["visited",1],
        146: ["add_choice_not_visited", 2],
        147: ["picture",1],
        148: ["echo",1],
        149: ["add_to_book",1],
        150: ["set_nvisited",1],
        151: ["random_roll",1],
        152: ["have_item",1],
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
        164: ["pause",0],
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
        179: ["have_rune",1],
        180: ["have_money",1],
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
        202: ["is_rune",1],
        203: ["send_enemies",2],
        204: ["send_current_enemy",1],
        205: ["teleport_enemies", 3],
        206: ["teleport_current_enemy", 3],
        518: ["set_flag",1],
        519: ["reset_flag",1],
        255: ["exit_dialog",0]
    }


    static is_exit_code(c: number) {
        return (c== 165|| c == 255 || c == 139 || c == 144);
    }


    static parse_code(buffer: ArrayBuffer, state: {local_pgf: number}) : [string, Instruction[] ][] {
        const iter = new BinaryIterator(buffer);
        const out : [string,Instruction[]][] = [];
        const label_map = new Map<number, number>()
        let fill_jump : [number,number][] = [];
        try {
            while (true) {
                while(!iter.eof()) {                
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
    ///if true, condition is inverted
    invert_condition?: boolean;
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

export type DialogIdentifierList = Record<string, {
    read?: [number, number],
    write?: [number, number]
    slot: number;
}>;


function instruction_size(i: Instruction) {
    if ("text" in i) return 1+i.text!.length+1;  //text instruction has 1+text_length+zero
    else if (i.pop) return 1;
    else return 3;  //otherwise 3 bytes
}

export class DialogManager {
    _dlg: Record<number, DialogStory> = {};
    _consts: Record<string, DialogConstant> = {};
    _identifiers: DialogIdentifierList = {};
    _compat: boolean = false; //compatibility mode

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

    story_to_node(story_id: number) {
        if (this._compat) return story_id * 128;
        else return story_id;
        
    }

    save() : string {
        return JSON.stringify({
            "dialogs":this._dlg,
            "constants":this._consts, 
            "identifiers": this._identifiers,
            "compat":this._compat
        });
    }

    load(txt:string) {
        const s = JSON.parse(txt);;
        this._dlg = s["dialogs"];
        this._consts = s["constants"] || {};
        this._identifiers = s["identifiers"] || {};
        this._compat = s["compat"];
    }

    compile(consts: Record<string, DialogConstant> ) {
        const compiler = new DialogCompiler(this, consts);
        return compiler.compile();
    }

    generate_dat(instructions: Instruction[][]) {
        const mwr = new BinaryWriter();
        const datawr = new BinaryWriter();
        const offsets : DialogParagraphDef[] = [];
        const count_nodes = instructions.reduce(a=>a+1,0);
        instructions.forEach((data, id)=>{
            const pgf = new DialogParagraphDef;            
            pgf.header={id:id,alt:id,second_visit:false,visited:false};
            pgf.position = datawr.length() ;
            offsets[id] = pgf;
            data.forEach(instr=>write_instruction(datawr, instr));
        });
        mwr.write("uint32", count_nodes);
        mwr.write("uint32", 0);
        offsets.forEach(x=>mwr.write(x.getSchema(), x));
        mwr.write_buffer(datawr.getBuffer());
        return mwr.getBuffer();    
    }

    generate_translation(tbl: TranslateTable) {
        const t = tbl.openFile("dialog")
        for (const stk in this._dlg) {
            const st = this._dlg[stk];
            if (st.description) t.store(`${stk}`, st.description);
            for (const ndk in st.nodes) {
                const nd = st.nodes[ndk];
                if (nd.description) t.store(`${stk}:${ndk}`, nd.description);
                nd.branches.forEach((b,idx)=>{
                    if (b.text) t.store(`${stk}:${ndk}:${idx}`, b.text);
                });
            }
        }
    }

    translate(tbl: TranslateTable) {
        const t = tbl.openFile("dialog")
        for (const stk in this._dlg) {
            const st = this._dlg[stk];
            t.translate(`${stk}`, "description", st);
            for (const ndk in st.nodes) {
                const nd = st.nodes[ndk];
                t.translate(`${stk}:${ndk}`, "description", nd);
                nd.branches.forEach((b,idx)=>{
                    t.translate(`${stk}:${ndk}:${idx}`, "text", b);
                });
            }
        }
    }
}


// name, param type - n=number,s=string,r=node ref, code
type FunctionList = Record<string,[ ('n'|'s'|'r')[], number]>;

const functionList: FunctionList = 
{
    "have_item":[['n'],152],
    "have_money":[['n'],180],
    "pay":[['n'],156],
    "add_money":[['n'],155],
    "set_flag":[['n'],518],
    "is_flag":[['n'],163],
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
    "time_skip":[['n','n'],182],
    "eat":[['n'],184],
    "change_music":[['s'],36],
    "play_sound":[['s'],190],
    "replace_monster":[['n'],37],
    "replace_monsters":[['n','n'],38],
    "replace_monsters_radius":[['n','n','n','n'],39],
    "cast_spell":[['n'],188],
    "cast_to_enemy":[['n'],40],
    "enable_global_map":[['n'],186],
    "teleport_enemies":[['n','n','n'], 205],
    "teleport_current_enemy":[['n','n'],206],
    "send_enemy":[['n','n'],203],
    "send_current_enemy":[['n'],204],
    "visited":[['r'],145],
    "kill_current_enemy":[[],52]
};

export class DialogCompileError extends Error {
  location: [number, number]|null;
  cause?: unknown;

  constructor(location: [number, number]|null, message: string, cause?: unknown) {
    super(message);
    this.name = "CompileError";
    this.location = location;
    this.cause = cause;
  }
}


class DialogCompiler {

    

    consts: Record<string, DialogConstant> ;        
    identifiers:  DialogIdentifierList;
    used_slots = new Set<number>;
    cur_node_id:number = 0;
    cur_node: DialogNode|null = null;

    nodes : (DialogStory|DialogNode)[] = [];
    map : Map<DialogStory|DialogNode, number> = new Map;
    local_map : Map<DialogStory|DialogNode, number> = new Map;
    stories : Map<DialogNode, DialogStory> = new Map;
    compat: boolean;
    

    node_id_from_target(node: DialogNode, target: number|null) {
        if (target === null) return 0;        
        const st = this.stories.get(node);
        if (!st) {
            this.compile_error("Internal error: node_id_from_target - no story from node");
            return 0;
        }
        const tnode = st.nodes[target];
        const id = this.map.get(tnode);
        if (typeof id != "number") {
            this.compile_error("Internal error: node_id_from_target - can't map node to id");
            return 0;
        }
        return id;
    }


    create_node_map(d: DialogManager)  {        
        for (const id in d._dlg) {
            const st = d._dlg[id];
            const iid = parseInt(id);
            const vid = iid * (this.compat?128:1);
            this.nodes[vid] = st;
            this.map.set(st, vid);
            this.local_map.set(st, iid);
        }
        let idx = 1;
        for (const id in d._dlg) {
            const st = d._dlg[id];
            for (const subid in st.nodes) {                
                while (this.nodes[idx]) ++idx;
                this.nodes[idx] = st.nodes[subid];
                this.map.set(st.nodes[subid], idx);
                this.stories.set(st.nodes[subid], st);
                this.local_map.set(st.nodes[subid], parseInt(subid));
            }
        }
        const exitNode : DialogNode = {
            node_type:DlgNodeType.standard,
            branches:[],      
            name:""      
        }
        this.nodes[0] = exitNode;
        this.map.set(exitNode, 0);
    }


    constructor(dlgm: DialogManager, external_consts: Record<string, DialogConstant> ) {
        this.compat = dlgm._compat;
        this.create_node_map(dlgm);
        this.identifiers = dlgm._identifiers;
        this.consts = Object.assign(Object.assign({},external_consts), dlgm._consts);
        for (const s in this.identifiers) {
            const iinfo = this.identifiers[s];
            this.used_slots.add(iinfo.slot);
            delete iinfo.read;
            delete iinfo.write;
        }
    }

    find_node_location(node: DialogNode|null) : [number, number]|null {
        if (node === null) return null;
        const story = this.stories.get(node);
        if (!story) return null;
        const story_id = this.local_map.get(story);
        const node_id = this.local_map.get(node);
        if (typeof story_id == "number" && typeof node_id == "number") {
            return [story_id, node_id];
        }
        return null;

    }

    compile(): Instruction[][] {

        let out;
        try {
            out = this.nodes.map(nd=>{
                return this.compile_node(nd);
            })
        } catch (e) {
            let s = "unknown location";
            const loc = this.find_node_location(this.cur_node);
            if (loc) s = `story #${loc[0]}, node #${loc[1]}`;
            throw new DialogCompileError(loc, (e as Error).message + ` at ${s}`, e);
        }
        for (const n in this.identifiers) {
            const i = this.identifiers[n];
            if (i.read && !i.write) throw new DialogCompileError(i.read, `Reference of undefined variable '${n}'` );
        }
        return out;
    }

    reg_id(s: string, assignment: boolean) {
        let v = this.identifiers[s];
        if (!v) {
            let id = 0;
            while (id <= MAX_IDENTIFIERS && this.used_slots.has(id)) ++id;            
            if (id == MAX_IDENTIFIERS)  this.compile_error(`Too many variables! There is limit for variable count: ${MAX_IDENTIFIERS} variable for whole adventure`);
            v = this.identifiers[s] = {slot: id};
        }
        const loc = this.find_node_location(this.cur_node);
        if (loc) {
            if (assignment) v.write = loc; else v.read = loc;
        }
        return v.slot;
    }

    is_id(s: string) : boolean{
        let v = this.identifiers[s];
        return !!v;
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
            const t = this.map.get(nd);
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

        this.cur_node_id = this.map.get(nd) || 0;
        this.cur_node = nd;

        if (nd.action && nd.action.ast) {
            this.pop_item(this.compile_ast(nd.action.ast, out), out);
        }
        let choices = 0;
        let uncond_jump = false;

        nd.branches.forEach((b,idx)=>{
            const brnch : Instruction[] = [];
            const condinstr : Instruction[] = [];
            let inverted = !!b.invert_condition;
            //todo špatný target
            const target =this.node_id_from_target(nd, b.target);

            if (uncond_jump) {
                this.compile_error (`Branch ${idx+1} is never taken`);
            }

            if (b.condition) {                
                const st = this.stories.get(nd);
                if (st) {
                    const cond = st.conditions[b.condition];
                    if (cond && cond.ast) {
                        this.pop_item(this.compile_ast(cond.ast, condinstr), condinstr);
                    } else {
                        switch (b.condition) {
                            case "first visited":  condinstr.push({value:166},{value:this.cur_node_id});break;
                            case "is present": if (b.speaker) condinstr.push({value:132},{value: b.speaker});
                                               condinstr.push({value:41});
                                               break;
                            case "whole group": condinstr.push({value:185}); break;
                            case "target not visited yet": condinstr.push({value:145},{value:target}); inverted = !inverted;break;
                            case "no choices": condinstr.push({value:51});break;
                            default: this.compile_error(`Undefined condition "${b.condition}"`);break;
                        }
                    }
                    
                }
            }            
            let text = b.text ?? "";
            if (b.speaker) {
                text = `%${b.speaker}l` + text;
            }
            switch (b.type) {
                case DialogBranchType.addstory:
                    brnch.push({value:162}); //add to story                                        
                    brnch.push({text:text});
                    if (target == 0) {
                        brnch.push({value:255}); ///exit
                    } else {
                        brnch.push({value:139}); //goto paragraph;
                        brnch.push({value:target});                    
                    }
                    break;
                case DialogBranchType.choice:
                    brnch.push({value:142}); //add choice
                    brnch.push({value:target})
                    brnch.push({text:text});
                    ++choices;
                    break;
                case DialogBranchType.jump_to_node:
                    if (target ) {
                        if (condinstr.length) {
                            brnch.push(...condinstr);
                            condinstr.splice(0);
                            if (inverted)  brnch.push({value:141}); //not iff  jump
                            else brnch.push({value:140}); //iff jump
                        } else {
                            uncond_jump = true;
                            brnch.push({value:139}); //goto paragraph;
                        }
                        brnch.push({value:target});         
                        out.push(...brnch);
                        return;
                    } else {
                        brnch.push({value:255}); ///exit
                        break;
                    }                    
                case DialogBranchType.npctalk:
                    brnch.push({value:148});
                    brnch.push({text:text});
                    brnch.push({value:164});
                    if (target) {
                        brnch.push({value:139})
                        brnch.push({value:target})
                    } else {
                        brnch.push({value:255}); ///exit
                    }
                    break;
                case DialogBranchType.selchar:
                    brnch.push({value:175}); //ask who
                    brnch.push({text: text})
                    brnch.push({value:0}); //no jump
                    brnch.push({value:141}); //if !iff goto paragraph
                    brnch.push({value:target});         
                    break;
                case DialogBranchType.seldead:
                    brnch.push({value:189}); //select dead
                    brnch.push({value:175}); //ask who
                    brnch.push({text: text})
                    brnch.push({value:0}); //no jump
                    brnch.push({value:141}); //if !iff goto paragraph
                    brnch.push({value:target});         
                    break;
            }
            if (condinstr.length) {
                out.push(...condinstr);
                out.push({value: inverted?170:169}); //if !iff jump
                out.push({value: brnch.reduce((a,b)=>a+instruction_size(b),0)});
            } else {
                if (b.type == DialogBranchType.npctalk || b.type == DialogBranchType.addstory) uncond_jump = true;
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
            default:
                if (choices) {
                    out.push({value:144});  //dialog select
                    return;
                }
                    

        }
        if (!uncond_jump) {
            out.push({value:255});  //exit dialog
        }
    }

    compile_error(s: string) {
        throw new Error(s);
    }

    //return true, if push item on stack
    compile_ast(ast: any[], out: Instruction[]) : boolean {
        if (ast.length == 0) return false;
        const s = ast[0];
        if (!s) return false; //temporary fix, ast was originally initialized as {};
        switch (s) {
            case "str":  this.compile_error("String cannot be used in expression"); return false;
            case "num": out.push({value: 1},{value:ast[1] as number});return true;
            case "id":  return this.compile_identifier(ast[1] as string, out);
            case "call": {
                const n = ast[1];
                const args = ast.slice(2).reverse();
                if (n == "condition") {
                    if (args.length != 1) {
                        this.compile_error(`Function ${n} must have 1 argument`);
                    }
                    if (args[0][0] != "str") {
                        this.compile_error(`Function ${n} expected string`);
                    }
                    const cond_name = args[0][1] as string;
                    if (this.cur_node) {
                        const st = this.stories.get(this.cur_node);
                        if (st) {
                            const cond = st.conditions[cond_name];
                            if (cond && cond.ast) {
                                return this.compile_ast(cond.ast, out);
                            }
                        }
                    }
                    this.compile_error(`Condition ${cond_name} is not defined`);
                } else {
                    const def = functionList[n];
                    if (!def) this.compile_error(`Unknown function ${n}`);
                    if (args.length != def[0].length) this.compile_error(`Function ${n} has incorrect count of arguments: Expected ${def[0].length}, found ${args.length}`);
                    const arginstr : Instruction[] = [];                
                    args.forEach((a,idx)=>{
                        const pos = args.length-idx-1;
                        const d = def[0][pos];
                        switch (d) {
                            case "s": if (a[0] != "str") this.compile_error(`Function "${n}()" expected string as argument ${pos+1}`);
                                    arginstr.unshift({text: a[1]});
                                    break;
                            case 'n': {
                                const dummy : Instruction[] = [];
                                const dirconst = this.compile_likely_constant(a, out);
                                if (dirconst) {
                                    arginstr.unshift(dirconst);
                                } else {
                                    arginstr.unshift({pop:true});
                                }
                            }
                            break;
                            case 'r': {
                                const dirconst = this.compile_likely_constant(a, out);
                                if (dirconst) {
                                    const nd = dirconst.value!;    
                                    try {
                                        const ndid = this.node_id_from_target(this.cur_node!, nd);
                                        arginstr.unshift({value:ndid});
                                    } catch (e) {
                                        this.compile_error(`Function "${n}()" - node not found`);
                                    }
                                } else {
                                    this.compile_error(`Argument of "${n}()" must be number: id of node. Expression is not allowed`)
                                }
                            }
                            break;
                        }
                    })
                    out.push({value:def[1]},...arginstr);
                    return false;
                }
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

    compile_likely_constant(ast: any[], out: Instruction[]) {
        const dummy : Instruction[] =  [];
        this.push_iff(this.compile_ast(ast, dummy), dummy);
        if (dummy.length == 2 && dummy[0].value == 1) {
            return dummy[1];
        } else {
            out.push(...dummy);
            return null;
        }

    }

    compile_assignment(left: any[], right: any[], out: Instruction[]) {
        if (left[0] == "id") {
            const s: string = left[1];
            if (s.startsWith("stat.")) {
                const id = CharacterStatVariables[s];
                if (id !== undefined) {
                    const dirval = this.compile_likely_constant(right, out);
                    out.push({value:176}); //pract to
                    out.push({value:id});
                    if (dirval) out.push(dirval);else out.push({pop:true}); //pop as argument
                } else {
                    this.compile_error(`Unknown stat: ${s} not in ${Object.keys(CharacterStatVariables).join(",")}`);
                }                
            } else if (s.startsWith("weapon_bonus.")) {
                const id = CharacterWeaponBonusVariables[s];
                if (id !== undefined) {
                    const dirval = this.compile_likely_constant(right, out);
                    out.push({value:176}); //pract to
                    out.push({value:id+100});
                    if (dirval) out.push(dirval);else out.push({pop:true}); //pop as argument
                } else {
                    this.compile_error(`Unknown bonus slot: ${s} not in ${Object.keys(CharacterWeaponBonusVariables).join(",")}`);
                }
            } else if (this.consts[s]) {
                this.compile_error(`Cannot assign to a constant: ${s}`);
            } else {
                const d: Instruction[] = [];
                if (typeof this.compile_building_ident(s, d) == "boolean") {
                    this.compile_error(`Cannot assign to this variable: ${s}`);    
                }
                const dirval = this.compile_likely_constant(right, out);
                if (dirval) {
                    out.push({value:192});
                    out.push({value:this.reg_id(s,true)});
                    out.push(dirval);
                } else {
                    out.push({value:2});
                    out.push({value:this.reg_id(s,true)});
                }
            }
        } else {
            this.compile_error("internal error - assignment to non-identifier");            
        }    
    }

    compile_building_ident(s: string, out: Instruction[]) : boolean | null {
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
            case "held_item": out.push({value: 50});return true;
            default :
                if (s in this.consts) {
                    out.push({value:1}) //push;
                    out.push({value:this.consts[s].value});            
                    return true;
                }
                return null;
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
            const r = this.compile_building_ident(s, out);
            if (typeof r == "boolean") return r;
            out.push({value:1});
            out.push({variable:this.reg_id(s,false)});
            return true;
        }        
    }



}

