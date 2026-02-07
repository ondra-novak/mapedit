<script setup lang="ts">
import { server } from '@/core/api';
import { DialogManager,  type DialogNode, type DialogStory, DialogBranchTypeStr, type DialogAction, DialogBranchType, DialogSpeakerType, type DialogSpeaker } from '@/core/dialog_structs';
import { SVGPath } from '@/utils/svg';
import { computed, onMounted, onUnmounted, reactive, ref,watch } from 'vue';
import noimage from '@/assets/noimage.svg'
import HIFormat from '@/core/hiformat';
import { create_datalist, type DataListItem } from '@/utils/datalist';
import { AssetGroup } from '@/core/asset_groups';
import DlgCodeEditor from '@/components/DlgCodeEditor.vue';
import { messageBoxConfirm } from '@/utils/messageBox';
import type { SaveRevertControl } from '@/components/statusBar';
import StatusBar from '@/components/statusBar';
import { json } from 'stream/consumers';
import { CharacterStatsNames } from '@/core/common_defs';
import { humanDataFromArrayBuffer, type THumanData } from '@/core/character_structs';

const dialogs = reactive(new DialogManager);
let inited = false;
const props = defineProps<{active:boolean}>();
let save_state: SaveRevertControl|null = null;
let ignore_modified = false;
const edit_speakers_dlg = ref<HTMLDialogElement>();


function modified() {
    if (!ignore_modified) init();
    ignore_modified = false;
}

async function init() {
    if (save_state) {
        save_state.set_changed(false);
        save_state.unmount();
    }
    try {
        const json_data = await server.getDDLFile("DIALOGY.JSON");
        const dec = new TextDecoder();
        dialogs.load(dec.decode(json_data));
        inited = true;

        server.off("modified", modified);
        server.on("modified", modified);

        

    } catch (e) {
        console.warn("Failed to load dialogs", e);
    }    

    current_index.value = null;

}

async function init_save() {
    if (!save_state) {
        save_state = await StatusBar.register_save_control();
        save_state!.on_save(save_all);
        save_state!.on_revert(()=>{
        init();
    });


    }
}

async function save_all() {
    const json_data = dialogs.save();
    const enc = new TextEncoder();
    const bin = enc.encode(json_data);
    ignore_modified = true;
    await server.putDDLFile("DIALOGY.JSON", bin.buffer, AssetGroup.MAPS);    
}

onMounted(()=>{
    if (props.active) init();
});

watch(()=>props.active,()=>{
    if (props.active) {
        if (!inited) {
            init(); 
        }
        init_save();                
    }
    if (!props.active && save_state) {
        save_state.unmount();
        save_state = null;
    }
})

watch(dialogs, ()=>{
    if (save_state) save_state.set_changed(true);    
},{deep:true})


const dlgimage = ref<SVGImageElement>();
const current_index = ref<number|null>(null);
const list_filter = ref<string>("");

const cur_story = computed(()=>{
    if (current_index.value) return dialogs._dlg[current_index.value];
    return undefined;
})
const filtered_list = computed(()=>{
    const srch = list_filter.value.toLocaleLowerCase();
    return Object.entries(dialogs._dlg).map(v=>[parseInt(v[0]),v[1].name] as [number, string])
        .filter((x:[number,string])=>!srch || x[1].toLocaleLowerCase().indexOf(srch) != -1);
});

async function update_image() {
    const s = cur_story.value;
    if (s && s.picture && dlgimage.value) {
        const data = await server.getDDLFile(s.picture);
        const hi = HIFormat.fromArrayBuffer(data);
        const cvs = hi.createCanvas();
        const href = cvs.toDataURL("image/jpeg");
        dlgimage.value.setAttribute("href",href);
    }
}

watch([cur_story, dlgimage], update_image);


interface TreeItem {
    node: number;
    chldr: TreeItem[];    
    level: number;
}

