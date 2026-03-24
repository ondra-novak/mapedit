<script setup lang="ts">
import { server, type ModifiedFileNotify } from '@/core/api';
import { DialogManager,  type DialogNode, type DialogStory, DialogBranchTypeStr, type DialogAction, DialogBranchType, DialogSpeakerType, type DialogSpeaker, type DialogConstant, DlgNodeType, DialogCompileError, MAX_IDENTIFIERS} from '@/core/dialog_structs';
import { SVGPath } from '@/utils/svg';
import { computed, h, reactive, ref,toRaw,watch } from 'vue';
import noimage from '@/assets/noimage.svg'
import screen from '@/assets/screen.png'
import HIFormat from '@/core/hiformat';
import { create_datalist, type DataListHandle } from '@/utils/datalist';
import { AssetGroup } from '@/core/asset_groups';
import DlgCodeEditor from '@/components/DlgCodeEditor.vue';
import { messageBoxConfirm } from '@/utils/messageBox';
import type { SaveRevertControl } from '@/components/statusBar';
import StatusBar from '@/components/statusBar';
import { CharacterStatsNames } from '@/core/common_defs';
import { humanDataFromArrayBuffer, type THumanData } from '@/core/character_structs';
import { FactDB } from '@/core/factdb';
import type { WsRpcResult } from '@/core/wsrpc';
import FactEditor from '@/components/FactEditor.vue';
import DlgConstsEditor from '@/components/DlgConstsEditor.vue';
import DelayLoadedList from '@/components/DelayLoadedList.vue';
import getGlobalShops from '@/utils/global_shop_list';
import ToggleButton from '@/components/tools/ToggleButton.vue';
import { directions } from '@/core/map_structs';

const dialogs = reactive(new DialogManager);
let inited = false;
const props = defineProps<{active:boolean}>();
let save_state: SaveRevertControl|null = null;
let ignore_modified = false;
const edit_speakers_dlg = ref<HTMLDialogElement>();
const facts = ref(new FactDB);
let image_list : DataListHandle = {id:""} as DataListHandle;
const image_cache = reactive(new Map<string, string>());


function getImageHref(s:string) {
    if (s == "SCREEN") return screen;
    const img = image_cache.get(s);
    if (!img) {
        server.getDDLFile(s).then(data=>{
                const url = HIFormat.fromArrayBuffer(data).createCanvas().toDataURL();
                image_cache.set(s,url);                
        });
    } else {
        return img;
    }
}

let speaker_default_state = false;

function set_default_speaker(ev: Event) {
    const t = ev.target as HTMLInputElement;
    speaker_default_state = t.checked;
}

function load_dialogy() {
    server.getDDLFile("DIALOGY.JSON").then((json_data: ArrayBuffer)=>{
            const dec = new TextDecoder();
            dialogs.load(dec.decode(json_data));
            queueMicrotask(()=>{
                if (save_state) save_state.set_changed(false);
            })
            current_index.value = null;
            delay_compile();
    });
}

function load_facts() {
    server.getDDLFile("FACTS.JSON").then((json_data:ArrayBuffer)=>{
        const dec = new TextDecoder();
        facts.value = FactDB.fromJSON(dec.decode(json_data));
    });
}

function init() {
    load_dialogy();
    load_facts();
    server.on("modified", (x:WsRpcResult)=>{
        const n : ModifiedFileNotify = x.data;
        if (n.name == "DIALOGY.JSON") {
            if (ignore_modified) ignore_modified = false;
            else load_dialogy();
        } else if (n.name == "FACTS.JSON") {
            load_facts();
        }
    });
    inited = true;
}

async function save_all() {
    const json_data = dialogs.save();
    const enc = new TextEncoder();
    const bin = enc.encode(json_data);
    ignore_modified = true;
    await server.putDDLFile("DIALOGY.JSON", bin.buffer, AssetGroup.MAPS);    
    const code = compile_code(true);
    if (code !== null) {
        const bin = DialogManager.generate_dat(code);
        await server.putDDLFile("DIALOGY.DAT", bin, AssetGroup.MAPS);
        StatusBar.invoke_reload();
    }
}

watch(()=>props.active,()=>{
    if (props.active) {
        if (!inited) {
            init(); 
        }
        image_cache.clear();
        if (!save_state) {
            StatusBar.register_save_control().then(s=>{
                save_state = s ;
                save_state.on_save(save_all);
                save_state.on_revert(load_dialogy);                
            });
        }
        image_list =  create_datalist(async ()=>{
                const lst = await server.getDDLFiles(AssetGroup.DIALOGS) ;
                return lst.files.map(x=>({value:x.name}));
        })
    }
    if (!props.active && save_state) {
        save_state.unmount();
        save_state = null;
    }
})

