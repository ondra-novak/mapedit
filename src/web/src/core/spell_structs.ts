import { BinaryIterator, BinaryWriter,type Schema } from "./binary";


const TKouzloSchema : Schema= {
    num:"uint16", //spell number
    um:"uint16",  //min require magic stat
    mge:"uint16", //mana cost
    pc:"uint16",      //zero 
    owner:"int16",    //zero
    accnum:"int16",   //spell category id, replaces spell with same id
    start:"uint32",   //script start address
    cil:"int16",      //type of target
    povaha:"uint8",   //attack spell or benefical spell
    backfire:"uint16", //spell for backfire
    wait:"uint16",     //zero
    delay:"uint16",    //zero
    flags:"uint8",  
    spellname:"char[28]", //name of spell
    teleport_target:"uint16", //zero
};

const TKouzloFlags = {
    NeedTargetBehind: 0x1,
    NeedTeleportTarget: 0x2
} as const;


const SpellInstruction = {
    zivel: 131,
    hpnorm_min: 135,
    hpnorm_max: 136,
    hpzivl_min: 137,
    hpzivl_max: 138,
    vlastnost: 139,
    vls_kolik: 140,
    trvani: 141,    
    throw_item: 142,
    create_item: 143,
    special: 146,
    pvls:  147,
    animace: 148,
    zvuk: 149,
    wait: 150,
    set: 151,
    reset: 152,
    drain_min: 153,
    drain_max: 154,
    accnum: 155,
    kondice: 156,
    mana: 157,
    create_weapon: 158,
    mana_clip: 159,
    mana_steal: 160,
    rand_min: 161,
    rand_max: 162,
    location_sector: 163,
    location_map: 164,
    location_dir: 165,
    location_x: 166,
    location_y: 167,
    spell_end: 255
} as const;

const SpellTarget = {
    C_kouzelnik: 0,
    C_postava: 1,
    C_policko: 2,
    C_druzina: 2,
    C_policko_pred: 3,
    C_mrtva_postava: 4,
    C_postava_jinde: 5,
    C_nahodna_postava: 6,
    C_jiny_cil: 7
} as const;

const SpellSpecialAction = {
    SP_AUTOMAP4:  1,
    SP_AUTOMAP8:  2,
    SP_AUTOMAP15: 3,
    SP_PRIPOJENI1: 4,
    SP_PRIPOJENI3: 5,
    SP_PRIPOJENIA: 6,
    SP_CHVENI: 7,
    SP_DEFAULT_EFFEKT: 8,
    SP_TRUE_SEEING: 9,
    SP_SCORE: 10,
    SP_HALUCINACE: 11,
    SP_TELEPORT: 12,
    SP_SUMMON: 13,
    SP_HLUBINA1: 14,
    SP_HLUBINA2: 15,
    SP_MANABAT: 16,
    SP_VAHY:  17,
    SP_RYCHLOST: 18,
    SP_VIR: 19,
    SP_DEMON1: 20,
    SP_DEMON2: 21,
    SP_DEMON3: 22,
    SP_VZPLANUTI1: 23,
    SP_VZPLANUTI2: 24,
    SP_VZPLANUTI3: 25,
    SP_PHASEDOOR: 26,
    SP_TELEPORT_SECT: 27,
} as const;

