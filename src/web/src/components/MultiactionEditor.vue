<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import {  create_action_instance, TMA_CANCELACTION, TMA_CODELOCK, TMA_DROPITM, TMA_FIREBALL, TMA_GEN, TMA_GLOBE, TMA_IFSEC, TMA_LOADLEV, TMA_LOCK, TMA_SEND_ACTION, TMA_SOUND, TMA_SWAPS, TMA_TEXT, TMA_TWOP, TMA_UNIQUE, TMA_WOUND } from '@/core/map_structs';
import { readWavInfoFromBuffer } from '@/core/sound_info';
import { create_datalist, type DataListHandle } from '@/utils/datalist';
import { computed, onMounted, ref, watch } from 'vue';
import ItemList from './ItemList.vue';

const directions = ["North ↑","East →","South ↓","West ←"];

const ActionEvent = [
["On interaction",  0x4, "Interaction with the wall - mouse click or spacebar. If there is secondary wall defined, the player must click on the secondary wall"],
["On wall bump",  0x2, "Attempt to walk through not passable wall (solid, blocked)"],
["On wall attack",  0x8000, "Attempt to swing weapon on wall or hit by an item"],
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
[1,"Play sound",true,"Play sound on this side"],              //    SOUND: 1,
[2,"Show test (global)",false,"Display message, use global stringtable"],                //    TEXTG: 2,
[3,"Show text",true,"Display message"],             //    TEXTL: 3,
[4,"Send message",true,"Send a message to a different place in current level to invoke some effect"],             //    SENDA: 4,
[5,"Throwing trap",true,"Makes object throwing trap. When triggered an object is throwing from the wall"],               //    FIREB: 5,
[6,"Destroy item",true,"Destroyes item currently held in mouse cursor"],                //    DESTI: 6,
[7,"Load map",true,"Loads different map, transfers player to different map"],              //    LOADL: 7,
[8,"Drop item",true,"Drops item at ground"],               //    DROPI: 8,
[9,"Start dialog",true,"Starts specified dialog"],                //    DIALG: 9,
[10,"Start shop",true,"Starts specified shop"],              //    SSHOP: 10,
[11,"Code lock",true,"Checks for code lock, cancels execution if code is not valid"],               //    CLOCK: 11,
[12,"Cancel message",true,"Cancels currently delayed message. This is good way to break any loop"],              //    CACTN: 12,
[13,"Lock",true,"Checks for key held in mouse cursor"],                //    LOCK:  13,
[14,"Swap sectors",true,"Swap definition of two sectors"],                //    SWAPS: 14,
[15,"Cause injury",true,"Cause injury to all charactes on current sector"],                //    WOUND: 15,
[16,"If jump",true,"Test some condition and jump when it is met"],             //    IFJMP: 16,
[17,"Call specproc",false,""],               //    CALLS: 17,
[18,"If have item jump",true,"Test whether player has specified item and jump if does (anywhere in inventory)"],               //    HAVIT: 18,
[19,"Append to story",true,"Append a text to story"],             //    STORY: 19,
[20,"If message jump",true,"Test current message and jump"],              //    IFACT: 20,
[21,"Send experience",true,"Send experience"],             //    SNDEX: 21,
[22,"Teleport group",true,"Teleport group to different sector in current map"],              //    MOVEG: 22,
[23,"Play animation",true,"Play MGF animation"],              //    PLAYA: 23,
[24,"Create item",true,"Create an item and put it to mouse cursor"],             //    CREAT: 24,
[25,"If fact jump",true,"Checks given fact and jump if met"],                //    ISFLG: 25,
[26,"Set fact",true,"Set/Reset/Update fact"],                //    CHFLG: 26,
[27,"Create unique item",false,"(not implemented)"],             //    CUNIQ: 27,
[28,"Give money",true,"Give money to player"],              //    MONEY: 28,
[29,"Give unique item",false,"(not implemented)"],               //    GUNIQ: 29,
[30,"Use item and jump",true,"Check if the player is holding a specific item, if so, pick it up and jump"],               //    PICKI: 30,
[31,"Append to book",true,"Append a text to book"],              //    WBOOK: 31,
[32,"Random jump",true,"Jump depend on random number"],             //    RANDJ: 32,
[33,"End game",true,"Finish the game"],                //    ENDGM: 33,
[34,"Control enemy",true,"Send an enemy from a sector to different sectorSend the monster to another sector. The monster will get there on its own. The monster must be mobile"],               //    GOMOB: 34,
[35,"Call sub",true,"Call a script on another wall as a subroutine"],                //    SHRMA: 35,
[36,"Change music",true,"Change music"],                //    MUSIC: 36,
[37,"Define global event",true,"Defines global events. Global events are not saved in the saved game, they must be set during the \"On level start\" event"]             //    GLOBE: 37,
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

type ActionList = TMA_GEN[];

const script = defineModel<ActionList>();
const cur_event = ref<number>(0);
const list_of_sounds = ref<HTMLInputElement>();
const list_of_items = ref<HTMLInputElement>();
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


function dl_all_sounds() {
}


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
    let this_script = script.value || [];
    const events = ActionEvent.reduce((a,b)=>{
        const lst = this_script.filter(x=>x.flags & b[1]);
        if (lst.length) {
            a[b[0]] = lst;
        }
        return a;
    }, {} as Record<string, ActionList>)
    console.log(events);
    event_list.value = events;
}


