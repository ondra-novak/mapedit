<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import {  ActionType, create_action_instance, directions, SimpleActionTypeName, TMA_CANCELACTION, TMA_CHANGELIGHT, TMA_CODELOCK, TMA_DROPITM, TMA_FIREBALL, TMA_GEN, TMA_GLOBE, TMA_IFJMP, TMA_IFSEC, TMA_LOADLEV, TMA_LOCK, TMA_SEND_ACTION, TMA_SOUND, TMA_SWAPS, TMA_TELEPORT, TMA_TEXT, TMA_TWOP, TMA_UNIQUE, TMA_WOUND } from '@/core/map_structs';
import { readWavInfoFromBuffer } from '@/core/sound_info';
import { create_datalist, type DataListHandle } from '@/utils/datalist';
import { computed, onMounted, ref, watch } from 'vue';
import ItemList from './ItemList.vue';
import globalGetItems from '@/utils/global_item_list';
import { SVGDrawing, SVGPath } from '@/utils/svg';
import FactEditor from './FactEditor.vue';
import { condition_proxy } from '@/core/bitproxy';
import DelayLoadedList from './DelayLoadedList.vue';
import getGlobalDialogs from '@/utils/global_dialog_list';
import getGlobalShops from '@/utils/global_shop_list';
import PlaylistEditor from './PlaylistEditor.vue';
import { ElementTypeName } from '@/core/common_defs';



const ActionEvent = [
["On interaction",  0x4, "Interaction with the wall - mouse click or spacebar. If there is secondary wall defined, the player must click on the secondary wall"],
["On wall bump",  0x2, "Attempt to walk through not passable wall (solid, blocked)"],
["On wall attack",  0x8000, "Attempt to swing weapon on wall or hit by an item (you can test by 'If have item')"],
["On locked",  0x10, "Triggered when Lock is called with no key item in the cursor"],
["On wrong key",  0x8, "Triggered when Lock is called with wrong key item in the cursor"],
["On niche interaction",  0x4000, "Interaction with niche - added or removed item"],
["Before leaving tile",  0x1, "Triggered just before the player leaves the current tile. During this event, the player is still on this tile"],
["After leaving tile",  0x20, "Triggered after the player successfully leaves the tile. Useful to close door behind"],
["On animation at end",  0x2000, "Triggered when animation reaches end (and there is no repeat)"],
["On animation at begin",  0x100, "Triggered when animation reaches begin when played reversed (and there is no repeat)"],
["On animation frame",   0x200, "Triggered every animation frame of this wall if there is a running animation"],
["On odd anim. frame",  0x400, "Triggered every odd animation frame of this wall if there is a running animation"],
["On message received",  0x40, "Received message send by send_message"],
["On message applied",  0x800, "Triggered when message effect was applied"],
["On level start",  0x80, "Triggered on level start"],
["On specproc",  0x1000, "Triggered by specproc (special)"],
] as const;

const ActionEventToBin = ActionEvent.reduce((a,b)=>{
    a[b[0]] = b[1];
    return a;
},{} as Record<string,number>);

const ActionName = [
[0,"Target",true,"No operation. This can be used as jump target if there is no other action available for this purpose"],
[1,"Play sound",true,"Play sound on this side"],              //    SOUND: 1,
[2,"Show test (global)",false,"Display message, use global stringtable"],                //    TEXTG: 2,
[3,"Show text",true,"Display message"],             //    TEXTL: 3,
[4,"Send message",true,"Send a message to a different place in current level to invoke some effect"],             //    SENDA: 4,
[5,"Throwing trap",true,"Makes object throwing trap. When triggered an object is thrown from the wall"],               //    FIREB: 5,
[6,"Destroy item",true,"Destroyes item currently held in mouse cursor"],                //    DESTI: 6,
[7,"Load map",true,"Loads different map, transfers player to different map"],              //    LOADL: 7,
[8,"Drop item",true,"Drops item at ground"],               //    DROPI: 8,
[9,"Start dialog",true,"Starts specified dialog"],                //    DIALG: 9,
[10,"Start shop",true,"Starts specified shop"],              //    SSHOP: 10,
[11,"Code lock",true,"Checks for code lock, cancels execution if code is not valid"],               //    CLOCK: 11,
[12,"Cancel message",true,"Cancels currently delayed message. This is good way to break any loop"],              //    CACTN: 12,
[13,"Lock",true,"Checks for key held in mouse cursor"],                //    LOCK:  13,
[14,"Swap sectors (legacy)",true,"Swap definition of two sectors"],                //    SWAPS: 14,
[15,"Cause injury",true,"Cause injury to all charactes on current sector"],                //    WOUND: 15,
[16,"If cond",true,"Test some condition and jump when it is met"],             //    IFJMP: 16,
[17,"Call specproc",false,""],               //    CALLS: 17,
[18,"If have item",true,"Test whether player has specified item (anywhere in inventory)"],               //    HAVIT: 18,
[19,"Append to story",true,"Append a text to story"],             //    STORY: 19,
[20,"If message",true,"Test current message "],              //    IFACT: 20,
[21,"Send experience",true,"Send experience"],             //    SNDEX: 21,
[22,"Teleport group",true,"Teleport group to different sector in current map"],              //    MOVEG: 22,
[23,"Play animation",true,"Play MGF animation"],              //    PLAYA: 23,
[24,"Create item",true,"Create an item and put it to mouse cursor"],             //    CREAT: 24,
[25,"If fact",true,"Checks given fact and jump if met"],                //    ISFLG: 25,
[26,"Set fact",true,"Set/Reset/Update fact"],                //    CHFLG: 26,
[27,"Create unique item",false,"(not implemented)"],             //    CUNIQ: 27,
[28,"Give money",true,"Give money to player"],              //    MONEY: 28,
[29,"Give unique item",false,"(not implemented)"],               //    GUNIQ: 29,
[30,"If consume item",true,"Check if the player is holding a specific item in mouse cursor, if so, consume it"],               //    PICKI: 30,
[31,"Append to book",true,"Append a text to the book"],              //    WBOOK: 31,
[32,"If random",true,"Jump depend on random number"],             //    RANDJ: 32,
[33,"Finish game",true,"Finish the game - show epilog and credits"],                //    ENDGM: 33,
[34,"Control enemy",true,"Send an enemy from a sector to different sectorSend the monster to another sector. The monster will get there on its own. The monster must be mobile"],               //    GOMOB: 34,
[35,"Call sub",true,"Call a script on another wall as a subroutine (for same event). Doesn't change context of execution."],                //    SHRMA: 35,
[36,"Change playlist",true,"Define new music playlist"],                //    MUSIC: 36,
[37,"Define global event",true,"Defines global events. Global events are not saved in the saved game, they must be set during the \"On level start\" event"],             //    GLOBE: 37,
[38,"Change fog color",true,"Temporarily changes the color of the fog. The choice is not saved in the saved game, you must invoke the action again after reloading the saved game"],
[39,"Play music",true,"Play specified music. When music is finished, continues by current playlist"],
[40,"End game",true,"Display game over screen with the specified text message"],
[41,"Finish game ext.",true,"Finish the game - show end credits - you can specify epilog file"],
[43,"Swap sectors (advanced)",true,"Swap definition of two sectors - advanced options"],
[44,"Autosave",true,"Trigger autosave"]
].sort((x,y)=>(x[1] as string).localeCompare(y[1] as string));