export const SpellArgument = {
    None: 0,
    Number: 1,
    Percent: 2,
    
    Element: 3,
    Stat: 4,
    EffectBit: 5,
    Item: 6,
    Special: 7,

    String: 16,
    SoundFile: 17,
    AnimationFile: 18,
    MapName: 19
} as const;

 const SpellArguments = [
    [SpellInstruction.zivel,SpellArgument.Element],
    [SpellInstruction.hpnorm_min,SpellArgument.Number],
    [SpellInstruction.hpnorm_max,SpellArgument.Number],
    [SpellInstruction.hpzivl_min,SpellArgument.Number],
    [SpellInstruction.hpzivl_max,SpellArgument.Number],
    [SpellInstruction.vlastnost,SpellArgument.Stat],
    [SpellInstruction.vls_kolik,SpellArgument.Number],
    [SpellInstruction.trvani,SpellArgument.Number],
    [SpellInstruction.throw_item,SpellArgument.Item],
    [SpellInstruction.create_item,SpellArgument.Item],
    [SpellInstruction.special,SpellArgument.Special],
    [SpellInstruction.pvls,SpellArgument.Percent],
    [SpellInstruction.animace,SpellArgument.AnimationFile],
    [SpellInstruction.zvuk,SpellArgument.SoundFile],
    [SpellInstruction.wait,SpellArgument.Number],
    [SpellInstruction.set,SpellArgument.EffectBit],
    [SpellInstruction.reset,SpellArgument.EffectBit],
    [SpellInstruction.drain_min,SpellArgument.Number],
    [SpellInstruction.drain_max,SpellArgument.Number],
    [SpellInstruction.kondice,SpellArgument.Number],
    [SpellInstruction.mana,SpellArgument.Number],
    [SpellInstruction.create_weapon,SpellArgument.Item],
    [SpellInstruction.mana_clip,SpellArgument.Number],
    [SpellInstruction.mana_steal,SpellArgument.Number],
    [SpellInstruction.rand_min,SpellArgument.Number],
    [SpellInstruction.rand_max,SpellArgument.Number],
    [SpellInstruction.location_sector,SpellArgument.Number],
    [SpellInstruction.location_map,SpellArgument.MapName],
    [SpellInstruction.location_dir,SpellArgument.Number],
    [SpellInstruction.location_x,SpellArgument.Number],
    [SpellInstruction.location_y,SpellArgument.Number],
]

interface SpellCommandDesc {
    instr: number[],
    action?: number
}

const SpellCommands : Record<string, SpellCommandDesc> = {
    setElement:{instr:[SpellInstruction.zivel]},
    physicalAttack: {instr:[SpellInstruction.hpnorm_min, SpellInstruction.hpnorm_max]},
    elementAttack: {instr:[SpellInstruction.hpzivl_min, SpellInstruction.hpzivl_max]},
    drainLive: {instr:[SpellInstruction.drain_min, SpellInstruction.drain_max]},
    alterStat: {instr:[SpellInstruction.vlastnost,SpellInstruction.vls_kolik]},
    alterStatPct: {instr:[SpellInstruction.vlastnost,SpellInstruction.pvls]},
    playSound: {instr:[SpellInstruction.zvuk]},
    playAnimation: {instr:[SpellInstruction.animace]},
    waitRounds: {instr:[SpellInstruction.trvani]},
    waitFrames: {instr:[SpellInstruction.wait]},
    throwItem: {instr:[SpellInstruction.throw_item]},
    createItem: {instr:[SpellInstruction.create_item]},
    setEffect: {instr:[SpellInstruction.set]},
    resetEffect: {instr:[SpellInstruction.reset]},
    alterVitality: {instr:[SpellInstruction.kondice]},
    alterManaNoClip: {instr:[SpellInstruction.mana]},
    alterMana: {instr:[SpellInstruction.mana_clip]},
    stealMana:  {instr:[SpellInstruction.mana_steal]},
    createWeapon: {instr:[SpellInstruction.create_weapon]},
 
    //specials
    spec_automap4: {instr:[],action: SpellSpecialAction.SP_AUTOMAP4},
    spec_automap8: {instr:[],action: SpellSpecialAction.SP_AUTOMAP8},
    spec_automap15: {instr:[],action: SpellSpecialAction.SP_AUTOMAP15},
    spec_gather1: {instr:[],action: SpellSpecialAction.SP_PRIPOJENI1},
    spec_gather3: {instr:[],action: SpellSpecialAction.SP_PRIPOJENI3},
    spec_gatherAll: {instr:[],action: SpellSpecialAction.SP_PRIPOJENIA},
    spec_earthquake: {instr:[],action: SpellSpecialAction.SP_CHVENI},
    spec_iconSpellEffect: {instr:[],action: SpellSpecialAction.SP_DEFAULT_EFFEKT},
    spec_TrueSeeing: {instr:[],action: SpellSpecialAction.SP_TRUE_SEEING},
    spec_ShowHP: {instr:[],action: SpellSpecialAction.SP_SCORE},
    spec_Halucinacion: {instr:[],action: SpellSpecialAction.SP_HALUCINACE},
    spec_teleport: {instr:[],action: SpellSpecialAction.SP_TELEPORT},
    spec_summon: {instr:[],action: SpellSpecialAction.SP_SUMMON},
    spec_abyss: {instr:[],action: SpellSpecialAction.SP_HLUBINA1},
    spec_abyss2: {instr:[],action: SpellSpecialAction.SP_HLUBINA2},
    spec_manabattery: {instr:[],action: SpellSpecialAction.SP_MANABAT},
    spec_scalesOfFate: {instr:[], action:SpellSpecialAction.SP_VAHY},
    spec_adjustSpeed: {instr:[], action:SpellSpecialAction.SP_RYCHLOST},
    spec_whirlpool: {instr:[], action:SpellSpecialAction.SP_VIR},
    spec_summonDemon1: {instr:[], action:SpellSpecialAction.SP_DEMON1},
    spec_summonDemon2: {instr:[], action:SpellSpecialAction.SP_DEMON2},
    spec_summonDemon3: {instr:[], action:SpellSpecialAction.SP_DEMON3},
    spec_incineration1:{instr:[SpellInstruction.rand_min,SpellInstruction.rand_max], action:SpellSpecialAction.SP_VZPLANUTI1},
    spec_incineration2:{instr:[SpellInstruction.rand_min,SpellInstruction.rand_max], action:SpellSpecialAction.SP_VZPLANUTI2},
    spec_incineration3:{instr:[SpellInstruction.rand_min,SpellInstruction.rand_max], action:SpellSpecialAction.SP_VZPLANUTI3},
    spec_phasedoor:{instr:[], action:SpellSpecialAction.SP_PHASEDOOR},
}

