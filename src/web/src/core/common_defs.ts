
export const ElementType = {
    FIRE:0,
    WATER:1,
    EARTH:2,
    AIR:3,
    MIND:4
} as const;


export const ElementTypeName = [
    "Fire","Water","Earth","Air","Mind"
] as const;


export const SpellEffects = {
    "SPL_INVIS": 0x1,           
    "SPL_OKO": 0x2,             
    "SPL_TVAR": 0x4,            
    "SPL_DRAIN": 0x8,           
    "SPL_MANASHIELD": 0x10,     
    "SPL_SANC": 0x20,           
    "SPL_HSANC": 0x40,          
    "SPL_BLIND": 0x80,          
    "SPL_REGEN": 0x100,         
    "SPL_ICE_RES": 0x200,       
    "SPL_FIRE_RES": 0x400,      
    "SPL_KNOCK":   0x800,       
    "SPL_FEAR":    0x1000,      
    "SPL_STONED":  0x2000,      
    "SPL_LEVITATION": 0x4000,   
} as const;
export type SpellEffectsType = typeof SpellEffects[keyof typeof SpellEffects];

export const SpellEffectName = [
    "Invisibility","Eye by eye","Defense Stance","Live Drain","Mana Shield","Psych. resistance","Mag. resistance",
    "Blind","Battle Regen","Cold protection","Hot protection","Knock back","Fear","Stoned","Levitation"
]

export const CharacterStats = {
    "VLS_SILA":    0,
    "VLS_SMAGIE":  1,
    "VLS_POHYB":   2,
    "VLS_OBRAT":   3,
    "VLS_MAXHIT":  4,
    "VLS_KONDIC":  5,
    "VLS_MAXMANA": 6,
    "VLS_OBRAN_L": 7,
    "VLS_OBRAN_H": 8,
    "VLS_UTOK_L":  9,
    "VLS_UTOK_H":  10,
    "VLS_OHEN":    11,
    "VLS_VODA":    12,
    "VLS_ZEME":    13,
    "VLS_VZDUCH":  14,
    "VLS_MYSL":    15,
    "VLS_HPREG":   16,
    "VLS_MPREG":   17,
    "VLS_VPREG":   18,
    "VLS_MGSIL_L": 19,
    "VLS_MGSIL_H": 20,
    "VLS_MGZIVEL": 21,
    "VLS_DAMAGE":  22,
    "VLS_KOUZLA":  23,
} as const;

export const CharacterStatsNames = [
    "Strength", "Magic", "Speed", "Dexterity", "Max HP","Max Vitality","Max mana","Defense Low","Defense High",
    "Attack Low", "Attack High","Protection Fire","Protection Water","Protection Earth","Protection Air","Protection Mind",
    "HP Regeneration","Mana Regeneration","VP regeneration","Magic attack Low", "Magic attack High","Magic attack element","Damage","Effects"
] as const;

export function make_identifiers(prefix: string, list:readonly string[]) {
    const out : Record<string, number> = {};
    for (let i = 0; i < list.length; ++i) {
        const n = CharacterStatsNames[i];
        if (typeof n == "string") {
            const m = n.toLowerCase().replace(/[^a-z0-9]/g, "_");
            const s =  `${prefix}${m}`;
            out[s] = i;
        }
    }
    return out;
}

export const CharacterStatVariables = Object.freeze(make_identifiers("stat.",CharacterStatsNames));

export const CharacterStatsMinMaxs = [
    /*"VLS_SILA":*/    [0,100],
    /*"VLS_SMAGIE":*/  [0,100],
    /*"VLS_POHYB":*/   [0,100],
    /*"VLS_OBRAT":*/   [0,100],
    /*"VLS_MAXHIT":*/  [0,32767],
    /*"VLS_KONDIC":*/  [0,32767],
    /*"VLS_MAXMANA":*/ [0,32767],
    /*"VLS_OBRAN_L":*/ [0,32767],
    /*"VLS_OBRAN_H":*/ [0,32767],
    /*"VLS_UTOK_L":*/  [0,32767],
    /*"VLS_UTOK_H":*/  [0,32767],
    /*"VLS_OHEN":*/    [0,100],
    /*"VLS_VODA":*/    [-100,100],
    /*"VLS_ZEME":*/    [-100,100],
    /*"VLS_VZDUCH":*/  [-100,100],
    /*"VLS_MYSL":*/    [-100,100],
    /*"VLS_HPREG":*/   [-100,100],
    /*"VLS_MPREG":*/   [-100,100],
    /*"VLS_VPREG":*/   [-100,100],
    /*"VLS_MGSIL_L":*/ [0,32767],
    /*"VLS_MGSIL_H":*/ [0,32767],
    /*"VLS_MGZIVEL":*/ [0,4],
    /*"VLS_DAMAGE":*/  [0,32767],
    /*"VLS_KOUZLA":*/  [0,32767],
];

export const EnemyStats = CharacterStats;


export class StringList3 {
	map : Record<string, number> =  {};
	lst1: string[] = [];
	lst2: string[] = [];
	lst3: string[] = [];
	
	add( s1:string, s2:string, s3:string) : number{
        if (!s1 && !s2 && !s3) return 0;
        const key = `${s1}\n${s2}\n${s3}`;
        const v = this.map[key];
        if (v !== undefined) return v;
        this.lst1.push(s1);
        this.lst2.push(s2);
        this.lst3.push(s3);
        this.map[key] = this.lst1.length;
        return this.lst1.length;
	}
};

export class StringList1 {
	map: Record<string, number> = {};
	lst: string[] = []; 
	add( s1: string) : number {
		if (!s1) return 0;
        const v = this.map[s1];
        if (v !== undefined) return v;
        this.lst.push(s1);
        this.map[s1] = this.lst.length;
        return this.lst.length;

	}
};

export const CharacterWeaponBonus = {
        TPW_MEC: 0,
        TPW_SEKERA: 1,
        TPW_KLADIVO: 2,
        TPW_HUL: 3,
        TPW_DYKA: 4,
        TPW_STRELNA: 5,
        TPW_OST: 6,
        TPW_MAX: 7,
} as const;

export const CharacterWeaponBonusStr = ["Sword","Axe","Hammer","Staff","Dagger","Bow","Other"];

export const CharacterWeaponBonusVariables = Object.freeze(make_identifiers("weapon_bonus.",CharacterWeaponBonusStr));