const ActionNameMap = ActionName.reduce((a,b)=>{
    a[b[0] as number] = b[1];
    return a;
},[] as string[]);

const globalEvents = [
  "Before leaving the map",
  "Before falling asleep",
  "After waking up",
  "Before saving",
  "After saving",
  "Before casting a spell",
  "After casting a spell",
  "Map opened",
  "Map closed",
  "Before battle",
  "After battle",
  "Book opened",
  "Book closed",
  "Every turn",
  "Male character death",
  "Female character death",
  "All characters dead",
  "Male character injured",
  "Female character injured",
  "Rune picked up",
  "Item picked up",
  "Step taken",
  "Turned around",
  "Alarm",
  "Fire magic",
  "Water magic",
  "Earth magic",
  "Air magic",
  "Mind magic",
  "On spell 1 <param=id>",
  "On spell 2 <param=id>",
  "On spell 3 <param=id>",
  "On spell 4 <param=id>",
  "On spell 5 <param=id>",
  "On spell 6 <param=id>",
  "On spell 7 <param=id>",
  "On spell 8 <param=id>",
  "On spell 9 <param=id>",
  "Timer 1 <turns/-time>",
  "Timer 2 <turns/-time>",
  "Timer 3 <turns/-time>",
  "Timer 4 <turns/-time>",
  "Flute melody 1 <melody id>",
  "Flute melody 2 <melody id>",
  "Flute melody 3 <melody id>",
  "Flute melody 4 <melody id>",
  "Flute melody 5 <melody id>",
  "Flute melody 6 <melody id>",
  "Flute melody 7 <melody id>",
  "Flute melody 8 <melody id>",
] as const;

const WoundType = [
    "Non resistable damage",
    "Psychical attack",
    "Fire damage",
    "Water damage",
    "Earth damage",
    "Air damage",
    "Mind damage"
] as const;

const IfJumpCondition = [
  [33,"Enemy in area"],  
  [32,"Enemy in level"],
  [9,"Primary visible"],
  [8,"Primary animated"],
  [11,"Primary forward"],
  [13,"Secondary visible"],
  [12,"Secondary animated"],
  [15,"Secondary forward"],
  [1,"Barrier for player"],
  [2,"Barrier for enemy"],
  [3,"Barrier for item"],
  [4,"Barrier for sound"],
  [0,"Automaping enabled"],
  [29,"Secret wall"],
  [30,"TRUESEE wall"],
  [31,"Invisible on map"],
] as const;

export type ActionList = TMA_GEN[];
export type MultiactionModelDef = {
    actionList: ActionList,
    stringTable: string[],   
}

const playlist_regex = /^\s*(FORWARD\s+|RANDOM\s+|FIRST\s+)?\s*([^.]+\.(MP3|MUS)\s+)*([^.]+\.(MP3|MUS))\s*$/i;
const script = defineModel<MultiactionModelDef>();
const show_raw_object = ref(false);
const cur_event = ref<number>(0);
const list_of_sounds = ref<HTMLInputElement>();
const list_of_keys = ref<HTMLInputElement>();
const list_of_maps = ref<HTMLInputElement>();
const list_of_books = ref<HTMLInputElement>();
let cur_datalist:DataListHandle|null = null;

