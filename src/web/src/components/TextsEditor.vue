<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { keybcs2string, string2keybcs } from '@/core/keybcs2';
import { readFileToArrayBuffer } from '@/core/read_file';
import { MainStringtable } from '@/core/ui_strings';
import { isImportTypeAssertionContainer } from 'typescript';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';


const filename = defineModel<string>();

const line_editor=ref<string[]>();
const text_editor=ref<string>();
const import_enc=ref<boolean>();
const import_file = ref<File>();
const changed = ref<string>();
const strtable_template=ref<string[]>([]);

const textareaRefs = ref<(HTMLTextAreaElement | null)[]>([])

function setTextareaRef(el: HTMLTextAreaElement | null, index: number) {
  textareaRefs.value[index] = el;
}


const emit = defineEmits<{
  (e: 'upload', name: string, p?:Promise<any>): void
}>();


function is_string_table(lines: string[]) {
    return lines.every(line => /^\d+ .+$/.test(line));
}

function extract_stringtable(lines: string[]) : string[] {
    const result: string[] = [];
    for (const line of lines) {
        const match = line.match(/^(\d+)\s+(.+)$/);
        if (match) {
            const idx = parseInt(match[1], 10);
            const text = match[2].replace(/\|/g, '\n');
            result[idx] = text;
        }
    }
    return result;
}


async function load_text() {
    if (changed.value) save_text();
    import_enc.value = false;
    if (filename.value && filename.value.endsWith(".TXT")) {
        try {
            const data = await server.getDDLFile(filename.value);
            const text = keybcs2string(data);
            const lines = text.split("\n").map(x=>x.trim()).filter(x=>x && !x.startsWith(";") && !x.startsWith("-1"));
            changed.value = undefined;

            line_editor.value = undefined;
            text_editor.value = undefined;
            
            if (is_string_table(lines)) {
                line_editor.value = extract_stringtable(lines);
                if (filename.value.toUpperCase() == "POPISY.TXT") {
                    strtable_template.value = MainStringtable;
                } else {
                    strtable_template.value = [];
                }
            } else {
                text_editor.value = text;
            }
            return;


        } 
        catch (e) {
            console.warn("Failed load text: ", e);
        }
    } 
    line_editor.value = undefined;
    text_editor.value = undefined;
    import_enc.value = true;
}

function select_enc_file(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0] && target.files[0].name.toUpperCase().endsWith(".ENC")) {
        import_file.value = target.files[0];
    } else {
        import_file.value = undefined;
    }
}

async function do_import_enc() {
    if (import_file.value) {
        const buffer = await readFileToArrayBuffer(import_file.value);
        const b = new Uint8Array(buffer);
        let last = 0;
        const dec = b.map(x=>{
            last = (last + x) & 0xFF;
            return last;
        })
        const orig_file = import_file.value.name;
        const new_file_name = orig_file.replace(/\.[^/.]+$/, ".TXT");
        await server.putDDLFile(new_file_name, dec.buffer, AssetGroup.MAPS);
        emit("upload", new_file_name,);
        filename.value = new_file_name;
    }
}

async function save_text() {
    if (changed.value) {
        let text_file = "";
        if (line_editor.value) {
            const ln = line_editor.value.map((x,idx)=>`${idx} ${x.replace("\n","|").replace(/\s/," ")}`);
            ln.push("-1");
            ln.push("");
            text_file = ln.join("\n");
        }
        const data = string2keybcs(text_file);
        const p =  server.putDDLFile(changed.value, Uint8Array.from(data).buffer, AssetGroup.MAPS);
        emit("upload", changed.value, p);
        changed.value = undefined;
    }
}

onMounted(load_text);
onUnmounted(save_text);
watch([filename], load_text);

function set_line(event: Event, idx: number) {
    if (line_editor.value) {
        const t = event.target as HTMLInputElement;
        if (t.value && t.value.trim()) {
            line_editor.value[idx] = t.value;
            changed.value = filename.value;
        } else {
            t.value = line_editor.value[idx];
        }
    }
}


const order_lines = computed(()=>{
    if (!line_editor.value) return [];
    if (!strtable_template.value) {
        return line_editor.value.map((ln,idx)=>([idx,idx,ln])).filter(x=>x[2]);
    } else {
        return line_editor.value.map((ln,idx)=>([idx,strtable_template.value[idx] || idx.toString(),ln]))
            .filter(x=>x[2])
            .sort((a,b)=>(a[1] as string).localeCompare(b[1] as string));
    }
})

function getFocusableElements(container = document) : HTMLElement[]{
  return Array.from(
    container.querySelectorAll("textarea")
  ).filter(el => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')) as HTMLElement[];
}
/*
function getCaretPosition(el:any):number|null {
  if ('selectionStart' in el && el.selectionStart === el.selectionEnd) {
    return el.selectionStart; // caret bez výběru
  }
  return null;
}

function setCaretPosition(el: any, pos:number|null) {
    if (pos === null) return;
  if ('setSelectionRange' in el) {
    el.focus();
    el.setSelectionRange(pos, pos);
  }
}
 */
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

</script>



<template>
<div v-if="import_enc" class="import">
    <h2>Import ENC file</h2>
    <x-form>
        <label><span>Source ENC file</span><input type="file" @change="$event=>select_enc_file($event)" /></label>        
        <div class="buttons"><button @click="do_import_enc" :disabled="!import_file">Import ENC</button></div>
    </x-form>
</div>
<div v-if="line_editor">
    <div class="line-editor">
           <template v-for="v of order_lines"> 
            <div>
                <div>{{ v[1] }} /{{ v[0] }}</div><textarea cols="60" rows="1" 
                            :ref="el => setTextareaRef(el as HTMLTextAreaElement, v[0] as number)"
                        v-autoresize @change="$event=>set_line($event, v[0] as number)"
                        @keydown="$event=>cursor_control($event)"
                        :value="v[2]"></textarea>
                        </div>
            </template>
    </div>
</div>
<div v-if="text_editor">
    <textarea class="text-editor" v-model="text_editor">        
    </textarea>
</div>



</template>
<style scoped>
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
    width: 25em;    
}

.line-editor > div > textarea {
    flex-grow: 1;    ;
    border: none;
}

.import {
    width: 30em;
    margin: auto;
    border: 1px solid;
    padding: 1em;
    background-color: white;
}

.import .buttons {
    padding-top: 1em;
    margin-top: 1em;
    border-top: 1px solid;
}

.text-editor {
    position: absolute;
    left:0;
    top:0;
    bottom: 0;
    right: 0;
    border: none;
    box-sizing: border-box;
}

textarea {
    font-size: 1.6vmin;
}

</style>