function DAG_to_tree(nodes: Record<number, DialogNode>, start = 0, avoid: number[] = []) : TreeItem {
    const chlds : TreeItem[] = [];
    nodes[start].branches.forEach(b=>{
        if (b.target !== null && avoid.indexOf(b.target) == -1) {
            avoid.push(b.target);
            chlds.push(DAG_to_tree(nodes, b.target, avoid));
            avoid.pop();
        }
    })
    return {
        node: start,
        chldr: chlds,
        level: avoid.length-1
    }
}

function tree_to_LevelMap(tree: TreeItem) {
    const mp: Record<number, number> = {};

    function cycle(node: TreeItem) {
        mp[node.node] = node.level;
        node.chldr.forEach((p,idx)=>{
            if (!mp[p.node] || mp[p.node] < p.level) {
                cycle(p);
            }
        })
    }
    cycle(tree);
    return mp;
}

interface Node {
    node_id: number;
    level:number;
    offset:number;
    height:number;
};

type NodeLayout = Node[];

interface Via {
    level:number;
    offset:number;    
    target_node: number;
};

type ViaList = Via[];

interface Arrow {
    from_level: number;
    from_offset: number;
    to_level: number;
    to_offset: number;
    head: boolean;
    backward: boolean;
    from_via: boolean;
};
type Arrows = Arrow[];

interface Layout {
    nodes: NodeLayout;
    vias: ViaList;
    arrows: Arrows;
    unused: Record<number, boolean>
};

const node_base_height = 1;
const node_initial_offset = 8;

function create_layout(story: DialogStory) : Layout{
    const nodes: NodeLayout = [];
    const vias: ViaList = [];
    const arrows: Arrows = [];
    const alloc: number[] = [node_initial_offset];
    const refs: Record<number, Node> = {};
    const tree = DAG_to_tree(story.nodes,0,[0]);
    const level_map = tree_to_LevelMap(tree);
    

    const queue:(Node|Via)[] = [];    

    function add_node(nd: number, level: number, pos: number) {
        const cur_offset = Math.max(alloc[level] || 0, pos);
        const node = story.nodes[nd];
        const height = node_base_height + node.branches.length;
        alloc[level] = cur_offset+height+1;
        const def :Node = {height,level,node_id:nd,offset:cur_offset};
        nodes.push(def);        
        refs[nd] = def;
        queue.push(def);
        return cur_offset;
    }
    function add_via(level: number, target_node:number, pos:number) {
        const offset = Math.max(alloc[level] || 0, pos);
        alloc[level] = offset+1;
        const def: Via = {level,offset,target_node};
        queue.push(def);
        vias.push(def);
        return offset;
    }

    function add_route(cur_level:number, target: number, offset:number, from_via: boolean) {
        const tlevel = level_map[target];
        const toffset = from_via?offset:offset-node_base_height-2;
        if (tlevel !== undefined) {
            if (tlevel == cur_level+1) {
                const tref = refs[target];
                let h = tref?tref.offset:add_node(target, tlevel, toffset);
                arrows.push({
                    from_level : cur_level,
                    from_offset : offset,
                    to_level : tlevel,
                    to_offset : h,
                    head: true,
                    backward:false,
                    from_via
                });
            } else if (tlevel > cur_level) {
                let h = add_via(cur_level+1, target, offset);
                arrows.push({
                    from_level:cur_level,
                    from_offset: offset,
                    to_level: cur_level+1,
                    to_offset: h,
                    head: false,
                    backward: false,
                    from_via
                });                            
            } else {
                const tref = refs[target];
                if (tref) {
                    if (tlevel == cur_level && from_via) {
                        arrows.push({
                            from_level : cur_level,
                            from_offset : offset,
                            to_level : cur_level,
                            to_offset : tref.offset+0.5,
                            head: true,
                            backward:true,
                            from_via
                        });                        
                    } else if (from_via) {
                        let h = add_via(cur_level-1, target, toffset);
                        arrows.push({
                            from_level : cur_level-1,
                            from_offset : h,
                            to_level : cur_level,
                            to_offset : offset,
                            head: false,
                            backward:false,
                            from_via
                        });
                    } else {
                        let h = add_via(cur_level, target, toffset);
                        arrows.push({
                            from_level : cur_level,
                            from_offset : offset,
                            to_level : cur_level,
                            to_offset : h,
                            head: false,
                            backward:true,
                            from_via
                        });
                    }
                }
            }
        }
    }

    add_node(0, level_map[0], node_initial_offset);
    
    while (queue.length) {
        const cur = queue.shift()!;
        const selected_node = cur as Node;
        const cur_via = cur as Via;
        if (selected_node && selected_node.height !== undefined) {
            const cur_level = level_map[selected_node.node_id];    
            const node = story.nodes[selected_node.node_id];
            node.branches.forEach((b,idx)=>{
                const offset = selected_node.offset+node_base_height+idx;
                if (b.target !== null && b.target !== undefined) {
                    add_route(cur_level, b.target, offset, false);
                }
            });
        } else  if (cur_via && cur_via.target_node !== undefined) {
            add_route(cur_via.level, cur_via.target_node, cur_via.offset, true);
        }    
    }

    const unused = Object.fromEntries(Object.keys(story.nodes).map(x=>[x,true]));
    for (const k in level_map) delete unused[k];

    return {nodes,vias,arrows, unused};
}