watch(list_of_sounds,()=>{
    const el = list_of_sounds.value;
    if (el) {
        cur_datalist =  create_datalist(async ()=>{
            const files = await server.getDDLFiles(AssetGroup.SOUNDS,null);
            return files.files.map(x=>({
                value: x.name
            }));
        });
        el.setAttribute("list", cur_datalist.id);
    }
})

watch(list_of_keys,()=>{
    const el = list_of_keys.value;
    if (el) {
        cur_datalist =  create_datalist(async ()=>{
            const items = await globalGetItems();
            return items.filter(x=>!!x.keynum).map(x=>({value:`${x.keynum}`,label: x.jmeno}))
        });
        el.setAttribute("list", cur_datalist.id);
    }
})

watch(list_of_maps,()=>{
    const el = list_of_maps.value;
    if (el) {
        cur_datalist =  create_datalist(async ()=>{
            const files = await server.getDDLFiles(AssetGroup.MAPS,null);
            return files.files.filter(x=>x.name.toUpperCase().endsWith(".MAP")).map(x=>({
                value: x.name
            }));
        });
        el.setAttribute("list", cur_datalist.id);
    }
})

watch(list_of_books,()=>{
    const el = list_of_books.value;
    if (el) {
        cur_datalist =  create_datalist(async ()=>{
            const files = await server.getDDLFiles(AssetGroup.MAPS,null);
            const allmaps = Object.fromEntries(files.files.filter(x=>x.name.toUpperCase().endsWith(".MAP")).map(x=>[x.name.toUpperCase().substring(0,x.name.length-4)+".TXT",true]));   
            const is_map_txt = (x:string) => !!allmaps[x.toUpperCase()];        
            return files.files.filter(x=>x.name.toUpperCase().endsWith(".TXT") && !is_map_txt(x.name)).map(x=>({
                value: x.name
            }));
        });
        el.setAttribute("list", cur_datalist.id);
    }
})


const last_selected_event_desc = computed(()=>{
    const itm = ActionEvent.find(x=>x[1] == last_selected_event.value);
    return itm?itm[2]:"";
})
const last_selected_command_desc = computed(()=>{
    const itm = ActionName.find(x=>x[0] == last_selected_command.value);
    return itm?itm[3]:"";
})
const focused_command_desc = computed(()=>{
    const itm = ActionName.find(x=>x[0] == focused_item.value?.header.action);
    return itm?itm[3]:"";
})

const event_list = ref<Record<string, ActionList> >({})


function prepareList() {
    if (!script.value) {
        event_list.value = {};
    } else {
        let this_script = script.value.actionList;
        const events = ActionEvent.reduce((a,b)=>{
            const lst = this_script.filter(x=>x.flags & b[1]);
            if (lst.length) {
                a[b[0]] = lst;
            }
            return a;
        }, {} as Record<string, ActionList>)
        event_list.value = events;
    }
}

const [stringtable_cur_text,stringtable_cur_playlist] = [false,true].map(pl=>computed({
    get:()=>{
        const itm = focused_item.value;
        const scr = script.value;
        if (scr && itm && (itm instanceof TMA_TEXT) && (pl || itm.textindex)) {
            const s = scr.stringTable[itm.textindex] ?? "";
            if (pl &&  s && !s.match(playlist_regex)) return null;
            return s;
        } 
        return null;
    },
    set:(x:string)=>{
        const itm = focused_item.value;
        const scr = script.value;
        if (scr && itm && (itm instanceof TMA_TEXT) && (pl || itm.textindex)) {            
            scr.stringTable[itm.textindex] = x;
        }
    }
}));


function stringtable_add_text() {
    const f = focused_item.value as TMA_TEXT;
    if (!f || !script.value) return;
    const st = script.value.stringTable;
    let idx = 0;
    const found = st.find((_,idx2)=>idx2 && idx2 != ++idx);
    if (!found) idx = Math.max(1,st.length);
    f.textindex = idx;
    st[f.textindex] = "";
}

onMounted(()=>{
    prepareList();
});

watch(script, ()=>{
    prepareList();
},{deep:true});

const opened_events = ref<number>(0);
const last_selected_event = ref<number>(0);
const last_selected_command = ref<number>(0);
const focused_item = ref<TMA_GEN|null>(null);

function open_close(cat:string) {
    const mask = ActionEventToBin[cat];
    opened_events.value ^= mask;
    if (focused_item.value && !(focused_item.value.flags & opened_events.value)) {
        focused_item.value = null;
    }
}

const dialog_add_item = ref<HTMLDialogElement>();
const dialog_clone_item = ref<HTMLDialogElement>();
const dialog_editor = ref<HTMLDialogElement>();


function add_new_item() {
    if (last_selected_command.value && last_selected_event.value && script.value) {
        opened_events.value = (opened_events.value || 0) | last_selected_event.value;
        const itm = create_action_instance(last_selected_command.value, last_selected_event.value)
        script.value.actionList = [ ... script.value.actionList, itm];
        focused_item.value = itm;        
        dialog_editor.value!.show();
    
    }
    dialog_add_item.value!.close();
}

class JumpGuard {

    map = new Map<TMA_IFJMP, TMA_GEN>;

    constructor(lst: ActionList) {
        lst.forEach((x,idx)=>{
            if (x instanceof TMA_IFJMP) {
                const t = lst[idx+x.parm2];
                if (t) this.map.set(x, t);
            }
        });
    }

    update(lst:ActionList) {
        lst.forEach((x,idx)=>{
            if (x instanceof TMA_IFJMP) {
                const f = this.map.get(x);
                if (f) {
                    const i = lst.findIndex(y=>y === f);
                    if (i >= 0) {
                        x.parm2 = i - idx;
                    }
                }
            }
        });
    }
    
}

