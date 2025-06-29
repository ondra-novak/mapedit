import ItemsEditor from "@/views/ItemsEditor.vue";
import { BinaryIterator, BinaryWriter, joinUint8Arrays, parseSection, splitArrayBuffer, writeSection, type Schema, type SectionInfo } from "./binary";
import { StringList1, StringList3 } from "./common_defs";
import { keybcs2_from_string } from "./keybcs2";


export const ItemSchema : Schema =  {
	"jmeno": "char[32]",
	"popis": "char[32]",
	"zmeny": ["int16",24],
	"podminky": ["int16",4],
	"hmotnost": "int16",
	"nosnost":"int16",
	"druh":"int16",
	"umisteni": "int16",
	"flags": "uint16",
	"spell":"int16",
	"magie":"int16",
	"sila_spell":"int16",
	"use_event": "int16",
	"ikona":"uint16",
	"vzhled":"uint16",
	"user_value": "int16",
	"keynum": "int16",
	"polohy": ["int16",2,2],
	"typ_zbrane": "uint8",
	"druh_sipu": "uint8",
	"sound": "int16",
	"v_letu": ["int16",16],
	"cena":"int32",
	"weapon_animation": "uint8",
	"hitpos": "uint8",
	"shiftup": "uint8",
	"byteres": "uint8",
	"rezerva": ["int16",12],
	} as const

export class ItemDef  {
	jmeno: string="";
	popis: string="";
	zmeny: number[]=new Array(24).fill(0);
	podminky: number[]=new Array(4).fill(0);
	hmotnost: number=0;
	nosnost:number=0;
	druh:number=0;
	umisteni:number=0;
	flags:number=0;
	spell:number=0;
	magie:number=0;
	sila_spell:number=0;
	use_event: number=0;
	ikona:number=0;
	vzhled:number=0;
	vzhled_on_ground?: string;
	vzhled_on_male?:string;
	vzhled_on_female?:string;
	user_value:number=0;
	keynum:number=0;
	polohy: number[][]=[[0,0],[0,0]];
	typ_zbrane: number=0;
	druh_sipu: number=0;
	sound: number=0;
	sound_file?:string=""
	v_letu: number[]=new Array(16).fill(0);
	v_letu_files? :string[];
	cena:number=0;
	weapon_animation:number=0;
	weapon_animation_file?:string;
	hitpos:number=0;
	shiftup:number=0;
	byteres:number=0;
	rezerva:number=0;
} ;

const SV_ITLIST =  0x8001;
const SV_SNDLIST =  0x8002;
const SV_ON_GROUND = 1
const SV_ON_MALE = 2
const SV_ON_FEMALE = 3
const SV_ON_FLY = 4
const SV_WEAPON_ANIM = 5
const SV_END =     0x8000;

function parseItems(iter: BinaryIterator) : ItemDef[] {
	const def : ItemDef[] = [];

	while (!iter.eof()) {
		const itm = iter.parse(ItemSchema);
		def.push(Object.assign(new ItemDef(),itm));
	}

	return def;

}

export function itemsFromArrayBuffer(buffer: ArrayBuffer) : ItemDef[]{
	const iter = new BinaryIterator(buffer);
	let items: ItemDef[] = [];
	let on_ground:string[] = [];
	let on_female:string[] = [];
	let on_male:string[] = [];
	let sounds: string[] =[];
	let in_fly: string[] = [];
	let animation: string[] = [];
	const dec = new TextDecoder();
	let sec: SectionInfo = parseSection(iter);
	while (sec.type != SV_END) {
	  switch(sec.type) {
		case SV_ITLIST:
			items = parseItems(new BinaryIterator(sec.data));
		  break;
		case SV_SNDLIST:
		  sounds = splitArrayBuffer(sec.data,0)
					.map(x=>dec.decode(x));
		  break;
		case SV_ON_GROUND:
		  on_ground = splitArrayBuffer(sec.data,0)
					.map(x=>dec.decode(x));
		  break;
		case SV_ON_MALE:
		  on_male= splitArrayBuffer(sec.data,0)
					.map(x=>dec.decode(x));
		  break;
		case SV_ON_FEMALE:
		  on_female = splitArrayBuffer(sec.data,0)
					.map(x=>dec.decode(x));
		  break;
		case SV_ON_FLY:
		  in_fly = splitArrayBuffer(sec.data,0)
					.map(x=>dec.decode(x));
		  break;
		case SV_WEAPON_ANIM:
		  animation = splitArrayBuffer(sec.data,0)
					.map(x=>dec.decode(x));

		  break;

	  }
	  sec = parseSection(iter);

	}
	animation.unshift("");
	sounds.unshift("");
	in_fly.unshift("");
	on_ground.unshift("");
	on_male.unshift("");
	on_female.unshift("");

	items.forEach((x:ItemDef)=>{
	  x.vzhled_on_ground = on_ground[x.vzhled];
	  x.vzhled_on_male = on_male[x.vzhled];
	  x.vzhled_on_female = on_female[x.vzhled];
	  x.v_letu_files = x.v_letu.map(y=>in_fly[y]);
	  x.weapon_animation_file = animation[x.weapon_animation];
	  x.sound_file = sounds[x.sound];
	});

	return items;
}