const diagram = ref<Layout>();

watch(cur_story, ()=>{
    if (cur_story.value) {
        diagram.value = create_layout(cur_story.value);
    }
},{deep:true})

watch(current_index, ()=>{
    if (typeof current_index.value == "number") {
//        cur_story.value =  dialogs._dlg[current_index.value];
    } else {
        return null;
    }
    edit_focus.value={};
});

interface EditFocus {
    dlg?: number
    node?: number;
    branch?: number;
    condition?: string;
}

const edit_focus = ref<EditFocus>({});


function create_story() {
    const n = dialogs.create_story();
    if (current_index.value !== null) {
        const spkcfg = dialogs._dlg[current_index.value].speakers.map(x=>{
            return Object.assign({}, x) as DialogSpeaker;
        });
        dialogs._dlg[n].speakers = spkcfg;
    }
    current_index.value = n;
    edit_focus.value = {};
}
async function delete_story() {
    const s = current_index.value
    if (s && await messageBoxConfirm(`Confirm you wish to delete whole story "#${s} ${dialogs._dlg[s].name}"`)) {
        delete dialogs._dlg[s];
    }
}

const grid_x = 200;
const grid_y = 30;
const grid_width = 150;

function x_coord(x:number) {
    return grid_x * x;
}
function y_coord(y:number) {
    return grid_y * y;
}
function x_width() {
    return grid_width;
}
function y_height(y:number) {
    return grid_y * y+grid_y/2;
}
function y_arrow(y:number) {
    return grid_y * y+grid_y/2;
}

function x_arrow_right(x:number) {
    return grid_x * x+grid_width;
}

function calc_arrow(a : Arrow) : string {
    

    const xf = a.backward && a.from_via?x_coord(a.from_level):x_arrow_right(a.from_level);
    const xt = a.backward && !a.from_via?x_arrow_right(a.to_level):x_coord(a.to_level);
    const yf = y_arrow(a.from_offset);
    const yt = y_arrow(a.to_offset)
    const xtp = xt + (a.head?5*(a.backward&& !a.from_via?1:-1):0);
    const xfp = xf - (a.from_via?5:0);
    const m = (grid_x-grid_width)/1.5+Math.abs(yt-yf)*0.1;
    const xfc = a.backward && a.from_via?xf-m:xf+m
    const xtc = a.backward && !a.from_via?xt+m:xt-m;
    const r= Math.min(Math.abs(xt-xf),Math.abs(yt-yf),20);
    

    const path = new SVGPath();
    path.mt(xf, yf)
        .lt(xfp, yf)
        .bct(xfc,yf,xtc,yt,xtp,yt)
        .lt(xt,yt);
    return path.get_path_data();
    
}