function erase_item(item: TMA_GEN, event: string) {
    const mask = ActionEventToBin[event];
    item.flags &= ~mask;
    if (item.flags) {
        prepareList();
        return;
    }
    const ss = script.value;
    if (!ss) return;
    const s = ss.actionList;
    const idx = s.findIndex(x=>x==item);
    if (idx < 0) return;
    const g = new JumpGuard(s);
    ss.actionList = [...s.slice(0,idx), ...s.slice(idx+1)];
    g.update(ss.actionList);
    setTimeout(()=>focused_item.value = null,10);
}

function clone_item() {
    const item = focused_item.value;
    if (item) {
        opened_events.value = (opened_events.value || 0) | last_selected_event.value;
        item.flags |= last_selected_event.value;
        prepareList();
        dialog_clone_item.value!.close();
    }
}

function move_item(dir: number) {
    const f = focused_item.value;
    const ss = script.value;
    if (!f || !ss) return;
    const s = ss.actionList;
    const idx = s.findIndex(x=>x==f);
    if (idx < 0) return;
    let t = idx+dir;
    while (t >= 0 && t < s.length) {
        if ((s[t].flags & f.flags) != 0) break;
        t = t+dir;
    }
    if (t < 0) t = 0;
    const g = new JumpGuard(s);
    const s1 = [...s.slice(0,idx), ...s.slice(idx+1)];
    ss.actionList = [...s1.slice(0,t), f, ...s1.slice(t)];
    g.update(ss.actionList);
}

watch(focused_item, ()=>{
    const dlg = dialog_editor.value!;
    if (!focused_item.value) {
        dlg.close();
    } 
})




function print_action_flags(action: TMA_GEN) {
    const flags : string[] = [];
    if (action.header.once) flags.push("①");
    if (action.header.cancel) flags.push("✘");
    if (flags.length) {
        return " "+flags.join("");
    } else {
        return "";
    }
}

async function fill_sound_info() {
    const f = focused_item.value as TMA_SOUND
    if (!f) return;
    try {
        const blob = await server.getDDLFile(f.filename);
        const info = readWavInfoFromBuffer(blob);
        f.snd_flags.bit16 = info.bitsPerSample == 16;
        f.end_loop = info.numSamples;
        f.start_loop = info.numSamples;
        f.freq = info.sampleRate;        
    } catch (e) {
        console.warn(e);
    }
}

async function play_sound() {
    const f = focused_item.value as TMA_SOUND
    if (!f) return;
    try {
        const data = await server.getDDLFile(f.filename);
        const type = f.filename.toLocaleUpperCase().endsWith(".MP3")?"mpeg":"wav";
        const blob = new Blob([data], { type: "audio/"+type });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    } catch (e) {
        console.error(e);
    }
}

function create_computed_select_item(get: ()=>number|null, set:(x:number|null)=>void) {
    return computed({
    get:()=>{
        const ret : number[] = [];
        const x = get();
        if (x !== null) ret.push(x as number);
        return ret;
    },
    set(newval) {
        if (newval.length) set(newval[newval.length-1]);
        else set(null)
    }
})
}
const if_jump_cond = computed(()=>{
    if (focused_item.value && (focused_item.value instanceof TMA_IFJMP)) {
        return condition_proxy(focused_item.value, "parm1");
    } else {
        return condition_proxy({x:0}, "x");
    }
});

const item_list_TMA_DROPITM = create_computed_select_item(
    ()=>(focused_item.value as TMA_DROPITM).item,
    (x:number|null)=>(focused_item.value as TMA_DROPITM).item = x
);
const item_list_TMA_FIREBALL = create_computed_select_item(
    ()=>(focused_item.value as TMA_FIREBALL).item,
    (x:number|null)=>(focused_item.value as TMA_FIREBALL).item = x
)
const item_list_TMA_HAVEIT = create_computed_select_item(
    ()=>if_jump_cond.value?.cond || 0,
    (x:number|null)=>if_jump_cond.value.cond = x
)
const relative_offset_TMA_IFJMP = computed({
    get: ()=>{
        const f = focused_item.value as TMA_IFJMP;
        const s = script.value;
        if (!f || !s) return -1;
        const idx = s.actionList.findIndex(x=>f===x);
        return idx + f.parm2;
    },
    set:(x:number) => {
        const f = focused_item.value as TMA_IFJMP;
        const s = script.value;
        if (!f || !s) return -1;
        const idx = s.actionList.findIndex(x=>f===x);
        f.parm2 = x - idx;
    }
})