onMounted(()=>{
    prepareList();
});

watch(script, ()=>{
    prepareList();
});

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
    if (last_selected_command.value && last_selected_event.value) {
        opened_events.value = (opened_events.value || 0) | last_selected_event.value;
        const itm = create_action_instance(last_selected_command.value, last_selected_event.value)
        script.value = [ ... (script.value || []), itm];
        focused_item.value = itm;
        dialog_editor.value!.show();
    
    }
    dialog_add_item.value!.close();
}

function erase_item(item: TMA_GEN, event: string) {
    const mask = ActionEventToBin[event];
    item.flags &= ~mask;
    if (item.flags) {
        prepareList();
        return;
    }
    const s = script.value;
    if (!s) return;
    const idx = s.findIndex(x=>x==item);
    if (idx < 0) return;
    script.value = [...s.slice(0,idx), ...s.slice(idx+1)];
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
    const s = script.value;
    if (!f || !s) return;
    const idx = s.findIndex(x=>x==f);
    if (idx < 0) return;
    let t = idx+dir;
    while (t >= 0 && t < s.length) {
        if ((s[t].flags & f.flags) != 0) break;
        t = t+dir;
    }
    const s1 = [...s.slice(0,idx), ...s.slice(idx+1)];
    script.value = [...s1.slice(0,t), f, ...s1.slice(t)];
}

watch(focused_item, ()=>{
    const dlg = dialog_editor.value!;
    if (!focused_item.value) {
        dlg.close();
    } else {
        if (dlg.open) {
            dlg.close();
            setTimeout(()=>dlg.show(),1);
        }
    }
})

const focused_action = computed(()=>focused_item.value?focused_item.value.header.action:0);


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
        f.snd_flags.bit16 = info.bitsPerSample == 16?1:0;
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

function create_computed_select_item<T>(field: keyof T) {
    return computed({
    get:()=>{
        const ret : number[] = [];
        const f = focused_item.value as T;
        if (f && f[field] !== null) ret.push(f[field] as number);
        return ret;
    },
    set(newval) {
        const f = focused_item.value as T;
        if (f) {
            if (newval.length) (f[field] as number|null) = newval[newval.length-1];
            else (f[field] as number|null) = null;
        }
    }
})
}
const item_list_TMA_DROPITM = create_computed_select_item<TMA_DROPITM>("item");
const item_list_TMA_FIREBALL = create_computed_select_item<TMA_DROPITM>("item");


</script>

<template>
<div class="wrk">
<div class="list">
    <div v-for="(x, cat) of event_list" :key="cat" :class="{'tree-node': true, opened: !!(ActionEventToBin[cat] & opened_events)}">
        <div @click="open_close(cat)" class="event-name" > {{  cat }}</div>
        <template v-if="!!(ActionEventToBin[cat] & opened_events)">
            <div v-for="(y,idx) of x" :key="idx" class="item" :class="{focused: y == focused_item}" 
                @click="if(focused_item ==y) dialog_editor!.show(); else focused_item =y">
                {{ ActionNameMap[y.header.action]}} {{ print_action_flags(y) }}
                <div class="buttonx" @click="(ev:Event) => {erase_item(y, cat);ev.stopPropagation()}"></div>
            </div>
        </template>
    </div>
</div>
<div class="toolbar">
    <button @click="move_item(-1)":hidden="focused_item == null" :disabled="focused_item != null && script && script[0] == focused_item">▲</button>
    <button @click="move_item(1)":hidden="focused_item == null" :disabled="focused_item != null && script && script[script.length-1] == focused_item">▼</button>
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