function branch_class(type: number, final: boolean, idx: number) {
    const r = ["choice",DialogBranchTypeStr[type]];
    if (final) r.push("final");
    if (idx === edit_focus.value.branch) r.push("selected")
    return r.join(" ");
}

const image_list = create_datalist(async ()=>{
    const lst = await server.getDDLFiles(AssetGroup.DIALOGS) ;
    return lst.files.map(x=>({value:x.name}));
})

function update_optional_field(ev: Event, object: any, field: string) {
    const t = ev.target as HTMLInputElement ;
    if (t) {
        if (t.value) {
            object[field] = t.value;
        } else {
            delete object[field];
        }
    }
}
function add_branch() {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined) return;
    const d = dialogs._dlg[f.dlg];
    const n = d.nodes[f.node];
    const b = DialogManager.new_branch();
    b.target = null;
    n.branches.push(b);
    edit_focus.value.branch =  n.branches.length-1;
}
function add_node_branch() {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined || f.branch === undefined) return;
    const d = dialogs._dlg[f.dlg];
    const n = d.nodes[f.node];
    const nn = DialogManager.create_node(d);
    const b = n.branches[f.branch];
    b.target = nn[0];
    f.node = b.target;
    delete edit_focus.value.branch;
}

const selected_dlg = computed(()=>{
    const f = edit_focus.value
    if (f.dlg !== undefined && f.node === undefined && f.branch === undefined) return dialogs._dlg[f.dlg];
    return undefined;

});

const selected_node = computed(()=>{
    const f = edit_focus.value
    if (f.dlg !== undefined&& f.node!== undefined) return dialogs._dlg[f.dlg].nodes[f.node];
    return undefined;    
});

const selected_branch = computed(()=>{
    const f = edit_focus.value
    if (f.dlg!== undefined && f.node!== undefined && f.branch!== undefined) return dialogs._dlg[f.dlg].nodes[f.node].branches[f.branch];
    return undefined;    
});

interface ConditionDef {
    name: string;
    content: DialogAction;
}

const selected_condition = ref<ConditionDef|null>(null);
    
watch(edit_focus,()=>{
    selected_condition.value = null; 
}, {deep:true});


async function delete_branch() {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined || f.branch === undefined) return;
    if (await messageBoxConfirm("Confirm you want to delete selected branch")) {
        const d = dialogs._dlg[f.dlg];
        const n = d.nodes[f.node];
        const b = n.branches;
        b.splice(f.branch);        
        n.branches = b.slice();
        f.branch = undefined;
    }
}

async function delete_node() {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined) return;
    if (await messageBoxConfirm("Confirm you want to delete selected node and all branches)")) {
        const d = dialogs._dlg[f.dlg];
        delete d.nodes[f.node];
        for (const id in d.nodes) {
            const n = d.nodes[id];
            n.branches.forEach(b=>{
                if (b.target === f.node) b.target = null;
            });
        }
    }
}

async function branch_move(dir: number) {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined || f.branch === undefined ) return;
    const d = dialogs._dlg[f.dlg];
    const n = d.nodes[f.node];
    if (f.branch + dir < 0 || f.branch + dir >= n.branches.length) return;
    const b1 = n.branches[f.branch];
    const b2 = n.branches[f.branch+dir];
    n.branches[f.branch] = b2;
    n.branches[f.branch+dir] = b1;
    f.branch = f.branch+dir;
}

function edit_condition(s:string) {
    if (cur_story.value) {
        if (!s) {
            selected_condition.value = {name:"",content:{ast:{},source:""}};
        } else {
            selected_condition.value = {name:s, content:cur_story.value.conditions[s]};
        }
    }
}