function draw_arrow(p: any, list: TMA_GEN[], from: TMA_IFJMP) {
    const s = script.value;
    if (!s || !p) return;
    const my_pos = s.actionList.findIndex(x=>x === from);
    if (my_pos < 0) return;
    const to = s.actionList[my_pos+from.parm2];
    const to_pos = list.findIndex(x=>x === to);
    if (to_pos < 0) return;
    const from_pos = list.findIndex(x=>x === from);
    if (from_pos < 0) return;
    queueMicrotask(()=>{

        const drw = new SVGDrawing();
        const el = p as HTMLElement;
        el.innerHTML = "";
        const bound = el.parentElement?.getBoundingClientRect();
        const height = (bound?.height || 0)-1;
        const svgel = drw.getSvgElement()
        const id = "marker"+Math.random().toString().substring(2);
        const marker = SVGDrawing.createElement("marker",{
            id: id,
            markerWidth:"10",
            markerHeight: "10",
            refX:"10",
            refY:"5",
            orient: "auto",        
        })
        marker.appendChild(SVGDrawing.createElement("path",{d:"M0,0 L10,5 L0,10 Z",class:"arrowhead" }));
        const defs = SVGDrawing.createElement("defs");
        defs.appendChild(marker);
        drw.getSvgElement().appendChild(defs);
        const path = new SVGPath("arrow",{"marker-end":`url(#${id})`});
        const dist = (to_pos - from_pos) * height;        
        let starty = 0;
        let endy = starty+dist;
        let shift = 0;
        if (endy < 0) {
            shift = -endy;
            endy+=shift;
            starty+=shift;
        } 
        const arc = Math.abs(dist)/2;
        const m = (starty+endy)/2;
        path.mt(0,starty);
        path.bct(m,m, m, m, 0,endy);
        svgel.appendChild(path.build());
        svgel.setAttribute("style",`pointer-events: none;position: absolute; height:${Math.abs(dist)}px;width:${m+10}px;left:0;top:${-shift+height/2}px;z-index:1000`);    
        el.appendChild(svgel);
    });
}

const suitable_texts = computed(()=>{
    const f = focused_item.value;
    const scr = script.value;
    if (!scr || !f || !(f instanceof TMA_TEXT)) return [] as string[];
    const txt = f as TMA_TEXT;
    const is_pls = txt.header.action == ActionType.MUSIC;
    const lst =  scr.stringTable.map((x,idx)=>[x.replaceAll('\n','|'),idx] as [string, number])
        .filter(x=>(!!x[0].match(playlist_regex)) == is_pls)
    return lst;
})

</script>

<template>
<div class="wrk">    
    <div class="scroll">
        <div class="tree-list">
            <div v-for="(x, cat) of event_list" :key="cat" :class="{'tree-node': true, opened: !!(ActionEventToBin[cat] & opened_events)}">
                <div @click="open_close(cat)" class="event-name" > {{  cat }}</div>
                <div v-if="!!(ActionEventToBin[cat] & opened_events)">
                    <div v-for="(y,idx) of x" :key="idx" class="item" :class="{focused: y == focused_item}" 
                        @click="if(focused_item ==y) dialog_editor!.show(); else focused_item =y">
                        {{ ActionNameMap[y.header.action as number]}} {{ print_action_flags(y) }}
                        <div class="buttonx" @click="(ev:Event) => {erase_item(y, cat);ev.stopPropagation()}"></div>
                        <div class="arrowstart" v-if="(y instanceof TMA_IFJMP) && y.parm2" :ref="el=>draw_arrow(el, x, y)">

                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="toolbar">
        <button @click="move_item(-1)":hidden="focused_item == null" :disabled="focused_item != null && script && script.actionList[0] == focused_item">▲</button>
        <button @click="move_item(1)":hidden="focused_item == null" :disabled="focused_item != null && script && script.actionList[script.actionList.length-1] == focused_item">▼</button>
        <button @click="dialog_clone_item!.showModal()" :hidden="focused_item == null">Clone</button>
        <button @click="dialog_add_item!.showModal()">Add</button>    
    </div>
</div>

<dialog ref="dialog_add_item" class="add">
    <header>Add new item</header>
    <div>
        <div>
            <div>Event</div>
            <div><select v-model="last_selected_event" size="16">
                <option v-for="x of ActionEvent" :key="x[0]" :value="x[1]"> {{  x[0] }} </option>
            </select>
            </div>
            <p class="note spc"> {{ last_selected_event_desc }}</p>
        </div>
        <div>
            <div>Command</div>
            <div><select v-model="last_selected_command" size="16">            
                <template v-for="(x) of ActionName" :key="x[0]">
                    <option v-if="x[2]" :value="x[0]"> {{ x[1] }}</option>
                </template>
                </select>
            </div>        
            <p class="note spc"> {{ last_selected_command_desc }}</p>
        </div>
    </div>
    <footer>
        <button :disabled="last_selected_event == 0 || last_selected_command == 0" @click="add_new_item">Add</button>
        <button @click="dialog_add_item!.close()">Close</button>
    </footer>
</dialog>

<dialog ref="dialog_clone_item" class="clone">
    <header>Clone command</header>
    <div>
        <div>
            <div>Event</div>
            <div><select v-model="last_selected_event" size="16">
                <option v-for="x of ActionEvent" :key="x[0]" :value="x[1]"> {{  x[0] }} </option>
            </select>
            </div>
            <p class="note spc"> {{ last_selected_event_desc }}</p>
        </div>
    </div>
    <footer>
        <button :disabled="last_selected_event == 0" @click="clone_item">Add</button>
        <button @click="dialog_clone_item!.close()">Close</button>
    </footer>
</dialog>