interface CompileReport {    
    is_error?: boolean;
    not_referenced?:[string, number, number][];
    stories?: number;
    nodes?: number;
    instructions?: number;
    variables?: number;
    error_message?: string;
    error_location?: [number, number];
}

const compile_report = reactive<CompileReport>({});


function compile_code(cleanup: boolean) {
    try {
        Object.keys(compile_report).forEach(x=>delete (compile_report as Record<string, any>)[x]);
        const code = dialogs.compile(facts.value.getAllFacts().reduce((a,b)=>{
            a[b.key] = {value:b.id, desc:b.description};
            return a;
        },{} as Record<string, DialogConstant>));
        const unused_identifiers = Object.entries(dialogs._identifiers)
            .filter(x=>!x[1].read && !x[1].write)
            .map(x=>x[0]);
        compile_report.not_referenced = Object.entries(dialogs._identifiers)
            .filter(x=>!x[1].read && x[1].write)
            .map(x=>[x[0],x[1].write![0],x[1].write![1]]);
        
        compile_report.is_error = false;
        if (cleanup ) {
            unused_identifiers.forEach(x=>delete dialogs._identifiers[x]);            
        }
        compile_report.stories = Object.keys(dialogs._dlg).length;
        compile_report.nodes = code.reduce((a)=>a+1,0);
        compile_report.instructions = code.reduce((a,b)=>a+b.length,0);
        compile_report.variables = Object.keys(dialogs._identifiers).length;
        return code;
    } catch (e) {
        const err = e as DialogCompileError;
        compile_report.is_error = true;
        compile_report.error_message = err.message
        if (err.location) {
            compile_report.error_location= err.location;
        } else {
            delete compile_report.error_location;
        }
        return null;

    }
}

let delay_compile_tm : number|null|NodeJS.Timeout = null;
function delay_compile() {
    if (delay_compile_tm !== null) clearTimeout(delay_compile_tm);
    delay_compile_tm = setTimeout(()=>compile_code(false), 1000);
}

watch(()=>dialogs._dlg, ()=>{
    if (save_state) save_state.set_changed(true);    
    delay_compile();
},{deep:true})



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
const constant_filter = ref("");

const constant_filtered_list = computed(()=>{
    const srch = constant_filter.value.toLocaleLowerCase();
    const clst : Record<string, DialogConstant> = {};
    const out: [string, number, string, boolean][] = [];
    for (const k in dialogs._consts) {
        const c = dialogs._consts[k];
        out.push([k,c.value,c.desc,false]);
    }
    facts.value.getAllFacts().forEach(x=>out.push([x.key,x.id,x.description,true]));
    return out.filter(x=>!srch || x[0].toLocaleLowerCase().indexOf(srch) != -1 || x[2].toLocaleLowerCase().indexOf(srch) != -1)
        .sort((a,b)=>a[0].localeCompare(b[0]));
});



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
    bofs: number;
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
    backside: boolean;
    from_via: boolean;
    backward?: boolean;
};
type Arrows = Arrow[];

interface Layout {
    nodes: NodeLayout;
    vias: ViaList;
    arrows: Arrows;
    unused: Record<number, boolean>
};

function center_layout_vertically(layout: Layout): void {
    // Find max offset for each level
    const level_max_offsets: Record<number, number> = {};
    
    layout.nodes.forEach(n => {
        const max = Math.max(level_max_offsets[n.level] ?? 0, n.offset + n.height);
        level_max_offsets[n.level] = max;
    });
    
    layout.vias.forEach(v => {
        const max = Math.max(level_max_offsets[v.level] ?? 0, v.offset + 1);
        level_max_offsets[v.level] = max;
    });
    
    // Find global max to center around
    const global_max = Math.max(...Object.values(level_max_offsets));
    
    // Calculate offset for each level to center it
    const level_offsets: Record<number, number> = {};
    for (const level in level_max_offsets) {
        level_offsets[level] = (global_max - level_max_offsets[level]) / 2;
    }
    
    // Apply offsets to nodes and vias
    layout.nodes.forEach(n => {
        n.offset += level_offsets[n.level];
    });
    
    layout.vias.forEach(v => {
        v.offset += level_offsets[v.level];
    });
    
    // Apply offsets to arrows
    layout.arrows.forEach(a => {
        a.from_offset += level_offsets[a.from_level];
        a.to_offset += level_offsets[a.to_level];
    });
}
const node_base_height = 1;
const node_initial_offset = 7;