async function save_condition() {
    if (selected_condition.value && cur_story.value) {
        if (selected_condition.value.content.source) {
            cur_story.value.conditions[selected_condition.value.name] = selected_condition.value.content;
            if (selected_branch.value) {
                selected_branch.value.condition = selected_condition.value.name;
            }
        } else if (await messageBoxConfirm(`Confirm you want to remove the condition ${selected_condition.value.name}`)) {
            delete cur_story.value.conditions[selected_condition.value.name];
        } else {
            return;
        }
        selected_condition.value = null;
    }
}

function edit_speakers() {
    if (edit_speakers_dlg.value) {
        edit_speakers_dlg.value.showModal();
    }
}

const postavy_dat_ref = ref<HTMLSelectElement[]>([]);
let thum : THumanData | null = null;

watch(postavy_dat_ref, async ()=>{
    const el = postavy_dat_ref.value;
    if (el.length)  {
        if (!thum) {
                const bin =await server.getDDLFile("POSTAVY.DAT");
                thum = humanDataFromArrayBuffer(bin);
        }
        if (thum) {
                el.forEach(sel=>{
                    const v = sel.value;
                    while (sel.options.length) sel.options.remove(0);
                    thum!.characters.forEach(x=>{
                        const opt = document.createElement("OPTION") as HTMLOptionElement;
                        opt.textContent = x.jmeno;
                        opt.value = `${x.xicht}`;
                        sel.options.add(opt);
                    })
                    sel.value = v;
            });
        }
    } else {
        thum = null;
    }
},{deep:true});