<Teleport to="body">
<dialog ref="dialog_editor" class="editor">
    <header>Edit command: {{  ActionNameMap[focused_item?.header.action as number || 0] }}</header>
    <template v-if="focused_item">
        <x-form>
            <label><input type="checkbox" v-model="focused_item.header.once"><span>Once - execute only once</span></label>
            <label><input type="checkbox" v-model="focused_item.header.cancel"><span>Stop - if executed, do not continue to next command</span></label>
            <p class="note"> {{  focused_command_desc  }}</p>
        <template v-if="(focused_item instanceof TMA_SOUND)">       
            <label><span>Sound file</span><input type="search" ref="list_of_sounds" v-model="focused_item.filename" maxlength="12" @input="fill_sound_info"></label>                    
            <label><span>Volume</span><input type="number" v-model="focused_item.volume" min="0" max="100" v-watch-range></label>                    
            <label><span>Pitch -freq Hz</span><input type="number" v-model="focused_item.freq" v-watch-range min="0" max="99999"></label>                    
            <label><span>Start loop</span><input type="number" v-model="focused_item.start_loop" v-watch-range min="0" max="999999999"></label>                    
            <label><span>End loop</span><input type="number" v-model="focused_item.end_loop" v-watch-range min="0" max="999999999"></label>                    
            <label><span>Start offset</span><input type="number" v-model="focused_item.offset" v-watch-range min="0" max="999999999"></label>                    
            <label><span>Track (0=none)</span><input type="number" v-model="focused_item.soundid" min="0" max="100" v-watch-range></label>                    
            <label><input type="checkbox" v-model="focused_item.snd_flags.bit16"><span>16bit</span></label>
            <label><input type="checkbox" v-model="focused_item.snd_flags.mute_close"><span>Mute when animation going backward</span></label>
            <label><input type="checkbox" v-model="focused_item.snd_flags.mute_open"><span>Mute when animation going forward</span></label>
            <label><input type="checkbox" v-model="focused_item.snd_flags.random_balance"><span>Randomize sound direction</span></label>
            <label><button @click="play_sound">Test</button></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_CANCELACTION)">       
            <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector"></input></label>
            <label><span>Target side</span><select v-model="focused_item.dir"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></label>
            <p class="note">You must specify target of the message to cancel. Only one pending message is canceled </p>
        </template>
        <template v-else-if="(focused_item instanceof TMA_CODELOCK)">       
            <label><span>Letter to add</span><input type="text" v-model="focused_item.znak" maxlength="1"></input></label>
            <label><span>Valid seq. of letters</span><input type="text" v-model="focused_item.string" maxlength="8"></input></label>
            <label><span>Memory slot</span><input type="number" v-watch-range v-model="focused_item.codenum" min="0" max="15"></input></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_TEXT) && script">       
            <template v-if="focused_item.header.action == ActionType.DIALG">
                <label><span>Dialog</span>
                    <DelayLoadedList v-model="focused_item.textindex" :list="getGlobalDialogs().then(x=>x.map(y=>({value:y[0],label:y[1]})))"/></label>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.SSHOP">
                <label><span>Shop</span>
                    <DelayLoadedList v-model="focused_item.textindex" :list="getGlobalShops().then(x=>x.map(y=>({value:y[0],label:y[1]})))" /></label>
            </template>
            <template v-else>            
                <label><span>Selected {{ focused_item.header.action == ActionType.MUSIC ?"playlist":"text" }} </span><select v-model="focused_item.textindex">
                    <option v-for="[t,idx] of suitable_texts" :key="idx" :value="idx"> {{ t }}</option>
                </select></label>
                <div>
                    <textarea v-if="focused_item.header.action != ActionType.MUSIC" :disabled="stringtable_cur_text === null" rows="5" cols="49" v-model="stringtable_cur_text"></textarea>
                    <PlaylistEditor v-else-if="stringtable_cur_playlist!==null" v-model="stringtable_cur_playlist"></PlaylistEditor>
                </div>
                <div style="text-align: right;"><button @click="stringtable_add_text">Add new {{ focused_item.header.action == ActionType.MUSIC ?"playlist":"text" }}</button></div>
            </template>
        </template>
        <template v-else-if="(focused_item instanceof TMA_IFJMP)">       
            <template v-if="focused_item.header.action == ActionType.RANDJ">
                <p class="note">The dice is rolled once per event, not per command</p>
                <label><span>Jump percentage [%]</span><input type="number" v-model="focused_item.parm1" v-watch-range min="1" max="100"></input></label>
            </template>
            <template v-else>
                <template v-if="focused_item.header.action == ActionType.IFJMP">
                    <label><span>Condition</span><select v-model="if_jump_cond.cond">
                        <option v-for="x of IfJumpCondition" :key="x[0]" :value="x[0]">{{ x[1] }}</option>
                        <option v-for="(x,y) of ElementTypeName" :key="y" :value="y+34">Current item has element damage: {{ x }}</option>
                    </select></label>
                </template>                
                <template v-else-if="focused_item.header.action == ActionType.ISFLG">
                    <div class="factedit"><FactEditor v-model="if_jump_cond.cond"></FactEditor></div>
                </template>
                <template v-else-if="focused_item.header.action == ActionType.HAVIT || focused_item.header.action == ActionType.PICKI">
                    <ItemList v-model="item_list_TMA_HAVEIT" :limit="1"></ItemList>
                </template>
                <template v-else-if="focused_item.header.action == ActionType.IFACT">
                    <label><span>Action type</span><select v-model="if_jump_cond.cond">
                        <template v-for="(x, idx) of SimpleActionTypeName" :key="idx">
                            <option v-if="x" :value="idx">{{ x }}</option>
                        </template>
                    </select></label>
                </template>
                <label><input type="checkbox" v-model="if_jump_cond.invert"><span>Jump if FALSE</span></label>
            </template>
            <label><span>Jump to command</span>
                <select v-model="relative_offset_TMA_IFJMP">
                    <template v-for="(x,idx) of script?.actionList" :key="idx">
                        <option v-if="(x.flags & focused_item.flags)" :value="idx"> {{ `#${idx}` }} - {{ ActionNameMap[x.header.action as number] }} </option>
                    </template>
                </select></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_TELEPORT)">       
            <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector"></input></label>
            <label><span>Target side</span><select v-model="focused_item.param.direction"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></label>
            <label><input type="checkbox" v-model="focused_item.param.effect"></input><span>Play teleport effect</span></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_TWOP)">       
            <template v-if="focused_item.header.action == ActionType.SWAPS">
                <label><span>Sector 1</span><input type="number" v-watch-range min="1" max="65535" v-model="focused_item.parm1"></input></label>
                <label><span>Sector 2</span><input type="number" v-watch-range min="1" max="65535" v-model="focused_item.parm2"></input></label>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.SHRMA">
                <label><span>Target sector</span><input type="number" v-watch-range min="1" max="65535" v-model="focused_item.parm1"></input></label>
                <label><span>Target side</span><select v-model="focused_item.parm2"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></label>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.CHFLG">
                <label><span>Operation</span><select v-model="focused_item.parm2">
                    <option value="0">Clear</option>
                    <option value="1">Set</option>
                    <option value="2">Toggle</option>
                </select></label>
                <div class="factedit"><FactEditor v-model="focused_item.parm1"></FactEditor></div>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.GOMOB">
                <label><span>Enemy which is at sector</span><input type="number" v-watch-range min="1" max="65535" v-model="focused_item.parm1"></input></label>
                <label><span>Send it to sector</span><input type="number" v-watch-range min="1" max="65535" v-model="focused_item.parm2"></input></label>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.SNDEX">
                <label><span>Experience value</span><input type="number" v-watch-range min="1" max="32767" v-model="focused_item.parm1"></input></label>
            </template>
            <template v-else>
                <p class="note">UI is not available yet, fallback to generic form</p>
                <label><span>Parameter 1</span><input type="number" v-watch-range min="-32768" max="32767" v-model="focused_item.parm1"></input></label>
                <label><span>Parameter 2</span><input type="number" v-watch-range min="-32768" max="32767" v-model="focused_item.parm2"></input></label>
            </template>
            
        </template>
        <template v-else-if="(focused_item instanceof TMA_DROPITM)">       
            <label><span>Select an item:</span><ItemList v-model="item_list_TMA_DROPITM" :limit="1"></ItemList></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_FIREBALL)">       
            <label><span>X - front back</span><input type="number" v-watch-range min="-63" max="63" v-model="focused_item.xpos"></input></label>
            <label><span>Y - left right</span><input type="number" v-watch-range min="0" max="499" v-model="focused_item.ypos"></input></label>
            <label><span>Z - top bottom</span><input type="number" v-watch-range min="0" max="319" v-model="focused_item.zpos"></input></label>
            <label><span>Speed (+X per frame)</span><input type="number" v-watch-range min="0" max="128" v-model="focused_item.speed"></input></label>
            <label><span>Thrown item:</span><ItemList v-model="item_list_TMA_FIREBALL" :limit="1"></ItemList></label>            
        </template>
        <template v-else-if="(focused_item instanceof TMA_GLOBE)">       
            <label><span>Global event</span><select v-model="focused_item.event">
                <option v-for="(s, idx) of globalEvents" :key="idx" :value="idx"> {{ s }}</option>
                </select></label>
            <label v-if="focused_item.event>28"><span>Argument</span><input type="number" v-model="focused_item.param"/></label>
            <p class="note">When triggered, send message to:</p>
            <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector"></input></label>
            <label><span>Target side</span><div><select v-model="focused_item.side"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></div></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_IFSEC)">       
            {{ focused_item }}
        </template>
        <template v-else-if="(focused_item instanceof TMA_LOADLEV)">       
            <template v-if="focused_item.header.action == ActionType.LOADL">
                <label><span>Level name</span><input type="text" ref="list_of_maps" v-model="focused_item.name" maxlength="12"></label>
                <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65536" v-model="focused_item.start_pos"></label>
                <label><span>Target side</span><div><select v-model="focused_item.dir"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></div></label>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.WBOOK">
                <label><span>Book file</span><input type="text" ref="list_of_books" v-model="focused_item.name" maxlength="12"></label>
                <label><span>Paragraph ID</span><input type="number" v-watch-range min="0" max="65536" v-model="focused_item.start_pos"></label>
            </template>
            <template v-else-if="focused_item.header.action == ActionType.PLAYA">
                <label><span>Video file (MGF)</span><input type="text"  v-model="focused_item.name" maxlength="12"></label>
                <label><span>UI behavior</span><select v-model="focused_item.dir">
                    <option value="0">In game window</option>
                    <option value="1">Fullscreen</option>
                </select></label>            
            </template>
            <template v-else-if="focused_item.header.action == ActionType.ENDG2">
                <label><span>Epilog file (.TXT)</span><input type="text"  v-model="focused_item.name" maxlength="12"></label>
            </template>
            <template v-else>
                {{ focused_item }}
            </template>
        </template>
        <template v-else-if="(focused_item instanceof TMA_LOCK)">       
            <label><span>Key ID (-1 = no key exists)</span><input type="number" ref="list_of_keys" v-watch-range min="-1" max="255" v-model="focused_item.key_id"></input></label>
            <label><span>Picklock level (-1 = can't be picked):</span><input type="number" v-watch-range min="-1" max="256" v-model="focused_item.thieflevel"></input></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_SEND_ACTION)">       
            <label><span>Action</span><select v-model="focused_item.s_action">
                <template v-for="(n,idx) of SimpleActionTypeName" :key="idx"><option v-if="n" :value="idx"> {{ n }}</option></template>
            </select></label>
            <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector"></label>
            <label><span>Target side</span><div><select v-model="focused_item.side"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></div></label>
            <label><span>Delay in frames (0 = immediate)</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.delay"></label>
            <label><input type="checkbox" v-model="focused_item.change_bits.automap"><span>Toggle automap flag</span></label>
            <label><input type="checkbox" v-model="focused_item.change_bits.block_player"><span>Toggle player barrier</span></label>
            <label><input type="checkbox" v-model="focused_item.change_bits.block_monster"><span>Toggle monster barrier</span></label>
            <label><input type="checkbox" v-model="focused_item.change_bits.block_item"><span>Toggle item barrier</span></label>
            <label><input type="checkbox" v-model="focused_item.change_bits.block_sound"><span>Toggle sound barrier</span></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_SWAPS)">       
            <template v-if="focused_item.header.action == ActionType.SWPS2">
                <label><input type="checkbox" v-model="focused_item.pflags.north"><span>Swap north side</span></label>
                <label><input type="checkbox" v-model="focused_item.pflags.west"><span>Swap west side</span></label>
                <label><input type="checkbox" v-model="focused_item.pflags.south"><span>Swap south side</span></label>
                <label><input type="checkbox" v-model="focused_item.pflags.east"><span>Swap east side</span></label>
                <label><input type="checkbox" v-model="focused_item.pflags.floor_ceil"><span>Floor and ceil</span></label>
                <label><input type="checkbox" v-model="focused_item.pflags.config"><span>Sectory type and action</span></label>
                <label><input type="checkbox" v-model="focused_item.pflags.links"><span>Exit to neighbor sectors</span></label>
            </template>
            <label><span>Sector1</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector1"></input></label>
            <label><span>Sector2</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector2"></input></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_CHANGELIGHT)">       
            <label><span>Red</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.r"></input></label>
            <label><span>Green</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.g"></input></label>
            <label><span>Blue</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.b"></input></label>
        </template>
        <template v-else-if="(focused_item instanceof TMA_UNIQUE)">       
            {{ focused_item }}
        </template>
        <template v-else-if="focused_item instanceof TMA_WOUND">       
            <label><span>Type of damage</span><select v-model="focused_item.pflags">
                <option v-for="(s,idx) of WoundType" :key="idx" :value="idx"> {{ s }}</option>               
            </select></label>
            <label><span>Damage</span><div>
                <input type="number" v-watch-range min="0" max="65535" v-model="focused_item.minor"></input> -
                <input type="number" v-watch-range min="0" max="65535" v-model="focused_item.major"></input>
            </div></label>
        </template>
        </x-form>
    </template>
    <footer>
        <div class="raw">
            <input type="checkbox" v-model="show_raw_object">Show raw object</input>
            <pre v-if="show_raw_object">{{  focused_item }}</pre>
        </div>
        <button @click="dialog_editor!.close()">Close</button>        
    </footer>

