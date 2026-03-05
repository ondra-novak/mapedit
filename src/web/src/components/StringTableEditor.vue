<script lang="ts" setup>
import { MainStringtable } from '@/core/ui_strings';
import Hive from '@/utils/hive';
import { computed, nextTick, ref, triggerRef } from 'vue';
import PlaylistEditor from './PlaylistEditor.vue';


const model = defineModel<Hive<string> >();
const props = defineProps<{global_table?:boolean}>();

const textareaRefs = ref<(HTMLTextAreaElement | null)[]>([])

function setTextareaRef(el: HTMLTextAreaElement | null, index: number) {
  textareaRefs.value[index] = el;
}

function set_line(event: Event|string, idx: number) {
    if (model.value) {
        if (typeof event == "string" ) {
            model.value.set(idx, event);
            triggerRef(model);
            emit("change");
        } else {
            const t = event.target as HTMLInputElement;
            if (t.value && t.value.trim()) {
                model.value.set(idx,t.value);
                triggerRef(model);
                emit("change");
            } else {
                t.value = model.value.get(idx);
            }   
        }
    }
}

const emit = defineEmits<{
  (e: 'change'): void;
}>()


const ui_strings = MainStringtable;


function getFocusableElements(container = document) : HTMLElement[]{
  return Array.from(
    container.querySelectorAll("textarea")
  ).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')) as HTMLElement[];
}

function focusNext() {
  const focusable = getFocusableElements();
  const index = focusable.indexOf(document.activeElement as HTMLElement);  
  const next = focusable[index + 1] || focusable[0];  
  next.focus();
}

function focusPrevious() {
  const focusable = getFocusableElements();
  const index = focusable.indexOf(document.activeElement as HTMLElement);
  const prev = focusable[index - 1] || focusable[focusable.length - 1];
  prev.focus();
}


function cursor_control(event: Event) {
    const e = event as KeyboardEvent;
    const target = e.target as HTMLTextAreaElement;
    const caretPos = target.selectionStart;

    if (e.key === "ArrowUp") {
        const nl =  target.value.indexOf("\n");
        if (nl == -1 || nl > caretPos) {
            e.preventDefault();        
            focusPrevious();    
        }
    } else if (e.key === "ArrowDown") {
        const nl =  target.value.lastIndexOf("\n");
        if (nl<  caretPos) {
            e.preventDefault();
            focusNext();
        }
    }
}

function addstring() {
    if (!model.value) model.value = new Hive<string>();
    const id = model.value.add("new string")
    triggerRef(model);
    emit("change");
    setTimeout(()=>{
        const ref = textareaRefs.value[id];
        if (ref) {
            ref.scrollIntoView({behavior:'smooth',block:'center'});
            ref.focus();
        }
    },1);
}


function deletestring(idx: number) {
    if (model.value) {
        model.value.remove(idx);
        triggerRef(model);
        emit("change");
    }
}

const datasrc = computed(()=>{
    const r = (model.value?.get_raw() ?? []).map((x,idx)=>[idx,props.global_table?((ui_strings[idx] ?? 'user')+' #'):"", x])
        .filter(x=>x[2] !== null) as [number,string,string][];
    if (props.global_table) {
        r.sort((a,b)=>a[1].localeCompare(b[1]));
    }
    return r;
});

function is_playlist(s:string|undefined) {
    return s && !!s.match(/^\s*(FORWARD\s+|RANDOM\s+|FIRST\s+)?\s*([^.]+\.(MP3|MUS)\s+)*([^.]+\.(MP3|MUS))\s*$/i);
}

</script>
<template>
    <div class="line-editor" v-if="model">
        <div v-for="[idx, lbl, v] of datasrc" :class="{smaller: !global_table}"> 
                <div>{{ lbl }}{{ idx }}</div>
                <template v-if="is_playlist(v)">
                    <PlaylistEditor :model-value="v" @update:model-value="(val)=>set_line(val ?? '', idx)" />
                </template>
                <template v-else>
                <textarea cols="60" rows="1" 
                            :ref="el => setTextareaRef(el as HTMLTextAreaElement, idx as number)"
                        v-autoresize @change="$event=>set_line($event, idx)"
                        @keydown="$event=>cursor_control($event)"
                        :value="v"></textarea>
                        </template>
                        <button v-if="!global_table || !ui_strings[idx]" @click="deletestring(idx)">x</button>
        </div>
    </div>    
    <div class="add-butt"><button @click="addstring">Add string</button></div>
</template>
<style lang="css" scoped>
.line-editor {
    margin: 1em;
}
.line-editor > div {
    text-align: left;

}
.line-editor > div {
    display: flex;
    gap: 0.5em;
    border-bottom: 2px groove #ccc;
}
.line-editor > div > div {
    width: 28em;    
    flex-shrink: 0;
}

.line-editor > div.smaller > div {
    width: 4em;    
    text-align: right;
}

.line-editor > div > *:nth-child(2){
    flex-grow: 1;
    border: none;
}


</style>