function node_extra_height(nd: DialogNode) {
    return (nd.picture?1:0)+(nd.description?0.5:0);
}


function node_height(nd: DialogNode) {
    return node_base_height + nd.branches.length+node_extra_height(nd);
}

function create_layout2(story: DialogStory, positions:number[] = []) : Layout{
    const nodes: NodeLayout = [];
    const vias: ViaList = [];
    const arrows: Arrows = [];
    const alloc: number[] = [];
    const refs: Record<number, Node> = {};
    const tree = DAG_to_tree(story.nodes,0,[0]);
    const level_map = tree_to_LevelMap(tree);
    

    const queue:(Node|Via)[] = [];    

    function add_node(nd: number, level: number, pos: number) {
        if (pos < positions[nodes.length]) pos = positions[nodes.length];
        const cur_offset = Math.max(alloc[level] || 0, pos);
        const node = story.nodes[nd];
        const height = node_height(node);
        alloc[level] = cur_offset+height+1;
        const def :Node = {height,level,node_id:nd,offset:cur_offset, bofs:node_extra_height(node)};
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

    function add_route(cur_level:number, target: number, offset:number, bofs: number, from_via: boolean) {
        const tlevel = level_map[target];
        const toffset = from_via?offset:(offset-2-bofs);
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
                    backside:false,
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
                    backside: false,
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
                            backside:true,
                            from_via                            
                        });                        
                    } else if (from_via) {
                        let h = add_via(cur_level-1, target, offset);
                        arrows.push({
                            from_level : cur_level-1,
                            from_offset : h,
                            to_level : cur_level,
                            to_offset : offset,
                            head: false,
                            backside:false,
                            from_via,
                            backward: true,
                        });
                    } else {
                        let h = add_via(cur_level, target, toffset);
                        arrows.push({
                            from_level : cur_level,
                            from_offset : offset,
                            to_level : cur_level,
                            to_offset : h,
                            head: false,
                            backside:true,
                            from_via,                            
                        });
                    }
                }
            }
        }
    }

    add_node(0, level_map[0], 0);

      
    while (queue.length) {
        const cur = queue.shift()!;
        const selected_node = cur as Node;
        const cur_via = cur as Via;
        if (selected_node && selected_node.height !== undefined) {
            const cur_level = level_map[selected_node.node_id];    
            const node = story.nodes[selected_node.node_id];
            if (node.node_type == DlgNodeType.standard) {
                node.branches.forEach((b,idx)=>{
                    const offset = selected_node.offset+node_base_height+idx+selected_node.bofs;
                    if (b.target !== null && b.target !== undefined) {
                        add_route(cur_level, b.target, offset, selected_node.bofs, false);
                    }
                });
            }
        } else  if (cur_via && cur_via.target_node !== undefined) {
            add_route(cur_via.level, cur_via.target_node, cur_via.offset, 0, true);
        }    
    }

    const unused = Object.fromEntries(Object.keys(story.nodes).map(x=>[x,true]));
    for (const k in level_map) delete unused[k];
    const cnt_levels = alloc.length;

    let rmp1 : Record<number, number> = {};
    let rmp2 : Record<number, number> = {};
    for (let idx = 0; idx < cnt_levels;++idx) {

        arrows.forEach(a=>{
            if (a.backward && a.from_level == idx) {
                if (rmp1[a.from_offset] !== undefined) {
                    a.from_offset = rmp1[a.from_offset];
                }
                rmp2[a.to_offset] = a.from_offset;
                a.to_offset = a.from_offset;
            } else if (a.backside && !a.head) {
                if (rmp1[a.to_offset] !== undefined) {
                    a.to_offset = rmp1[a.to_offset];
                }
            }
        });
        vias.forEach(v=>{
            if (v.level == idx+1 && rmp2[v.offset] !== undefined)  {
                v.offset = rmp2[v.offset]
            }
        })
        rmp1 = rmp2;
        rmp2 = {};
    }


    const fl : Layout = {nodes,vias,arrows, unused};

    return fl;
}

function create_layout(story: DialogStory) {
    const layout = create_layout2(story);

        // Find max offset for each level
    const level_max_offsets: number[] = [];
    
    layout.nodes.forEach(n => {
        const max = Math.max(level_max_offsets[n.level] ?? 0, n.offset + n.height);
        level_max_offsets[n.level] = max;
    });
    
/*    layout.vias.forEach(v => {
        const max = Math.max(level_max_offsets[v.level] ?? 0, v.offset + 1);
        level_max_offsets[v.level] = max;
    });*/
    
    // Find global max to center around
    const global_max = Math.max(...level_max_offsets);
    const positions = layout.nodes.map(x=>x.level<2?node_initial_offset:
        ((x.offset+x.height/2) * global_max/(level_max_offsets[x.level]))-x.height);

    const mults = level_max_offsets.map(x=>x?global_max/x:1);

    return create_layout2(story,positions);
}

