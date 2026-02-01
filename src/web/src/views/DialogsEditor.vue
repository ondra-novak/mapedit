<script setup lang="ts">
import { server } from '@/core/api';
import { DialogManager, DialogBranchType, type DialogNode, type DialogStory, DialogBranchTypeStr } from '@/core/dialog_structs';
import { SVGPath } from '@/utils/svg';
import { computed, onMounted, reactive, ref,watch } from 'vue';
import noimage from '@/assets/noimage.svg'
import HIFormat from '@/core/hiformat';
import { create_datalist, type DataListItem } from '@/utils/datalist';
import { AssetGroup } from '@/core/asset_groups';
import DlgCodeEditor from '@/components/DlgCodeEditor.vue';

const dialogs = reactive(new DialogManager);
let inited = false;
const props = defineProps<{active:boolean}>();


async function init() {
    try {
        const json_data = await server.getDDLFile("DIALOGY.JSON");
        const dec = new TextDecoder();
        dialogs.load(dec.decode(json_data));
        inited = true;

        server.on("modified", ()=>{
            init();            
        });

    } catch (e) {
        console.warn("Failed to load dialogs", e);
    }
}

onMounted(()=>{
    if (props.active) init();
});

watch(()=>props.active,()=>{
    if (props.active && !inited) init();
})


const dlgimage = ref<SVGImageElement>();
const current_index = ref<number>();
const list_filter = ref<string>("");