</script>
<template>
<x-workspace :hidden="!active">
    <div class="list" >
        <input type="search" v-model="list_filter">
        <select v-model="current_index" size="10">
            <option v-for="v of filtered_list" :value="v[0]" > {{  v[1] }}</option>
        </select>        
        <div class="buttons">
            <button @click="create_story">Create</button>
            <button @click="delete_story">Delete</button>
        </div>
    </div>
    <div class="main-panel" v-if="cur_story && current_index">
        <div class="diagram">
        <svg v-if="diagram " v-autosvgsize padding="40">
              <defs>
            <marker id="arrow_4d4e7fe4a" markerWidth="8" markerHeight="8" 
            refX="8" refY="4" orient="auto">
                <polygon points="0 0, 8 4, 0 8" />
            </marker>
            </defs>
  
            <g class="root node" @click="edit_focus={dlg: current_index}" :class="{selected: edit_focus.dlg === current_index && edit_focus.node === undefined}">
                <rect x="0" y="0" rx="10" rc="10" :width="x_coord(1)+x_width()" :height="y_height(5)" />                
                <text class="title" x="0.3rem" y="1.2rem"> #{{ current_index }} {{ cur_story.name }}</text>
                <text x="0.3rem" y="2.4rem" v-svg-ellipsis="x_coord(1)+x_width()-5" :key="cur_story.description"> {{  cur_story.description }} </text>                
                <image x="0" :y="y_height(1)-2" :width="x_coord(1)+x_width()" :height="y_coord(4)"
                    :href="noimage" ref="dlgimage" :key="cur_story.picture"/>
            </g>

            <path v-for="n of diagram.arrows" :d="calc_arrow(n)" class="arrow" :marker-end="n.head?'url(#arrow_4d4e7fe4a)':undefined"></path>
            <line v-for="n of diagram.vias" :x1="x_coord(n.level)" class="via" :y1="y_arrow(n.offset)" :x2="x_arrow_right(n.level)" :y2="y_arrow(n.offset)" />
            <template v-for="n of diagram.nodes" :key="n.node_id">
                <g :transform="`translate(${x_coord(n.level)},${y_coord(n.offset)})`">
                    <g class="node" :class="{final: cur_story.nodes[n.node_id].branches.length == 0, selected: edit_focus.node == n.node_id && edit_focus.branch === undefined}" @click="edit_focus={dlg:current_index, node:n.node_id}">
                        <rect  rcx="10" ry="10" x="0" y="0" :width="x_width()" :height="y_height(n.height)" />
                        <text class="title" x="5" :y="grid_y/2" v-svg-ellipsis="grid_width-5" :key=" cur_story.nodes[n.node_id].name"> #{{ n.node_id }} {{ cur_story.nodes[n.node_id].name }}</text>
                    </g>
                    <g v-for="(b,idx) of cur_story.nodes[n.node_id].branches" :class="branch_class(b.type, b.target === null, edit_focus.node === n.node_id?idx:-1)"                        
                        :transform="`translate(0,${y_coord(node_base_height+idx)})`"
                        @click="edit_focus={dlg:current_index,node:n.node_id,branch:idx}"
                        :key="idx">
                        <rect x="0" y="0"
                                :width="x_width()" :height="y_coord(1)"  />
                        <text v-if="b.type==DialogBranchType.jump_to_node" :x="grid_width/2" :y="grid_y/2">(jump)</text>
                        <text v-else class="text" v-svg-ellipsis="grid_width-5" x="5" :y="grid_y/2" :title="b.text" :key="b.text">{{ b.text }}</text>
                        <text class="cond" v-if="b.condition" :key="b.condition" :x="grid_width-2" :y="grid_y-2">{{ b.condition }}</text>
                    </g>
                </g>
            </template>            
        </svg>
        </div>
        <div class="editor" v-if="cur_story">
            <select v-model="edit_focus.node" size="2" @change="edit_focus.branch = undefined;edit_focus.dlg = current_index">
                <option v-for="(n, id) of cur_story.nodes" :key="id" :value="id" :class="{unused: diagram!.unused[id]}"> #{{ id }} {{ n.name }} </option>
            </select>
            <div>                        
            <template v-if="selected_dlg">
                <x-section>
                    <x-section-title>Story</x-section-title>
                    <x-form>
                        <label><span>Name (not visible) </span><input type="text" v-model="selected_dlg.name"</label>
                        <label><span>Description (visible)</span><textarea v-model="selected_dlg.description" rows="7"></textarea></label>
                        <label><span>Picture</span><input type="text" v-model="selected_dlg.picture"
                            :list="image_list.id"></label>
                    </x-form>
                </x-section>
            </template>
            <template v-else-if="selected_node && !selected_branch">
                <x-section>
                    <x-section-title>Node</x-section-title>
                    <x-form>
                        <div class="label"><span></span><div class="more r">
                            <button @click="add_branch">Add Branch</button>
                            <button @click="delete_node">Delete node</button>
                        </div></div>
                        <label><span>Name (not visible)</span><input type="text" v-model="selected_node.name"></label>
                        <label><span>Action (code)</span><DlgCodeEditor class="code_edit" v-model="selected_node.action"/></label>
                        <label><span>Description (optional, visible)</span><textarea type="text" rows="3"
                            :value="selected_node.description ??''"
                            @change="ev=>update_optional_field(ev,dialogs._dlg[edit_focus.dlg!].nodes[edit_focus.node!],'description')"
                            ></textarea></label>
                        <label><span>Picture (optional, visible)</span><input type="text" 
                            :value="selected_node.picture ??''"
                            @change="ev=>update_optional_field(ev,dialogs._dlg[edit_focus.dlg!].nodes[edit_focus.node!],'picture')"
                            :list="image_list.id"></label>                                                    
                    </x-form>
                </x-section>
            </template>
            <template v-else-if="selected_condition">
                <x-section>
                    <x-section-title>Edit condition: {{ selected_condition.name }}</x-section-title>
                    <x-form>                        
                        <label><span>Name</span><input type="text" v-model="selected_condition.name"></label>
                        <label><span>Code</span><DlgCodeEditor class="code_edit" v-model="selected_condition.content"/></label>
                        <div class="label"><span>NOTE: A change is applied everywhere the modified condition is used in the current story</span>
                            <div class="more">
                                <button @click="save_condition" :disabled="!selected_condition.name">Save & Apply</button>
                                <button @click="selected_condition = null">Cancel</button>
                            </div>
                        </div>
                    </x-form>
                </x-section>
            </template>
            <template v-else-if="selected_branch && selected_node">
                <x-section>
                    <x-section-title>Branch</x-section-title>
                    <x-form>
                        <div class="label"><span></span><div class="more r">
                            <button :disabled="!edit_focus.branch" @click="branch_move(-1)">Move up</button>
                            <button :disabled="(edit_focus.branch ?? 0)+1 >= selected_node.branches.length" @click="branch_move(+1)">Move down</button>
                            <button @click="add_branch">Add Branch</button>
                            <button @click="delete_branch">Delete Branch</button>
                        </div>
                    </div>
                        <label><span>Branch type: </span><select v-model.number="selected_branch.type">
                            <option :value="0">Jump</option>
                            <option :value="1">Text</option>
                            <option :value="2">Choice</option>
                            <option :value="3">Select character</option>
                            <option :value="4">Select dead character</option>
                        </select></label>
                        <div class="label" v-if="selected_branch.type != 0"><span>Speaker</span><div class="more">
                            <select v-model.number="selected_branch.speaker">
                                <option :value="0">(not set)</option>                                
                                <option v-for="(v,idx) in cur_story.speakers" :value="idx+1" :key="idx"> {{ v.name }} </option>
                            </select>                            
                            <button @click="edit_speakers">Edit speakers</button>
                            
                        </div></div>
                        <label v-if="selected_branch.type != 0">
                                <span class="text-help">Text<span>
                                [he,she] - choosen by speaker gender<br/>
                                %n - replace by speaker name<br/>
                                %[ , %] - replaced by [,  ]</span></span>
                                <textarea rows="5" v-model="selected_branch.text"></textarea></label>
                        <div class="label"><span>Target</span>
                            <div class="more">
                                <select v-model.number="selected_branch.target">
                                    <option v-for="(v,k) in cur_story.nodes" :key="k" :value="k" :class="{unused: diagram!.unused[k]}">
                                        #{{ k }} {{ v.name }}
                                    </option>
                                </select>
                            <button :disabled="selected_branch.target === null" @click="selected_branch.target = null">Exit dialog</button>
                            <button :disabled="selected_branch.target !== null" @click="add_node_branch">Add node</button>
                        </div></div>
                        <div class="label"><span>Condition</span>
                            <div class="more">
                                <select v-model="selected_branch.condition">
                                    <option value="">(none)</option>
                                    <option v-for="(v,k) of cur_story.conditions" :key="k" :value="k">{{ k }}</option>
                                </select>
                                <button :disabled="!selected_branch.condition" @click="edit_condition(selected_branch.condition)">Edit</button>
                                <button @click="edit_condition('')">Add</button>                                
                            </div>
                        </div>
                    </x-form>
                </x-section>
            </template>
            <template v-else>
                <div class="nsel">Nothing selected</div>
            </template>
            </div>
        </div>
    </div>

    <dialog ref="edit_speakers_dlg" v-if="cur_story">
        <header>Edit speakers <button class="close" @click="edit_speakers_dlg!.close()"></button></header>
        <table>
            <thead>
                <tr>
                    <th></th><th>Name</th><th>Type</th><th>Attribute</th><th>Parameter</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="(v,idx) of cur_story.speakers" :key="idx">
                    <td>{{ idx+1 }}.</td>
                    <td>
                        <input v-model="v.name">
                    </td>
                    <td>
                        <select v-model="v.type">
                            <option :value="0">unset</option>
                            <option :value="1">Attribute</option>
                            <option :value="2">Random</option>
                            <option :value="3">Character</option>
                            <option :value="4">Character position</option>
                        </select>
                    </td>
                    <td>
                        <select v-model="v.attribute" v-if="v.type == DialogSpeakerType.attribute">
                            <option v-for="(a,idx) of CharacterStatsNames" :key="idx" :value="idx">{{ a }} &gt;</option>
                        </select>
                    </td>
                    <td>
                        <input v-if="v.type == DialogSpeakerType.attribute" type="number" v-model="v.param" v-watch-range min="0" max="100">
                        <select v-else-if="v.type == DialogSpeakerType.character" v-model="v.param">
                            <option v-for="v of [0,1,2,3,4,5]" :key="v" :value="v"> Character slot {{ v+1 }}</option>
                        </select>
                        <select v-else-if="v.type == DialogBranchType.selchar" ref="postavy_dat_ref" v-model="v.param">
                            <option :value="v.param"> ?? {{ v.param }}</option>
                        </select>
                    </td>
                </tr>
            </tbody>
        </table>
        <footer>
            <button @click="edit_speakers_dlg!.close()">Close</button>
        </footer>
    </dialog>


