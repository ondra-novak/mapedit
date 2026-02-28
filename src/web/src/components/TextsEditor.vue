<script setup lang="ts">
import { server } from '@/core/api';
import { AssetGroup, AssetGroupLabel, type AssetGroupType } from '@/core/asset_groups';
import { keybcs2string, string2keybcs } from '@/core/keybcs2';
import { readFileToArrayBuffer } from '@/core/read_file';
import { parse_stringtable, serialize_stringtable } from '@/core/string_table';
import { MainStringtable } from '@/core/ui_strings';
import Hive from '@/utils/hive';
import { isImportTypeAssertionContainer } from 'typescript';
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import StringTableEditor from './StringTableEditor.vue';
import StatusBar, { type SaveRevertControl } from './statusBar';
import { create } from 'domain';
import { dosname_sanitize } from '@/core/dosname';
import BookEditor from './BookEditor.vue';


const filename = defineModel<string>();
const props = defineProps<{group:AssetGroupType}>();

const stringtable = shallowRef<Hive<string> | null>(null)
const texteditor = shallowRef<string|null>(null);
const bookeditor = shallowRef<string|null>(null);
const create_file_name = ref("");

function detect_stringtable(text: string) {
    const lines = text.split("\n").map(x=>x.trim()).filter(x=>!!x);
    return lines.findIndex(x=>!x.match(/^\s*([0-9]+|-1)(\s+|$)/)) == -1;
}

let save_status:SaveRevertControl|null = null;
let current_filename :string = ""
let current_group :AssetGroupType = AssetGroup.UNKNOWN;

async function save_current_file() {
    if (stringtable.value) {
        const strings :string[] = [];
        stringtable.value.forEach((x,idx)=>strings[idx] = x);
        const out = serialize_stringtable(strings);
        await server.putDDLFile(current_filename, Uint8Array.from(string2keybcs(out)).buffer, current_group);
    } else if (texteditor.value !== null) {
        await server.putDDLFile(current_filename, Uint8Array.from(string2keybcs(texteditor.value)).buffer, current_group);
    } else if (bookeditor.value !== null) {
        await server.putDDLFile(current_filename, Uint8Array.from(string2keybcs(bookeditor.value)).buffer, current_group);
    }
}

function detect_textfile(s:string) {
    const text_sample = s.substring(0, Math.min(500, s.length));
    const printable_chars = text_sample.match(/[\x20-\x7E\xA0-\xFF\n\r\t]/g)?.length ?? 0;
    return printable_chars / text_sample.length > 0.8;
}

function detect_book(s:string) {
    const brackets_pattern = /^\s*\[<?\d+>?w?\]\s*$/gm;
    const empty_brackets_pattern = /^\s*\[\]\s*$/gm;
    const brackets_count = (s.match(brackets_pattern) || []).length;
    const empty_brackets_count = (s.match(empty_brackets_pattern) || []).length;
    return brackets_count > 0 && brackets_count === empty_brackets_count;
}

async function revert_current_file() {
    save_status!.set_changed(false);
    await updateModel();
}

async function init_save() {
        save_status = await StatusBar.register_save_control();
        save_status.on_save(save_current_file);
        save_status.on_revert(revert_current_file);        
    }

async function updateModel() {
    if (save_status) {
        save_status.unmount();
        save_status = null;
    }
    if (filename.value) {        

        current_filename = filename.value;
        current_group = props.group;

        stringtable.value = null;        
        texteditor.value = null;
        bookeditor.value = null;


        const data = await server.getDDLFile(filename.value)  ;
        const text = keybcs2string(data);
        if (detect_stringtable(text)) {
            const h = new Hive<string>();
            parse_stringtable(text).forEach((v,idx)=>h.set(idx,v));                
            const stats = h.get_raw().reduce((a,b)=>b?[a[0]+1,a[1]]:[a[0],a[1]+1],[0,0]);
            if (stats[0]>stats[1]) {
                stringtable.value = h;
                await init_save();
                return;
            }
        }

        if (detect_textfile(text)) {
            if (detect_book(text)) {
                bookeditor.value = text;
            } else {
                texteditor.value = text;
            }
            await init_save();
            return;
        }


    }
}

function stringtable_changed() {
    if (save_status) save_status.set_changed(true);
}
function change_cur_group(ev: Event) {
    current_group = parseInt((ev.target as HTMLSelectElement).value) as AssetGroupType;
}
onMounted(updateModel);
onUnmounted(()=>{
    if (save_status) save_status.unmount();
})
watch(filename, updateModel);
watch(texteditor, stringtable_changed);


async function create_file() {
    const f = create_file_name.value;
    if (f) {
        texteditor.value = "";
        current_filename = f;
        await init_save();
    }
}

</script>

<template>
<x-workspace>
<string-table-editor v-if="stringtable" v-model="stringtable" :global_table="filename?.toUpperCase() == 'POPISY.TXT'" @change="stringtable_changed"></string-table-editor>
<textarea v-else-if="texteditor !== null" v-model="texteditor" ></textarea>
<book-editor v-else-if="bookeditor !== null" v-model="bookeditor" @change="stringtable_changed" ></book-editor>
<div v-else class="creat">
    <x-section><x-section-title>Create new text file</x-section-title></x-section>
    <x-form>
        <label><span>Filename</span><input spellcheck="false" type="text" v-model="create_file_name" @input="create_file_name = dosname_sanitize(create_file_name)" maxlength="12"></label>
        <label><span>Group</span><select :value="group" @change="ev => change_cur_group(ev)">
            <option v-for="(v,idx) of AssetGroupLabel" :key="idx" :value="idx"> {{ v }}</option>
        </select></label>        
    </x-form>
    <button @click="create_file">Create file</button>
</div>

</x-workspace>
</template>
<style lang="css" scoped>
textarea {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    resize: none;

}
</style>