<dialog ref="dialog_editor" class="editor">
    <header>Edit command: {{  ActionNameMap[focused_item?.header.action || 0] }}</header>
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
        <template v-if="(focused_item instanceof TMA_CANCELACTION)">       
            <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector"></input></label>
            <label><span>Target side</span><select v-model="focused_item.dir"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></label>
            <p class="note">You must specify target of the message to cancel. Only one pending message is canceled </p>
        </template>
        <template v-if="(focused_item instanceof TMA_CODELOCK)">       
            <label><span>Letter to add</span><input type="text" v-model="focused_item.znak" maxlength="1"></input></label>
            <label><span>Valid seq. of letters</span><input type="text" v-model="focused_item.string" maxlength="8"></input></label>
            <label><span>Memory slot</span><input type="number" v-watch-range v-model="focused_item.codenum" min="0" max="15"></input></label>
        </template>
        <template v-if="focused_item instanceof TMA_TEXT">       
            {{ focused_item }}
        </template>
        <template v-if="focused_item instanceof TMA_TWOP">       
            {{ focused_item }}
        </template>
        <template v-if="(focused_item instanceof TMA_DROPITM)">       
            <label><span>Select an item:</span><ItemList v-model="item_list_TMA_DROPITM" :limit="1"></ItemList></label>
        </template>
        <template v-if="(focused_item instanceof TMA_FIREBALL)">       
            <label><span>X - front back</span><input type="number" v-watch-range min="-63" max="63" v-model="focused_item.xpos"></input></label>
            <label><span>Y - left right</span><input type="number" v-watch-range min="0" max="499" v-model="focused_item.ypos"></input></label>
            <label><span>Z - top bottom</span><input type="number" v-watch-range min="0" max="319" v-model="focused_item.zpos"></input></label>
            <label><span>Speed (+X per frame)</span><input type="number" v-watch-range min="0" max="128" v-model="focused_item.speed"></input></label>
            <label><span>Thrown item:</span><ItemList v-model="item_list_TMA_FIREBALL" :limit="1"></ItemList></label>            
        </template>
        <template v-if="(focused_item instanceof TMA_GLOBE)">       
            <label><span>Global event</span><select v-model="focused_item.event">
                <option v-for="(s, idx) of globalEvents" :key="idx" :value="idx"> {{ s }}</option>
                </select></label>
            <label v-if="focused_item.event>28"><span>Argument</span><input type="number" v-model="focused_item.param"/></label>
            <p class="note">When triggered, send message to:</p>
            <label><span>Target sector</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector"></input></label>
            <label><span>Target side</span><div><select v-model="focused_item.side"><option v-for="(v,idx) of directions" :key="idx" :value="idx"> {{ v  }}</option></select></div></label>
        </template>
        <template v-if="focused_item instanceof TMA_IFSEC">       
            {{ focused_item }}
        </template>
        <template v-if="focused_item instanceof TMA_LOADLEV">       
            {{ focused_item }}
        </template>
        <template v-if="focused_item instanceof TMA_LOCK">       
            {{ focused_item }}
        </template>
        <template v-if="focused_item instanceof TMA_SEND_ACTION">       
            {{ focused_item }}
        </template>
        <template v-if="(focused_item instanceof TMA_SWAPS)">       
            <label><span>Sector1</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector1"></input></label>
            <label><span>Sector2</span><input type="number" v-watch-range min="0" max="65535" v-model="focused_item.sector2"></input></label>
        </template>
        <template v-if="focused_item instanceof TMA_UNIQUE">       
            {{ focused_item }}
        </template>
        <template v-if="focused_item instanceof TMA_WOUND">       
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
        <button @click="dialog_editor!.close()">Close</button>
    </footer>

</dialog>

</template>

<style lang="css" scoped>

.wrk {
    width: 100%;
    height: 100%;
    background-color: white;
    position: relative;
    overflow: auto;
}

.event-name {
    cursor: pointer;
    padding-left: 1rem;
    position: relative;
}


.list .tree-node .event-name::before {
    position: absolute;
    display: block;
    content: "⊞";
    left: 0;
}

.list .tree-node.opened .event-name::before {
    content: "⊟";
}

.list .item {
    padding-left: 2rem;
    line-height: 1.5rem;
    position: relative;
}
.list .item.focused {
    background-color: wheat;
}
.list .item > .buttonx {
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
.list .item > .buttonx::after {
    content: 'x';
}

.list > div > div:hover {
    background-color: antiquewhite;
    cursor: pointer;
}
.toolbar {
    position: absolute;
    bottom: 0;
    text-align: right;
    right: 0;
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

</style>