</x-workspace>

</template>
<style lang="css" scoped>
.list {
    position: absolute;
    left:0;
    top: 0;
    width: 15rem;
    bottom: 0;
}
.list input {
    position: absolute;
    left: 0;
    right: 0;
    top:0;
    height: 2rem;
}
.list select {
    position: absolute;
    left: 0;
    right: 0;
    top:2rem;
    bottom: 2rem;
}
.list .buttons {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2rem;
    display: flex;    
}
.list .buttons>* {
    flex-grow: 1;
}

.main-panel {
    position: absolute;
    left: 15rem;
    top: 0;
    bottom: 0;
    right: 0;    
    overflow: auto;
    display: flex;
    flex-direction: column;
    
}

text.title {
    font-weight: bold;
}

.node {
   cursor: pointer;
}
.node rect {
    stroke: black;
    fill:white;
}
.node:hover rect {
    fill:#eeb;
}
.node.selected rect,.choice.selected rect  {
    stroke: red;
    stroke-width: 4px;
}
.node.selected.final rect,.choice.selected.final rect  {
    stroke: brown;
}

.via {
    stroke: black;
}
.arrow {
    fill: none;
    stroke: black;
}
.choice {
    cursor: pointer;
}
.choice rect {
    stroke: black;
    fill:#ffd;
}
.choice:hover rect {
    fill:#eeb !important;
}