const diagram = ref<Layout>();

watch(cur_story, ()=>{
    if (cur_story.value) {
        diagram.value = create_layout(cur_story.value);
    }
},{deep:true})

watch(current_index, ()=>{
    let s = current_index.value;
    if (s !== null) {
        if (dialogs._compat) s = s * 128;
    }
    StatusBar.set_current_dialog(s);
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
    

    const xf = a.backside && a.from_via?x_coord(a.from_level):x_arrow_right(a.from_level);
    const xt = a.backside && !a.from_via?x_arrow_right(a.to_level):x_coord(a.to_level);
    const yf = y_arrow(a.from_offset);
    const yt = y_arrow(a.to_offset)
    const xtp = xt + (a.head?5*(a.backside&& !a.from_via?1:-1):0);
    const xfp = xf - (a.from_via?5:0);
    const m = (grid_x-grid_width)/1.5+Math.abs(yt-yf)*0.1;
    const xfc = a.backside && a.from_via?xf-m:xf+m
    const xtc = a.backside && !a.from_via?xt+m:xt-m;
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


function add_branch() {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined) return null;
    const d = dialogs._dlg[f.dlg];
    const n = d.nodes[f.node];
    const b = DialogManager.new_branch();
    b.target = null;
    if (n.branches.length) {
        const tmpl = n.branches[n.branches.length-1];
        b.type = tmpl.type;
        if (tmpl.speaker_icon) {
            b.speaker_icon = tmpl.speaker_icon;         
        }
        b.speaker = tmpl.speaker;        
    } else {
        b.speaker_icon = speaker_default_state;
    }
    n.branches.push(b);
    edit_focus.value.branch =  n.branches.length-1;
    return b;
}
function add_node_branch() {
    const f = edit_focus.value;
    if (f.node === undefined || f.dlg === undefined || f.branch === undefined) return null;
    const d = dialogs._dlg[f.dlg];
    const n = d.nodes[f.node];
    const nn = DialogManager.create_node(d);
    const b = n.branches[f.branch];
    b.target = nn[0];
    if (n.animate_desc) nn[1].animate_desc=true;
    f.node = b.target;
    delete edit_focus.value.branch;    
    return b;
}

function add_reaction_node() {
    const pb = add_node_branch();
    if (!pb) return;
    const nb = add_branch();
    if (!nb) return;
    if (pb.type == DialogBranchType.choice||pb.type == DialogBranchType.selchar||pb.type == DialogBranchType.seldead) nb.type = DialogBranchType.npctalk;
    else if (pb.type == DialogBranchType.npctalk) {
        nb.type = DialogBranchType.choice;
        nb.speaker_icon = speaker_default_state;
    }
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
        b.splice(f.branch,1);        
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
            selected_condition.value = {name:"",content:{ast:null,source:""}};
        } else {
            selected_condition.value = {name:s, content:cur_story.value.conditions[s]};
        }
    }
}

