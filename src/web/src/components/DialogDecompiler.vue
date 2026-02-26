<script lang="ts" setup>
import { server } from '@/core/api';
import { DialogDef, type Instruction } from '@/core/dialog_structs';
import { SVGPath } from '@/utils/svg';
import { watch } from 'vue';
import { computed, onMounted, ref } from 'vue';


const node_map = ref<Record<number,any> >({});
const cur_node_idx = ref<number>(-1);
const history = ref<number[]>([]);
const cur_node = computed(()=>{
    const x = node_map.value[cur_node_idx.value];
    if (!x) return null;
    return x;
});

watch(cur_node_idx,(nw)=>{
    history.value.push(nw);
})

async function load_dlg() {
    const data = await server.getDDLFile("DIALOGY.DAT");
    const dd = new DialogDef();
    dd.load_from_buffer(data);
    node_map.value = dd.toObject();
}

function y_coord(v:number) {
    return v*20;
}

function get_target_node(v: [string, Instruction[]]) {
    const code = v[0];
    if (code == "add_choice" 
       || code == "goto_node" 
       || code  == "goto_node_iff" 
       || code == "goto_node_not_iff") {
            return v[1][0].value || null;
       }
    if (code == "add_choice_iff") {
            return v[1][1].value || null;
    }
    return null;
}

function get_jump_offset(v: [string, Instruction[]]) {
    const code = v[0];
    if (code == "jump_not_iff" || code == "jump_iff" || code == "jump") {
        return v[1][0]?.value || null;
    } else {
        return null;
    }
}

function get_instruction_text(v: [string, Instruction[]]) {
    if (!v || !v.length) return "<empty>";
    const code = v[0];
    const args = v[1];

    const out :string[] = []
    out.push(code);
    args.forEach(x=>{
        if ("value" in x) out.push(`${x.value}`);
        else if ("variable" in x) out.push(`[${x.variable}]`);
        else if (x.pop) out.push("POP");
        else if ("text" in x) out.push(`'${x.text}'`);
    })
    return out.join(" ");
}

function goto_node(n: [string, Instruction[]]) {
    const tn = get_target_node(n);
    if (tn !== null) {
        cur_node_idx.value = tn;
    }
}

function jump_back() {
    const h = history.value;
    if (h.length >= 2) {
        h.pop();
        cur_node_idx.value = h.pop()!;        
    }
}

const x_offset = 100;
const is_copied = ref(-1);

function calc_arrow(from:number, to:number) : string {
 

    const path = new SVGPath();
    const h = y_coord(0.2);
    const yf =  0;
    const yt = y_coord(to) -  y_coord(from) - h;
    path.mt(-5, yf)
        .bct(-50,yf,-50,yt,-10,yt)        
        .hr(5)
    return path.get_path_data();
    
}

function contains_text(n:[string, Instruction[]]) {
    const s = n[1].find(x=>!!x.text);
    return !!s;
}
async function copy_to_clip(n:[string, Instruction[]], idx: number) {
    const txt = n[1].filter(x=>"text" in x).map(x=>x.text).join(",")
    await navigator.clipboard.writeText(txt);
    is_copied.value = idx;
    setTimeout(()=>is_copied.value = -1,1500);
}

onMounted(load_dlg);

</script>
<template>
<x-workspace>
<x-section>
    <x-section-title>Dialog decompiler</x-section-title>
    <div class="panel">
        <button :disabled="history.length < 2" @click="jump_back">  Back </button>
        <div>Shown node</div>
        <select v-model.number="cur_node_idx">
            <option v-for="(c, idx) of node_map" :key="idx" :value="idx"># {{ idx }} ({{ c.length }} instructions)</option>
        </select>
    </div>
</x-section>
<svg v-if="cur_node" v-autosvgsize padding="40">
        <defs>
            <marker id="arrow_945620" markerWidth="8" markerHeight="8" 
            refX="8" refY="4" orient="auto">
                <polygon points="0 0, 8 4, 0 8" />
            </marker>
         </defs>

    <g v-for="(n, idx) of cur_node" :key="idx" :transform="`translate(${x_offset},${y_coord(idx as number)})`">
        <text x="0" y="0" :class="{link: get_target_node(n) !== null}"
        @click="goto_node(n)" >{{ get_instruction_text(n) }}</text>
        <path class="arrow" v-if="get_jump_offset(n) !== null" :d="calc_arrow(idx as number, get_jump_offset(n) ?? 0)" marker-end="url(#arrow_945620)"></path>
        <rect v-if="contains_text(n)" x="-20" y="-14" width="18" height="18" :class="{copy:true, copied: is_copied == idx}" @click="copy_to_clip(n,idx as number)"></rect>
    </g>
</svg>

</x-workspace>
</template>
<style lang="css" scoped>
text.link {
    text-decoration: underline;
    cursor: pointer;
    fill: blue;
}
.panel {
    display: flex;
    gap: 1rem;
    align-items: center;
}
path.arrow {
    fill:none;
    stroke: brown
}
rect.copy {
    fill: #888;    
    cursor: pointer;
}
rect.copy.copied { 
    fill: #8F8;
}
</style>