</dialog>
</Teleport>

</template>

<style lang="css" scoped>

.wrk {
    width: 100%;
    height: 100%;
    background-color: #ccc;
    position: relative;    
}

.wrk .scroll {
    width: 100%;
    height: 100%;
    overflow: auto;

}

.event-name {
    cursor: pointer;
    padding-left: 1rem;
    position: relative;
    background-color: #ddd;
}

.tree-list > *:last-child {
    margin-bottom: 2.5rem;
}
.tree-list .item.focused {
    background-color: wheat;
}
.tree-list .item > .buttonx {
    position: absolute;
    display: inline-block;
    right: 0;
    padding: 0;
    width: 1rem;
    height: 1rem;
    border: 1px solid;
    text-align:center;
    line-height: 1rem;
}
.tree-list .item > .buttonx::after {
    content: 'x';
}

.tree-list .item:hover {
    background-color: antiquewhite;
    cursor: pointer;
}
.toolbar {
    position: absolute;
    bottom: 0;
    text-align: right;
    right: 1rem;
}
.toolbar button {
    font-size: 1.1rem;    
}

dialog {
    width: 30rem;
}

dialog.add >  div {    display:flex;}
dialog.add >  div > *{ width: 50%;}
dialog.add   select { width: 100%;}

.note {
    font-style: italic;
    margin: 0.5rem;
}
.note.spc{    
    min-height: 6rem;
}

dialog.editor {
    inset: 0;
}

dialog input[type=number] {
    width: 7rem;
    text-align: center;
}

.raw {
    float: left;
    text-align: left;
}
.raw pre {
    font-size: 0.8rem;
}

.arrowstart {
    display: inline-block;
    height: 1rem;
    position: relative;
}

.arrowstart :deep(path) {
    fill:none;
    stroke: #0008;
}

.arrowstart :deep(.arrowhead) {
    fill:#0008;
    stroke: none;
}

.factedit {
    max-height: 15rem;
    overflow-y: auto;
    overflow-x: hidden;
    border-bottom: 1px solid;
}

</style>