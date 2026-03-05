<script lang="ts" setup>
import Hive from '@/utils/hive';
import { computed, ref, watch } from 'vue';
import { onMounted, reactive } from 'vue';


interface BookRecord {
    text: string;
    ref: string;
};

const emit = defineEmits<{
  (e: 'change'): void;
}>()

const refPrefix = "&REF:";


class BookHive extends Hive<BookRecord> {

};

const model = defineModel<string>();
const section = /^\[([0-9]+)w?\]$/;
const hive = reactive(new BookHive);
const current_index = ref(-1);
const current = computed(()=>{
    const c = hive.get(current_index.value);
    return c?c:null;
});

function parseBook() {
    const txt = model.value;
    hive.clear();
    if (txt) {
        const lines =txt.split("\n").map(x=>x.trim());
        let idx = lines.findIndex(x=>!!x.match(section));
        while (idx != -1) {
            if (idx) lines.splice(0, idx);
            const mark = lines[0].match(section);
            if (mark && mark[1]) {
                const id = parseInt(mark[1]);
                lines.shift();
                const cpy : string[] =[];
                while (lines.length && lines[0] != "[]") {
                    cpy.push(lines.shift() ?? "");
                }
                let topic:string = "";
                if (cpy.length && cpy[0].startsWith(refPrefix)) {
                    topic = cpy[0].substring(refPrefix.length);
                    cpy.shift();
                }
                hive.set(id, {text:cpy.join("\n"),ref: topic});                
            } else {
                lines.shift();
            }
            idx = lines.findIndex(x=>!!x.match(section));
        }
    }
    hive.set_first_free(1);
}

function buildBook() {
    const out : string[] = [];
    hive.forEach((v,idx)=>{
        out.push(`[${idx}]`);
        if (v.ref) out.push(`${refPrefix}${v.ref}`);
        out.push(v.text);
        out.push("[]");
        out.push("");
    });
    model.value = out.join("\n");
    emit("change");
}

onMounted(parseBook);
watch(model,parseBook);

let tm : number| NodeJS.Timeout | null = null;
function update_book_delayed() {
    if (tm) clearTimeout(tm);
    tm = setTimeout(buildBook, 2000);
}

const quest_view = computed(()=>{
    const out: Record<string, number[]> = {};
    hive.forEach((v,idx)=>{
        const t = v.ref?v.ref:"(no reference)";
        let l = out[t];
        if (!l) out[t] = l = [];
        l.push(idx);
    });
    return out;
})

function add_text() {
    current_index.value = hive.add({text:"",ref:current.value?current.value.ref:""});    
    buildBook();
}

function del_text() {
    hive.remove(current_index.value);
    buildBook();
}

function keycontrol(ev: KeyboardEvent) {
    const lst : number[] = [];
    Object.entries(quest_view.value).forEach(x=>{
        x[1].forEach(n=>lst.push(n));
    })
    const idx = lst.indexOf(current_index.value);
    if (ev.key == "ArrowDown") {
        if (idx < lst.length-1) current_index.value = lst[idx+1];
    }
    else if (ev.key == "ArrowUp") {
        if (idx > 0) current_index.value = lst[idx-1];
        
    }

}

</script>



<template>
<x-workspace>
    <div class="left">
        <div class="index" tabindex="0" @keydown="keycontrol">
            <div v-for="(lst, q) of quest_view" :key="q">
                <div class="q">{{ q }}</div>
                <div class="l" v-for="n of lst" :keyt="n" :class="{selected: n == current_index}" @click="current_index = n">
                    <div><span> #{{ n }}</span><span>{{ hive.get(n).text.replace("\n"," ").substring(0,100) }}</span></div>
                </div>
            </div>
        </div>  
        <div class="panel">
            <button @click="add_text" >Add</button>
            <button @click="del_text" :disabled="!hive.get(current_index)">Delete</button>
        </div>
    </div>
    <div class="editor">
        <template v-if="current">
            <div class="hdr">
                <div>Document reference ID (not visible)</div>
                <input  type="text" v-model="current.ref" @input="update_book_delayed" @change="buildBook">
            </div>
            <textarea v-model="current.text" @input="update_book_delayed"  @change="buildBook"></textarea>
        </template>        
    </div>

</x-workspace>
 
</template>
<style lang="css" scoped>
x-workspace {
    display: flex;
}
x-workspace>div {
    height: 100%;
    overflow: auto;;
}
x-workspace>div:first-child {
    width: 15rem;
    flex-shrink: 0;
}
x-workspace>div:last-child {
    flex-grow: 1;
}
.index {
    text-align: left;
    border: 1px solid;
    background-color: white;
    padding: 0.5rem;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-grow: 1;
}
.index .q {
    font-weight: bold;
    padding: 0.1rem 0;
}
.index .l {
    cursor: pointer;
    text-overflow: ellipsis;
    overflow: hidden;
    padding: 0.1rem 0;
}
.index .l div {
    display: flex;
    gap: 0.3rem;
}
.index .l span:first-child {
    width:3rem;
    flex-shrink: 0;
    text-align: right;
}
.left {
    display: flex;
    flex-direction: column;
    height: 100%;
}
.panel {
    display: flex;    
}
.panel > *{
    flex-grow: 1    ;
}
.hdr {
    display:flex;
    align-items: center;
}
.hdr div {
    padding: 0 1rem;
}
.hdr input {
    flex-grow: 1;
}
textarea {
    width: 100%;
    flex-grow: 1;
    box-sizing: border-box;
}
.editor {
    display: flex;
    flex-direction: column;
}
.selected {
    background-color: blue;
    color: white;
}
</style>