export function itemsToArrayBuffers(items : ItemDef[]) : ArrayBuffer {
    const vzhled = new StringList3();
    const v_letu = new StringList1();
    const weapon_animation = new StringList1();
    const sound = new StringList1();

    items.forEach(itm=>{
        itm.vzhled = vzhled.add(itm.vzhled_on_ground || "", itm.vzhled_on_male || "", itm.vzhled_on_female || "");
        itm.v_letu = (itm.v_letu_files || new Array(16).fill("")).map((s:string)=>v_letu.add(s));
        itm.weapon_animation = weapon_animation.add(itm.weapon_animation_file || "");
        itm.sound = sound.add(itm.sound_file || "");
    })
    const wr_items = new BinaryWriter();
    items.forEach(itm=>wr_items.write(ItemSchema,itm));
    const wr = new BinaryWriter();
    writeSection(wr,SV_ITLIST, wr_items.getBuffer());

    ([
        [SV_ON_GROUND, vzhled.lst1],
        [SV_ON_MALE, vzhled.lst2],
        [SV_ON_FEMALE, vzhled.lst3],
        [SV_ON_FLY, v_letu.lst],
        [SV_WEAPON_ANIM, weapon_animation.lst],
        [SV_SNDLIST, sound.lst]        
    ] as [number, string[] ][]).forEach((p)=> {
        const txt = p[1].map(t=>Uint8Array.from(keybcs2_from_string(t)));
        txt.push(Uint8Array.from([]));
        const buff = joinUint8Arrays(txt,0);
        writeSection(wr, p[0], buff.buffer);
    });
    writeSection(wr, SV_END, new ArrayBuffer());
    return wr.getBuffer();
}

export const ItemType = {
TYP_CONTAINER: 0,
TYP_UTOC: 1,
TYP_VRHACI: 2,
TYP_STRELNA: 3,
TYP_ZBROJ: 4,
TYP_SVITEK: 5,
TYP_LEKTVAR: 6,
TYP_VODA: 7,
TYP_JIDLO: 8,
TYP_SPECIALNI: 9,
TYP_RUNA: 10,
TYP_PENIZE: 11,
TYP_SVITXT: 12,
TYP_PRACH: 13,
TYP_OTHER: 14,
} as const;

export const ItemTypeName: string[] = [
	[ItemType.TYP_CONTAINER, "Container"],
	[ItemType.TYP_UTOC, "Melee Weapon"],
	[ItemType.TYP_VRHACI, "Throwing"],
	[ItemType.TYP_STRELNA, "Ranged Weapon"],
	[ItemType.TYP_ZBROJ, "Clothing"],
	[ItemType.TYP_SVITEK, "Scroll/Wand"],
	[ItemType.TYP_LEKTVAR, "Potion"],
	[ItemType.TYP_VODA, "Water"],
	[ItemType.TYP_JIDLO, "Food"],
	[ItemType.TYP_SPECIALNI, "Special"],
	[ItemType.TYP_RUNA, "Rune"],
	[ItemType.TYP_PENIZE, "Money"],
	[ItemType.TYP_SVITXT, "Book Page"],
	[ItemType.TYP_PRACH, "Dust"],
	[ItemType.TYP_OTHER, "Other"]
].reduce<string[]>((a, b) => {
	a[b[0] as number] = b[1] as string;
	return a;
}, []);

export const ItemWearPlace: Record<string, number> = {
	PL_NIKAM: 0,
	PL_BATOH: 1,
	PL_TELO_H: 2,
	PL_TELO_D: 3,
	PL_HLAVA: 4,
	PL_NOHY: 5,
	PL_KUTNA: 6,
	PL_KRK: 7,
	PL_RUKA: 8,
	PL_OBOUR: 9,
	PL_PRSTEN: 10,
	PL_SIP: 11,
} as const;


export const ItemWearPlaceName: string[] = [
	[ItemWearPlace.PL_NIKAM, "Nowhere"],
	[ItemWearPlace.PL_BATOH, "Bag Slot"],
	[ItemWearPlace.PL_TELO_H, "Upper Body"],
	[ItemWearPlace.PL_TELO_D, "Lower Body"],
	[ItemWearPlace.PL_HLAVA, "Head"],
	[ItemWearPlace.PL_NOHY, "Feet"],
	[ItemWearPlace.PL_KUTNA, "Full Body (Robe)"],
	[ItemWearPlace.PL_KRK, "Neck"],
	[ItemWearPlace.PL_RUKA, "Hand"],
	[ItemWearPlace.PL_OBOUR, "Two-Handed"],
	[ItemWearPlace.PL_PRSTEN, "Ring"],
	[ItemWearPlace.PL_SIP, "Quiver"],
].reduce<string[]>((a, b) => {
	a[b[0] as number] = b[1] as string;
	return a;
}, []);

export const WeaponType = {
	MEC: 0,
	SEKERA: 1,
	KLADIVO: 2,
	HUL: 3,
	DYKA: 4,
	STRELNA: 5,
	SPECIAL: 6,
} as const;

export const WeaponTypeName = [
	"Sword","Axe","Hammer","Staff","Dagger","Ranged","Special"
]