export const SpellCommandsArgs = Object.entries(SpellCommands)
    .reduce((s,r)=>{
        s[r[0]] = r[1].instr.map(i=>SpellArguments.find(k=>k[0] == i)![1]);
        return s;
    },{} as Record<string, number[]>);

interface SpellSimpleCmd {
    instr: number;
    arg: string | number;
    arg_type: number;
};

function parseSpellCmdList(buffer : ArrayBuffer) : SpellSimpleCmd[] {
    const ret : SpellSimpleCmd[] = [];
    const iter = new BinaryIterator(buffer);
    let cmd = iter.parse("uint8");
    while (cmd != SpellInstruction.spell_end) {
        const argType = SpellArguments.find(x=>x[0] == cmd)![1];        
        if (argType < 16) {
            if (argType  < 3) {
                const a = iter.parse("int16");
                ret.push({instr: cmd, arg: a, arg_type: argType});
            } else {
                const a = iter.parse("uint16");
                ret.push({instr: cmd, arg: a, arg_type: argType});
            }
        } else {
            const a = iter.parse_stringz();
            ret.push({instr: cmd, arg: a, arg_type: argType});
        }        
        cmd = iter.parse("uint8");
    }
    return ret;
}

interface SpellScriptCommand {
    command: string;
    args: (string | number)[];
}

function createScriptFromCmdList(lst: SpellSimpleCmd[]) {
    const cmd_map= new Map<number, string>();
    const action_map = new Map<number, string>();
    const ret : SpellScriptCommand[] = [];
    const cache : SpellSimpleCmd[] = [];

    for (let c in SpellCommands) {
        for (let a of SpellCommands[c].instr) if (SpellCommands[c].action === undefined) {
            cmd_map.set(a, c);
        }
        const act = SpellCommands[c].action;
        if (act) {
            action_map.set(act, c);
        }
    }

    for (let cmd of lst) {
        cache[cmd.instr] = cmd;
        const defname = (cmd.instr == SpellInstruction.special && action_map.get(cmd.arg as number))
                            || cmd_map.get(cmd.instr);        
        if (defname) {
            const def = SpellCommands[defname];
            const missing = def.instr.find(x=>!cache[x]);
            if (missing == undefined) {
                const args = def.instr.map(x=>cache[x].arg);
                def.instr.forEach(x=>delete cache[x]);
                ret.push({command: defname,args:args});
            }
        }
    }
    return ret;
}