const cur_story = ref<DialogStory>()
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
//        dlgimage.value.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);
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
                let h = add_via(cur_level+1, target, toffset);
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
        const cur_node = cur as Node;
        const cur_via = cur as Via;
        if (cur_node && cur_node.height !== undefined) {
            const cur_level = level_map[cur_node.node_id];    
            const node = story.nodes[cur_node.node_id];
            node.branches.forEach((b,idx)=>{
                const offset = cur_node.offset+node_base_height+idx;
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
    Object.keys(unused).map((k,idx)=> {
                        add_node(parseInt(k), idx, 0);
    });


    return {nodes,vias,arrows};
}

const diagram = ref<Layout>();

watch(cur_story, ()=>{
    if (cur_story.value) {
        diagram.value = create_layout(cur_story.value);
    }
},{deep:true})

watch(current_index, ()=>{
    if (typeof current_index.value == "number") {
        cur_story.value =  dialogs._dlg[current_index.value];
    } else {
        return null;
    }
    edit_focus.value={};
});

interface EditFocus {
    dlg?: number
    node?: number;
    branch?: number;
}

const edit_focus = ref<EditFocus>({});


function create_story() {

}
function delete_story() {

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
    const [id, node] = DialogManager.create_node(d);
    const b = DialogManager.new_branch();
    b.target = id;
    n.branches.push(b);
}

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
    <div class="main-panel" v-if="cur_story">
        <div class="left-right">
        <svg v-if="diagram" v-autosvgsize padding="40">
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
                    <g v-for="(b,idx) of cur_story.nodes[n.node_id].branches" :class="branch_class(b.type, b.target === undefined, edit_focus.node === n.node_id?idx:-1)"                        
                        :transform="`translate(0,${y_coord(node_base_height+idx)})`"
                        @click="edit_focus={dlg:current_index,node:n.node_id,branch:idx}"
                        :key="idx">
                        <rect x="0" y="0"
                                :width="x_width()" :height="y_coord(1)"  />
                        <text class="text" v-svg-ellipsis="grid_width-5" x="5" :y="grid_y/2" :title="b.text" :key="b.text">{{ b.text }}</text>
                    </g>
                </g>
            </template>            
        </svg>
        </div>
        <div class="editor" v-if="cur_story">
            <template v-if="edit_focus.dlg !== undefined &&  edit_focus.node === undefined">
                <x-section>
                    <x-section-title>Story</x-section-title>
                    <x-form>
                        <label><span>Name (not visible) </span><input type="text" v-model="dialogs._dlg[edit_focus.dlg].name"</label>
                        <label><span>Description (visible)</span><textarea v-model="dialogs._dlg[edit_focus.dlg].description" rows="7"></textarea></label>
                        <label><span>Picture</span><input type="text" v-model="dialogs._dlg[edit_focus.dlg].picture"
                            :list="image_list.id"></label>
                    </x-form>
                </x-section>
            </template>
            <template v-else-if="edit_focus.dlg !== undefined && edit_focus.branch === undefined && edit_focus.node !== undefined">
                <x-section>
                    <x-section-title>Node</x-section-title>
                    <x-form>
                        <label><span>Name (not visible)</span><input type="text" v-model="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node].name"></label>
                        <label><span>Action (code)</span><DlgCodeEditor class="code_edit" v-model="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node].action"/></label>
                        <label><span>Description (optional, visible)</span><textarea type="text" rows="3"
                            :value="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node].description ??''"
                            @change="ev=>update_optional_field(ev,dialogs._dlg[edit_focus.dlg!].nodes[edit_focus.node!],'description')"
                            ></textarea></label>
                        <label><span>Picture (optional, visible)</span><input type="text" 
                            :value="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node].picture ??''"
                            @change="ev=>update_optional_field(ev,dialogs._dlg[edit_focus.dlg!].nodes[edit_focus.node!],'picture')"
                            :list="image_list.id"></label>                            
                        <label><span></span><div><button @click="add_branch">Add Branch</button></div></label>
                    </x-form>
                </x-section>
            </template>
            <template v-else-if="edit_focus.dlg">
                <x-section>
                    <x-section-title>Branch</x-section-title>
                    <x-form>
                        <label><span>Branch type: </span><select v-model.number="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node!].branches[edit_focus.branch!].type">
                            <option :value="0">Jump</option>
                            <option :value="1">NPC talk (text+pause)</option>
                            <option :value="2">Choice</option>
                            <option :value="3">Select character</option>
                            <option :value="4">Select dead character</option>
                        </select></label>
                        <label><span>Condition</span>
                            <select v-model="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node!].branches[edit_focus.branch!].condition">
                                <option value="">(none)</option>
                                <option v-for="(v,k) of dialogs._dlg[edit_focus.dlg].conditions" :key="k" :value="k">{{ k }}</option>
                                <option value="#">(create new condition)</option>
                            </select>
                        </label>
                        <label><span>Text</span><textarea rows="4" v-model="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node!].branches[edit_focus.branch!].text"></textarea></label>
                        <label><span>Speaker (slot)</span><select v-model.number="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node!].branches[edit_focus.branch!].speaker">
                            <option v-for="v in [0,1,2,3,4,5,6,7,8,9]" :value="v" :key="v"> Slot #{{ v }}</option>
                            </select>
                        </label>
                        <label><span>Target</span><select v-model.number="dialogs._dlg[edit_focus.dlg].nodes[edit_focus.node!].branches[edit_focus.branch!].target">
                            <option v-for="(v,k) in dialogs._dlg[edit_focus.dlg].nodes" :key="k" :value="k">
                                #{{ k }} {{ v.name }}
                            </option>
                        </select></label>
                    </x-form>
                </x-section>
            </template>
            <template v-else>
                <div class="nsel">Nothing selected</div>
            </template>

        </div>
    </div>




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
.choice.npctalk rect {
    fill:#ddd;
}

.choice.selchar rect {
    fill:#dfd;
}
.choice text {
    text-overflow: ellipsis; 
    overflow: hidden; 
    white-space: nowrap;
    dominant-baseline: central;
}
.final rect {
    stroke: green;
    stroke-width: 3px;
}
.editor {
    position:sticky;
    bottom: 0;
    border: 1px solid;
    background-color: #ddd;
    padding: 0.5rem 0 0 0;
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
.left-right {
    width: 100%;
    overflow-x: auto;
}
.nsel {
    height: 6rem;
    text-align: center;
}

</style>