<script setup lang="ts">
import { MAExecutionLine, MAScript, TMA_GEN } from '@/core/map_structs';
import { onMounted, ref, watch } from 'vue';


const svgEl = ref<SVGSVGElement>();
const cur_script = defineModel<MAScript>();
const emits = defineEmits<['ok','close']>();


class GNode {
    x = 0;
    y = 0;
    item: MAExecutionLine<TMA_GEN> ;

    constructor(item: MAExecutionLine<TMA_GEN>) {
        this.item = item;
    }
}



type GraphNodes = GNode[];

const nodes = ref<GraphNodes>([]);

function placeNodes(nodes: Record<string, MAExecutionLine<TMA_GEN> >,  start: string) : GraphNodes {
    const queue: string[] = [];
    const placed :Record<string, GNode> = {};
    const out : GraphNodes = [];
    const ndmap : GNode[][] = [];
    ndmap[0] = [];

    const stnd =  new GNode(nodes[start]);
    out.push(stnd);
    placed[start] = stnd;
   
    queue.push(start);
    while (queue.length>0) {
        const id = queue.pop();
        const nd = placed[id!];
        const nx = nd.item.next;
        if (nx) {
            if (!placed[nx]) {
                const nnd = new GNode(nodes[nx]);
                let x = nd.x;
                let y = nd.y+1;
                while (ndmap[x] && ndmap[x][y]) ++x;
                if (!ndmap[x]) ndmap[x] = [];
                ndmap[x][y] = nnd;
                placed[nx] = nnd;
                queue.push(nx);
            }
        }
        const jmp = nd.item.jump;
        if (jmp) {
            if (!placed[jmp]) {
                const nnd = new GNode(nodes[jmp]);
                let x= nd.x+1;
                let y = nd.y;
                if (ndmap[x] && ndmap[x][y]) {
                    const nndmp : GNode[]= []
                    nndmp[y] = nnd;
                    ndmap.splice(x,0,nndmp);
                } else if (!ndmap[x]) {
                    const nndmp : GNode[]= []
                    nndmp[y] = nnd;
                    ndmap[x] = nndmp;                    
                } else {
                    ndmap[x][y] = nnd;
                }
                placed[jmp] = nnd;
                queue.push(jmp);                
            }
        }        
    }

    for (let x = 0; x < ndmap.length; ++x) {
        if (ndmap[x]) {
            const m = ndmap[x];
            for (let y = 0; y < m.length;++y) {
                if (m[y]) {
                    m[y].x = x;
                    m[y].y = y;
                }
            }
        }
    }

    return out;
}


function updateNodes() {
    
    if (!cur_script.value) {
        nodes.value = [];
    } else {
        const nds = placeNodes(cur_script.value.flow, cur_script.value.start);
        nodes.value = nds;
    }
    setTimeout(()=>{
      const svg = svgEl.value;
      if (!svg) return;
      const bbox = svg.getBBox() // BBox obsahuje přesné rozměry všech prvků
      svg.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`)
      svg.setAttribute('width', bbox.width.toFixed(0))
      svg.setAttribute('height', bbox.height.toFixed());
    },1)
}


function onModelLoad() {
    updateNodes();
}

watch(cur_script, ()=>{
    onModelLoad();
})

onMounted(()=>{
    onModelLoad();
})

const shape_width=100;
const shape_height=50;
const shape_margin=10;


function generateShapeFor(nd: GNode) : string{
    const x = (shape_width+2*shape_margin)*nd.x + shape_margin;
    const y = (shape_height+2*shape_margin)*nd.y + shape_margin;
    const steps : (string|number)[] = [];
    if (nd.item.jump) {
        steps.push("M",x, y+shape_height/2,
                   "l",shape_width/2, -shape_height/2,
                   "l",shape_width/2, shape_height/2,
                   "l",-shape_width/2, shape_height/2,
                   'Z');
    } else {
        steps.push("M", x, y,
                   "h",  shape_width,
                   "v", shape_height,
                   "h", -shape_height,
                   'Z');
    }
    return steps.map(x=>`${x}`).join(" ");
}

</script>
<template>
    <svg ref="svgEl">
    <template v-for="nd of nodes" :key="nd.item.id">
        <path :d="generateShapeFor(nd)"></path>
    </template>
    </svg>


</template>
<style lang="css" scoped>

</style>