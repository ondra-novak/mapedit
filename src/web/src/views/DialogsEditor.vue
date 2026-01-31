<script setup lang="ts">
import { server } from '@/core/api';
import { DialogManager, DialogBranchType, type DialogNode, type DialogStory, DialogBranchTypeStr } from '@/core/dialog_structs';
import { SVGPath } from '@/utils/svg';
import { computed, onMounted, ref,watch } from 'vue';

const dialogs = ref<DialogManager>(new DialogManager);


async function init() {
    try {
        const json_data = await server.getDDLFile("DIALOGY.JSON");
        const dec = new TextDecoder();
        dialogs.value.load(dec.decode(json_data));
    } catch (e) {
        console.warn("Failed to load dialogs", e);
    }
}

onMounted(()=>init());

const current_index = ref<number>();
const list_filter = ref<string>("");

const cur_story = computed(()=>{
    if (typeof current_index.value == "number") {
        return dialogs.value._dlg[current_index.value];
    } else {
        return null;
    }
})
const filtered_list = computed(()=>{
    const srch = list_filter.value.toLocaleLowerCase();
    return dialogs.value._dlg.map((x,idx)=>[idx,x.name] as [number, string])
        .filter(x=>!srch || x[1].toLocaleLowerCase().indexOf(srch) != -1);
});

const props = defineProps<{active:boolean}>();

interface TreeItem {
    node: number;
    chldr: TreeItem[];    
    level: number;
}

function DAG_to_tree(nodes: Record<number, DialogNode>, start = 0, avoid: number[] = []) : TreeItem {
    const chlds : TreeItem[] = [];
    nodes[start].branches.forEach(b=>{
        if (b.target && !avoid.find(x=>x == b.target)) {
            avoid.push(b.target);
            chlds.push(DAG_to_tree(nodes, b.target, avoid));
            avoid.pop();
        }
    })
    return {
        node: start,
        chldr: chlds,
        level: avoid.length
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

function create_layout(story: DialogStory) : Layout{
    const nodes: NodeLayout = [];
    const vias: ViaList = [];
    const arrows: Arrows = [];
    const alloc: number[] = [];
    const refs: Record<number, Node> = {};
    const tree = DAG_to_tree(story.nodes);
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
        const toffset = from_via?offset:offset-node_base_height;
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

    add_node(0, level_map[0], 0);
    
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

    return {nodes,vias,arrows};
}

const diagram = ref<Layout>();

watch(cur_story, ()=>{
    if (cur_story.value) {
        diagram.value = create_layout(cur_story.value);
        console.log(diagram.value);

    }
})

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

function branch_class(type: number, final: boolean) {
    const r = ["choice",DialogBranchTypeStr[type]];
    if (final) r.push("final");
    return r.join(" ");
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
        <svg v-if="diagram" v-autosvgsize padding="40">
              <defs>
            <marker id="arrow_4d4e7fe4a" markerWidth="8" markerHeight="8" 
            refX="8" refY="4" orient="auto">
                <polygon points="0 0, 8 4, 0 8" />
            </marker>
            </defs>
  
            <path v-for="n of diagram.arrows" :d="calc_arrow(n)" class="arrow" :marker-end="n.head?'url(#arrow_4d4e7fe4a)':undefined"></path>
            <line v-for="n of diagram.vias" :x1="x_coord(n.level)" class="via" :y1="y_arrow(n.offset)" :x2="x_arrow_right(n.level)" :y2="y_arrow(n.offset)" />
            <template v-for="n of diagram.nodes">
                <g class="node" :class="{final: cur_story.nodes[n.node_id].branches.length == 0}">
                <rect  rcx="10" ry="10" :x="x_coord(n.level)" :y="y_coord(n.offset)" :width="x_width()" :height="y_height(n.height)" />
                <text  :x="x_coord(n.level)+5" :y="y_coord(n.offset)+grid_y/2" v-svg-ellipsis="grid_width-5"> #{{ n.node_id }} {{ cur_story.nodes[n.node_id].name }}</text>
                </g>
                <g v-for="(b,idx) of cur_story.nodes[n.node_id].branches" :class="branch_class(b.type, !b.target)">
                    <rect :x="x_coord(n.level)" :y="y_coord(n.offset+node_base_height+idx)"
                            :width="x_width()" :height="y_coord(1)"  />
                    <text class="text" v-svg-ellipsis="grid_width-5" :x="x_coord(n.level)+5" :y="y_coord(n.offset+node_base_height+idx)+grid_y/2" :title="b.text">{{ b.text }}</text>
                </g>
            </template>
        </svg>
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

.node {
   cursor: pointer;
}
.node text {
    font-weight: bold;
}
.node rect {
    stroke: black;
    fill:white;
}
.node:hover rect {
    fill:#dda;
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
    fill:#dda !important;
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

</style>