.choice.npctalk rect {
    fill:#ddd;
}
.choice.seldead rect {
    fill:#ccf;
}

.choice.jump_to_node rect {
    fill:white;
}
.choice.jump_to_node text {
    fill: #888;
    font-style: italic;
    text-anchor: middle;
}

.choice.selchar rect {
    fill:#dfd;
}
.choice text.cond {
    text-anchor: end;
    font-size: 0.7rem;
    fill: brown;
}

.final rect {
    stroke: green;
    stroke-width: 3px;
}
.editor {
    flex-grow: 0;
    display: flex;
    min-height: 20rem;

}
.editor > *:last-child{
    flex-grow: 1;
}
.editor > *:first-child{
    width: 15rem;
}

.editor x-section-title {
    background-color: #ddd;
}
.code_edit {
    text-align: left;
    background-color: white;
    height: 7rem;
    border: 1px solid;
}
.diagram {
    flex-grow: 1;
    flex-shrink: 1;
    width: 100%;
    overflow: auto;
}
.nsel {
    height: 6rem;
    text-align: center;
}
div.label div.more {
    text-align: left;
    white-space: nowrap;
}
div.label div.more.r {
       text-align: right;
}
div.label div.more > *{
    margin: 0.2rem;
    
}

div.label div.more button, div.label div.more span{
    display: inline-block;
}
div.label select {
    min-width: 30%;
}

option.unused {
    color: red;
}
.text-help {
    position: relative;
    height: 5rem;
    overflow: hidden;
}
.text-help > span {
    display: block;
    position: absolute;
    font-size: 0.8rem;
    line-height: 1rem;
    left: 1rem;
    top: 1.5rem;
    bottom: 0;
    width: 20rem;


}
dialog input[type=number] {width:5rem;text-align: center;}

</style>