export interface TKouzlo {
    num:number, //spell number
    um:number,  //min require magic stat
    mge:number, //mana cost
    pc:number,      //zero 
    owner:number,    //zero
    accnum:number,   //spell category id, replaces spell with same id
    start:number,   //script start address
    cil:number,      //type of target
    povaha:number,   //attack spell or benefical spell
    flags:number,  //1 - any enemy in front player
    backfire:number, //spell for backfire
    wait:number,     //zero
    delay:number,    //zero
    spellname:string
    teleport_target:number, //zero
    script?: SpellScriptCommand[];
}

export function spellsFromArrayBuffer(buff: ArrayBuffer) : TKouzlo[] {
    const iter = new BinaryIterator(buff);
    const first = iter.parse(TKouzloSchema) as TKouzlo;
    const ofs = first.start;
    const defblock = buff.slice(0, ofs);
    const iter_lst = new BinaryIterator(defblock);

    const lst : TKouzlo[]= [];

    let n :number = 0;
    while (!iter_lst.eof()) {
        const r =  iter_lst.parse(TKouzloSchema);
        r.num = n;
        ++n;
        if (!("spellname" in r) ) break;
        if (r.start == 0) continue;
        lst.push(r as TKouzlo) ;        
    }
    lst.forEach(itm=>{
        itm.script = createScriptFromCmdList(parseSpellCmdList(buff.slice(itm.start)));
    });
    return lst.sort((a,b)=>a.num-b.num);    
}

function buildScript(script: SpellScriptCommand[]) {
    const wr = new BinaryWriter();
    for (const cmd of script) {
        const frag = SpellCommands[cmd.command];
        if (frag && frag.instr.length == cmd.args.length) {
            for (let i = 0; i < frag.instr.length; i++) {
                const element = frag.instr[i];
                const arg = SpellArguments.find(x=>x[0] == element);
                if (arg) {
                    wr.write("uint8",element);
                    const type = arg[1];
                    if (type < 3) {
                        wr.write("int16", cmd.args[i]);
                    } else if (type < 16) {
                        wr.write("uint16", cmd.args[i]);
                    } else {
                        wr.write_stringz(cmd.args[i] as string);
                    }
                }                               
            }
            if (frag.action) {
                wr.write("uint8", SpellInstruction.special);
                wr.write("uint16", frag.action);
            }
        }
    }
    wr.write("uint8", SpellInstruction.spell_end);
    return wr.getBuffer();
}

export function spellsToArrayBuffer(spells: TKouzlo[]) : ArrayBuffer {
    let len = 104;
    for (const k of spells) {if (k.num > len) len = k.num;}
    ++len;
    const fakeBuff = new ArrayBuffer(1000);
    const spell_table  = new Array(len).fill(0).map(_=>new BinaryIterator(fakeBuff).parse(TKouzloSchema) as TKouzlo);
    const all_scripts = new Array(len).fill(null);
    for (const k of spells) {
        if (k.script) all_scripts[k.num] = buildScript(k.script);        
        spell_table[k.num] = {...k, start: 1};
    }

    const tmp=new BinaryWriter();
    tmp.write(TKouzloSchema, spell_table[0]);
    const blen = tmp.getBuffer().byteLength;

    let offset = blen * len;

    for (let i = 0; i < len; ++i) {
        if (spell_table[i].start) {
            spell_table[i].start = offset;
        }
        if (all_scripts[i]) offset+=all_scripts[i].byteLength;
    }

    const fin = new BinaryWriter();
    for (let i = 0; i < len; ++i) {
        fin.write(TKouzloSchema, spell_table[i]);        
    }
    for (let i = 0; i < len; ++i) {
        if (all_scripts[i]) fin.write_buffer(all_scripts[i]);
    }

    return fin.getBuffer();

}