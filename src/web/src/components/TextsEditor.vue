<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { string_from_keybcs2 } from '@/core/keybcs2';
import { readFileToArrayBuffer } from '@/core/read_file';
import { MainStringtable } from '@/core/ui_strings';
import { isImportTypeAssertionContainer } from 'typescript';
import { computed, nextTick, onMounted, ref, watch } from 'vue';


const filename = defineModel<string>();

const line_editor=ref<string[]>();
const text_editor=ref<string>();
const import_enc=ref<boolean>();
const import_file = ref<File>();
const strtable_template=ref<string[]>([]);

const textareaRefs = ref<(HTMLTextAreaElement | null)[]>([])

function setTextareaRef(el: HTMLTextAreaElement | null, index: number) {
  textareaRefs.value[index] = el;
}


const emit = defineEmits<{
  (e: 'upload', name: string): void
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
    import_enc.value = false;
    if (filename.value && filename.value.endsWith(".TXT")) {
        try {
            const data = await server.getDDLFile(filename.value);
            const udata = new Uint8Array(data);
            const text = string_from_keybcs2(Array.from(udata));
            const lines = text.split("\n").map(x=>x.trim()).filter(x=>x && !x.startsWith(";") && !x.startsWith("-1"));
            
            if (is_string_table(lines)) {
                line_editor.value = extract_stringtable(lines);
                if (filename.value.toUpperCase() == "POPISY.TXT") {
                    strtable_template.value = MainStringtable;
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
        emit("upload", new_file_name);
        filename.value = new_file_name;
    }
}

onMounted(load_text);
watch([filename], load_text);

function set_line(event: Event, idx: number) {
    if (line_editor.value) {
        const t = event.target as HTMLInputElement;
        line_editor.value[idx] = t.value;
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

</script>



<template>
<div v-if="import_enc">
    <h2>Import ENC file</h2>
    <x-form>
        <label><span>Source ENC file</span><input type="file" @change="$event=>select_enc_file($event)" /></label>        
        <div class="buttons"><button @click="do_import_enc">Import ENC</button></div>
    </x-form>
</div>
<div v-if="line_editor">
    <div class="line-editor">
           <template v-for="v of order_lines"> 
            <div>
                <div>{{ v[1] }}</div><textarea cols="60" rows="1" 
                            :ref="el => setTextareaRef(el as HTMLTextAreaElement, v[0] as number)"
                        v-autoresize @change="$event=>set_line($event, v[0] as number)">{{  v[2]  }}</textarea>
                        </div>
            </template>
    </div>
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


</style>