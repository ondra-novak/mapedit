<script setup lang="ts">
import ItemList from '@/components/ItemList.vue';
import type { MapSide, NicheDef } from '@/core/map_structs';
import { preview_wall } from '@/core/wall_builder';
import { ref, watch } from 'vue';


const curNiche = defineModel<NicheDef|null>();
const niche_preview = ref<HTMLElement>();
const niche_pos = ref<HTMLElement>();
const dlg = ref<HTMLDialogElement>();
let drag_start: {x:number, y:number, src_x:number, src_y:number, src_w:number, src_h:number}|null = null;


const props = defineProps<{
    side: MapSide|null
}>();

const emit = defineEmits<{
    (e: 'ok'): void,
    (e: 'cancel'): void,
    (e: 'delete'): void
}>();

async function update_preview() {
    const t = niche_preview.value;
    const s = props.side;
    if (t && s) {
        const canvas = await preview_wall(s);
        t.innerHTML="";
        t.appendChild(canvas);
    }
}

function update_niche_preview() {
    const np = niche_pos.value;
    const cn = curNiche.value;
    if (np && cn) {
        np.style.left = `${cn.xpos-cn.xs/2}px`;
        np.style.bottom = `${cn.ypos}px`;
        np.style.width = `${cn.xs}px`;
        np.style.height = `${cn.ys}px`;
    }
}

function init_niche_preview() {
    const np = niche_pos.value;    
    if (np) {
        np.addEventListener("pointerdown", (ev)=>{
            ev.preventDefault(); 
            if (ev.isPrimary) {
                const cn = curNiche.value;
                if (cn) {
                    drag_start = {x:ev.clientX, y:ev.clientY,
                        src_x:cn.xpos, src_y: cn.ypos, src_w:cn.xs, src_h:cn.ys};
                }
            }
        })
        np.addEventListener("pointermove",(ev)=>{
            ev.preventDefault(); 
            if (ev.isPrimary) {
                if (drag_start && ev.buttons & 1) {
                    const cn = curNiche.value;
                    if (cn) {
                        if (!ev.shiftKey) {
                            cn.xpos = ev.clientX - drag_start.x + drag_start.src_x;
                            cn.ypos = drag_start.y - ev.clientY + drag_start.src_y;
                        } else {
                            cn.xs = Math.abs((ev.clientX - drag_start.x)*2 + drag_start.src_w);
                            cn.ys = Math.abs(drag_start.y - ev.clientY  + drag_start.src_h);
                        }
                    }
                }
            }
        })
        np.addEventListener("pointerup", (ev)=>{
            ev.preventDefault(); 
            if (ev.isPrimary) {
                drag_start = null;
            }
        })
        update_niche_preview();
    }
}

watch(niche_preview,update_preview)
watch(()=>props.side,update_preview);
watch(curNiche,update_niche_preview, {deep:true});
watch(niche_pos,init_niche_preview);
watch(curNiche,()=>{
    if (curNiche.value) {
        dlg.value?.showModal();
    } else {
        dlg.value?.close();
    }
})

</script>

<template>
<dialog ref="dlg">
    <header><span> Edit niche</span>
    <button class="close" @click="emit('cancel')"></button>
    </header>
        <div class="preview">
            <div ref="niche_preview" class="cnv"></div>
            <div ref="niche_pos" class="rc"></div>
        </div>
        <x-section>
            <x-form v-if="curNiche">
            <label><span>Position (X,Y):</span><div><input type="number" v-model="curNiche.xpos"><input type="number" v-model="curNiche.ypos"></div></label>    
            <label><span>Size (width,height):</span><div><input type="number" v-model="curNiche.xs"><input type="number" v-model="curNiche.ys"></div></label>                
            <label class="itms"><span>Items:</span><div><ItemList v-model="curNiche.items"></ItemList></div></label>
            </x-form>
        </x-section>
        <footer>
            <button @click="emit('ok')">OK</button>
            <button @click="curNiche = null">Cancel</button>
            <button class="left" @click="emit('delete')">Delete</button>
        </footer>

</dialog>
</template>

<style lang="css" scoped>
.niche input {
    width: 4rem
}
.niche .itms > div {
    width: 18rem;
}
.niche .itms > div > *{
    justify-content: flex-end;    

}
.preview > .cnv > *{
    position: absolute;
    bottom: 0;
    left: 0;
}
.preview > .cnv {
    inset: 0;
    position: absolute;
}
.preview {
    width: 500px;
    height: 320px;
    position: relative;
    overflow: hidden;
    user-select: none;
}
.preview .rc {
    position: absolute;
    border: 4px ridge #ccc;
    cursor:move ;
}


</style>