function save_condition() {
    const sc = selected_condition.value;
    const st = cur_story.value;
    const sb = selected_branch.value;
    if (!sc || !st) return;
    if (!sc.name) sc.name = sc.content.source;
    st.conditions[sc.name] = sc.content;
    if (sb) {
        sb.condition = sc.name;
    }
    selected_condition.value = null;
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

const showFactDlg = ref(false);
const showConstDlg = ref(false);
const code_editor_el = ref<InstanceType<typeof DlgCodeEditor> | null>(null);

function insert_const(s:string) {
    if (code_editor_el.value) {
        code_editor_el.value.paste_str(s);
    }
}


const isEditingCode = ref(false);

function focus_loc(story?: number, node?: number) {
    if (story === undefined || node === undefined) return;
    current_index.value = story;
    setTimeout(()=>{
        edit_focus.value.node = node;
        edit_focus.value.dlg = story;
    }, 10);
}

const can_delete_condition = computed(()=>{
    const st = cur_story.value;
    const sc = selected_condition.value;    
    if (!st || !sc || !st.conditions[sc.name]) return false;
    for (const a in st.nodes) {
        const n = st.nodes[a];
        for (const b in n.branches) {
            const bv = n.branches[b];           
            if (toRaw(bv) != toRaw(selected_branch.value) && bv.condition == sc.name) return false;
        }
    }    
    return true;
})

async function delete_condition() {
    const sc = selected_condition.value;    
    const st = cur_story.value;
    if (!st || !sc || !st.conditions[sc.name]) return;
    if (await messageBoxConfirm(`Confirm you want to remove the condition ${sc.name}`)) {
        delete st.conditions[sc.name];
        if (selected_branch.value) {
            selected_branch.value.condition = "";
        }
        selected_condition.value = null;
    }
}

const book_reference = computed({
    get() {
        const txt = selected_branch.value?.text ?? "";
        if (txt.startsWith("&REF:")) {
            return txt.split("\n")[0].substring(5);
        } else {
            return "";
        }
    },
    set(x: string) {
        if (!selected_branch.value) return;
        const nonref_text = book_content.value;
        if (x.length) {
            selected_branch.value.text =`&REF:${x}\n`+nonref_text;
        } else{
            selected_branch.value.text = nonref_text;
        }
    }
})

const book_content = computed({
    get() {
        const txt = selected_branch.value?.text ?? "";
        if (txt.startsWith("&REF:")) {
            return txt.split("\n").slice(1).join("\n");
        } else {
            return txt;
        }
    },
    set(x:string) {
        const ref = book_reference.value;
        if (!selected_branch.value) return;
        selected_branch.value.text = x;
        book_reference.value = ref;
    }
})

const selected_node_map=computed(()=>{
    let nfo = selected_node.value?.load_map_info;
    if (!nfo) {
        nfo = {map_name:"",sector:0,side:0};
        selected_node.value!.load_map_info = nfo;
    }
    return nfo;
})

async function loadAllMaps() {
    return (await server.getDDLFiles(AssetGroup.MAPS)).files.map(x=>x.name).filter(x=>x.toUpperCase().endsWith(".MAP"))
        .map(x=>({value: x}));
}
function loadAllDirections() {
    return directions.map((x,idx)=>({value:idx,label:x}));
}

const node_type_icon = [
    null,"⚔","🛒","✉","🕮","🧭"
] as const;

</script>
<template>
<x-workspace :hidden="!active">
    <div class="left" >
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
        <div class="node-list">            
            <select  v-model="edit_focus.node" size="2" @change="edit_focus.branch = undefined;edit_focus.dlg = current_index ?? 0">
                <option v-for="(n, id) of cur_story?.nodes " :key="id" :value="id" :class="{unused: diagram!.unused[id]}"> #{{ id }} {{ n.name }} </option>
            </select>
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
                    :href="getImageHref(cur_story.picture)" :key="cur_story.picture"/>
            </g>

            <path v-for="n of diagram.arrows" :d="calc_arrow(n)" class="arrow" :marker-end="n.head?'url(#arrow_4d4e7fe4a)':undefined"></path>
            <line v-for="n of diagram.vias" :x1="x_coord(n.level)" class="via" :y1="y_arrow(n.offset)" :x2="x_arrow_right(n.level)" :y2="y_arrow(n.offset)" />
            <template v-for="n of diagram.nodes" :key="n.node_id">
                <g :transform="`translate(${x_coord(n.level)},${y_coord(n.offset)})`">
                    <g class="node" :class="{final: cur_story.nodes[n.node_id].branches.length == 0, selected: edit_focus.node == n.node_id && edit_focus.branch === undefined}" @click="edit_focus={dlg:current_index, node:n.node_id}">
                        <rect  rcx="10" ry="10" x="0" y="0" :width="x_width()" :height="y_height(n.height)" />
                        <text class="title" x="5" :y="grid_y/2" v-svg-ellipsis="grid_width-5" :key=" cur_story.nodes[n.node_id].name"> #{{ n.node_id }} {{ cur_story.nodes[n.node_id].name }}</text>
                        <text v-if="node_type_icon[cur_story.nodes[n.node_id].node_type]" class="icon" :x="x_width()-5" :y="y_height(1)-10" >{{node_type_icon[cur_story.nodes[n.node_id].node_type]}}</text>
                        <text v-if="cur_story.nodes[n.node_id].description" class="desc" x="5" :y="grid_y" v-svg-ellipsis="grid_width-5" :key=" cur_story.nodes[n.node_id].description">{{ cur_story.nodes[n.node_id].description }}</text>
                        <image v-if="cur_story.nodes[n.node_id].picture" class="desc" x="0" :y="(cur_story.nodes[n.node_id].description?1.3:0.8)*grid_y" :key=" cur_story.nodes[n.node_id].picture"
                            :href="getImageHref(cur_story.nodes[n.node_id].picture!)" :width="x_width()" :height="y_coord(1)"></image>

                    </g>
                    <g v-for="(b,idx) of cur_story.nodes[n.node_id].branches" :class="branch_class(b.type, b.target === null, edit_focus.node === n.node_id?idx:-1)"                        
                        :transform="`translate(0,${y_coord(node_base_height+n.bofs+idx)})`"
                        @click="edit_focus={dlg:current_index,node:n.node_id,branch:idx}" :key="idx">
                        <rect x="0" y="0" :width="x_width()" :height="y_coord(1)"  />
                        <text v-if="b.type==DialogBranchType.jump_to_node" :x="grid_width/2" :y="grid_y/2">(jump)</text>
                        <text v-else class="text" v-svg-ellipsis="grid_width-5" x="5" :y="grid_y/2" :title="b.text" :key="b.text">{{ b.text }}</text>
                        <text class="cond" v-if="b.condition" :key="b.condition" :x="grid_width-2" :y="grid_y-2">{{ b.invert_condition?"NOT":"" }} {{ b.condition }}</text>
                    </g>
                </g>
            </template>            
        </svg>
        </div>
        <div class="editor" v-if="cur_story">
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
                        <div class="label"><span>Node type</span><div class="more h"><select v-model.number="selected_node.node_type">
                            <option :value="DlgNodeType.standard">Branching</option>
                            <option :value="DlgNodeType.battle">Battle</option>
                            <option :value="DlgNodeType.shopping">Shopping</option>
                            <option :value="DlgNodeType.message">Exit with message</option>
                            <option :value="DlgNodeType.openbook">Open book</option>
                            <option :value="DlgNodeType.loadmap">Load map</option>
                        </select>
                         <DelayLoadedList v-if="selected_node.node_type == DlgNodeType.shopping" v-model="selected_node.shop_id" 
                            :list="getGlobalShops().then(x=>x.map(y=>({value:y[0],label:y[1]})))" />                         
                         <button @click="add_branch" v-if="!selected_node.node_type">Add Branch</button>
                         <button @click="delete_node">Delete node</button>                                
                        </div></div>
                        <label><span>Name (not visible)</span><input type="text" v-model="selected_node.name"></label>                        
                        <label><span>Action (code)</span><DlgCodeEditor ref="code_editor_el" class="code_edit" v-model="selected_node.action" @focus="isEditingCode=true" @blur="isEditingCode=false"/></label>
                        <template v-if="selected_node.node_type == DlgNodeType.standard">
                        <div class="label">
                            <span>Description (optional, visible, <ToggleButton v-model="selected_node.animate_desc">animated</ToggleButton>)</span>
                            <textarea type="text" rows="4" v-model="selected_node.description"></textarea>
                        </div>
                        <label>
                            <span>Picture (optional, visible)</span>
                            <input type="text"  v-model="selected_node.picture" :list="image_list.id">
                        </label>                               
                        </template>
                        <label v-if="selected_node.node_type == DlgNodeType.message">
                            <span>Message</span>
                            <input type="text" v-model="selected_node.message" />
                        </label>
                        <template v-if="selected_node.node_type == DlgNodeType.loadmap">
                            <label>
                                <span>Map file</span>
                                <DelayLoadedList v-model="selected_node_map.map_name" :list="loadAllMaps()"></DelayLoadedList>
                            </label>
                            <label>
                                <span>Sector number</span>
                                <input type="number" v-model="selected_node_map.sector">
                            </label>
                            <label>
                                <span>Direction</span>
                                <DelayLoadedList  v-model="selected_node_map.side" :list="loadAllDirections()"></DelayLoadedList>
                            </label>
                            
                        </template>
                    </x-form>
                </x-section>
            </template>
            <template v-else-if="selected_condition">
                <x-section>
                    <x-section-title>Edit condition: {{ selected_condition.name }}</x-section-title>
                    <x-form>                        
                        <label><span>Name</span><input type="text" v-model="selected_condition.name"></label>
                        <div class="note">Change name doesn't rename, it creates copy</div>
                        <label><span>Code</span><DlgCodeEditor ref="code_editor_el" class="code_edit" v-model="selected_condition.content" @focus="isEditingCode=true" @blur="isEditingCode=false"/></label>
                        <div class="label"><span>NOTE: A change is applied everywhere the modified condition is used in the current story</span>
                            <div class="more">
                                <button @click="save_condition">Save & Apply</button>
                                <button @click="selected_condition = null">Cancel</button>
                                <button @click="delete_condition" :disabled="!can_delete_condition">Delete</button>
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
                            <option :value="5">Add to story log</option>
                            <option :value="6">Add to book (direct)</option>
                        </select></label>
                        <div class="label" v-if="selected_branch.type != 0"><span>Speaker</span><div class="more">
                            <select v-model.number="selected_branch.speaker">
                                <option :value="0">(not set)</option>                                
                                <option v-for="(v,idx) in cur_story.speakers" :value="idx+1" :key="idx"> {{ v.name }} </option>
                            </select>                            
                            <button @click="edit_speakers">Edit speakers</button>
                            <template  v-if="selected_branch.type == 2"">
                                <input type="checkbox" v-model="selected_branch.speaker_icon" @click="set_default_speaker"><span>Show speaker's icon</span>
                            </template>                            
                        </div></div>
                        <label v-if="selected_branch.type == DialogBranchType.addtobook">
                            <span>Page reference (optional)</span>
                            <input type="text" v-model="book_reference">
                        </label>
                        <label v-if="selected_branch.type != 0">
                                <span class="text-help">Text<span>
                                [he,she] - choosen by speaker gender<br/>
                                %n - replace by speaker name<br/>
                                %[ , %] - replaced by [,  ]</span></span>
                                <textarea v-if="selected_branch.type==DialogBranchType.addtobook" rows="4" v-model="book_content"></textarea>
                                <textarea v-else rows="5" v-model="selected_branch.text"></textarea>
                        </label>
                        <div class="label"><span>Target</span>
                            <div class="more">
                                <select v-model.number="selected_branch.target">
                                    <option v-for="(v,k) in cur_story.nodes" :key="k" :value="k" :class="{unused: diagram!.unused[k]}">
                                        #{{ k }} {{ v.name }}
                                    </option>
                                </select>                            
                            <button :disabled="selected_branch.target === null" @click="selected_branch.target = null">Exit dialog</button>
                            <button :disabled="selected_branch.target !== null" @click="add_node_branch">Add node</button>
                            <button :disabled="selected_branch.target !== null" 
                                v-if="selected_branch.type != DialogBranchType.addstory && selected_branch.type != DialogBranchType.jump_to_node"
                                @click="add_reaction_node">Add reaction</button>
                            
                            </div>
                        </div>
                        <div class="label"><span>Condition</span>
                            <div class="more">
                                <select v-model="selected_branch.condition">
                                    <option value="">(none)</option>
                                    <option value="first visited">First visited (this node)</option>
                                    <option value="whole group">Whole group</option>
                                    <option value="is present">Speaker is present</option>
                                    <option value="target not visited yet">Target not visited yet</option>
                                    <option value="no choices">No active choices</option>
                                    <option v-for="(v,k) of cur_story.conditions" :key="k" :value="k">{{ k }}</option>
                                </select>
                                <ToggleButton v-model="selected_branch.invert_condition">Invert</ToggleButton>
                                <button :disabled="!selected_branch.condition || !cur_story.conditions[selected_branch.condition]" @click="edit_condition(selected_branch.condition || '')">Edit</button>
                                <button @click="edit_condition('')">Add</button>                                
                            </div>
                        </div>
                    </x-form>
                </x-section>
            </template>
            <template v-else>
                <x-section>
                    <x-section-title>Nothing selected</x-section-title>
                </x-section>
            </template>
            <x-section v-if="(code_editor_el && !compile_report.is_error) || isEditingCode">
                <x-section-title>Constants</x-section-title>
                <div class="list">
                    <input type="search" v-model="constant_filter">
                    <div class="tbl">
                        <table class="consts">
                            <tbody>
                                <tr v-for="v of constant_filtered_list" :key="v[0]" :class="{fact: v[3], const:!v[3]}" @click="insert_const(v[0])">
                                    <td> {{  v[0] }}</td>
                                    <td> {{  v[1] }}</td>
                                    <td> {{  v[2] }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="buttons">
                        <button @click="showConstDlg = true">Edit constants</button>
                        <button @click="showFactDlg = true">Edit facts</button>
                    </div>                    
                </div>
            </x-section>            
            <x-section v-else class="cstat">
                <x-section-title>Compile status</x-section-title>
                <div v-if="compile_report.is_error" class="error" @click="focus_loc(compile_report.error_location![0], compile_report.error_location![1])">
                    <div><div>Status</div>
                    <div>ERROR</div></div>
                    <div><div>Message</div>
                    <div :class="{haveloc: !!compile_report.error_location}"> {{ compile_report.error_message }}</div></div>
                </div>
                <div v-else class="success">
                    <div><div>Status</div>
                    <div>Success</div></div>
                    <div><div>Count stories</div>
                    <div> {{ compile_report.stories }} / {{ dialogs._compat?127:32767 }} </div></div>
                    <div><div>Count nodes</div>
                    <div> {{ compile_report.nodes }} / {{ 32767 }}</div></div>
                    <div><div>Count instructions</div>
                    <div> {{ compile_report.instructions }}</div></div>
                    <div><div>Count variables</div>
                    <div> {{ compile_report.variables }} / {{ MAX_IDENTIFIERS }}</div></div>
                    <div v-if="compile_report.not_referenced?.length"><div class="warning">Warnings</div>
                    <div><div v-for="v of compile_report.not_referenced" class="warning haveloc" @click="focus_loc(v[1],v[2])" >
                        Unused variable: {{ v[0] }}
                    </div></div></div>
                </div>                
            </x-section>
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
    <dialog v-if="showFactDlg" :ref="el=>el?(el as HTMLDialogElement).showModal():null">
        <header>Edit facts<button @click="showFactDlg=false" class="close"></button></header>
        <div style="max-height: 50vh;overflow: hidden auto ;"><FactEditor/></div>
    </dialog>
    <dialog v-if="showConstDlg" :ref="el=>el?(el as HTMLDialogElement).showModal():null">
        <header>Edit consts<button @click="showConstDlg=false" class="close"></button></header>
        <div><DlgConstsEditor v-model="dialogs._consts"/></div>
    </dialog>


</x-workspace>

</template>
<style lang="css" scoped>
x-workspace {
    display: flex;    
    overflow: hidden;

}
.left {
    width: 15rem;
    display:flex;
    flex-direction: column;
    
}
.list {
    display:flex;
    flex-direction: column;
    flex-grow: 1;
    height: 100%;
}
.list input {
    height: 2rem;
}
.list select {
    flex-grow: 1;
    height: 100%;    
}
.list .tbl {
    flex-grow: 1;
    height: 100%;    
    overflow-y: auto;
    overflow-x: hidden;
}
.list .tbl table {
    width: 100%;
    border-collapse: collapse;    
    background-color: white;    
}
.list .tbl table td {
    border: 1px dotted;
    cursor: pointer;
}
.list .tbl table tr:hover td {
    background-color: #ccf;
}
.list .buttons {
    height: 2rem;
    display: flex;    
}
.list .buttons>* {
    flex-grow: 1;
}
.node-list {
    height: 20rem;
}
.node-list > select{
    height:100%;
    width: 100%;  
}

.main-panel {
    overflow: auto;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    
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
.choice.addstory rect {
    fill: #dd8;
}
.choice.addstory text {
    font-style: italic;
    fill: #444;
}
.choice.addtobook rect {
    fill: rgb(232, 187, 187);
}
.choice.bottext text {
    font-style: italic;
    fill: #5b3c1c;
}

.node text.icon  {
    text-anchor: end;
    font-size: 2rem;
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
    height: 20rem;

}
.editor > *:first-child{
    flex-grow: 1;
}
.editor > *:last-child{
    width: 30%;
}

.editor x-section-title {
    background-color: #ddd;
}
.code_edit {
    text-align: left;
    background-color: white;
    height: 6rem;
    border: 1px solid;
}
.diagram {
    flex-grow: 1;
    flex-shrink: 1;
    width: 100%;
    overflow: auto;
}
div.label div.more {
    display:flex;
    gap: 0.2rem;
}
div.label div.more.r {
    justify-content: end;
}
div.label div.more.h > *:first-child{
    flex-grow: 1;
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
.consts .fact {
    color: brown;
}
dialog input[type=number] {width:5rem;text-align: center;}

table.consts td:nth-child(3) {
    white-space: nowrap;
}

.cstat > div > div {
    display:flex;
}
.cstat > div > div > div:first-child::after {
    content: ":";
}
.cstat > div > div > div:first-child {
    width: 9rem;
    flex-shrink: 0;
}


.cstat .error {
    padding: 1rem;
    color: rgb(174, 82, 82);
    font-size: 1.2rem;
}
.cstat .success {
    padding: 1rem;
    color: green;    
}
.cstat .success > div > div:last-child {
    font-size: 1.2rem;
}

.cstat .success .warning {
    color: rgb(158, 85, 36);
}

.haveloc {
    cursor: pointer;
    text-decoration: underline;
}

</style>