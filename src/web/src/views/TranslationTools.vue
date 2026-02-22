<script lang="ts" setup>
import StatusBar from '@/components/statusBar';
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { BinaryIterator, BinaryWriter, parseSection, writeSection } from '@/core/binary';
import { characters_generate_translation, characters_translate, humanDataFromArrayBuffer, humanDataToArrayBuffer } from '@/core/character_structs';
import { DialogManager, type DialogConstant } from '@/core/dialog_structs';
import { enemy_generate_translation, enemy_translate, enemyAndSoundFromArrayBuffer, enemyAndSoundToArrayBuffer, enemyFromArrayBuffer } from '@/core/enemy_struct';
import { FactDB } from '@/core/factdb';
import { items_generate_translation, items_translate, itemsFromArrayBuffer, itemsToArrayBuffers } from '@/core/items_struct';
import { keybcs2string, string2keybcs } from '@/core/keybcs2';
import { ascii_languages } from '@/core/languages';
import { shops_generate_translation, shops_translate, shopsFromArrayBuffer, shopsToArrayBuffer } from '@/core/shop_structs';
import { spells_generate_translation, spells_translate, spellsFromArrayBuffer, spellsToArrayBuffer } from '@/core/spell_structs';
import { map_load_stringtable, map_save_stringtable, parse_stringtable, serialize_stringtable, stringtable_generate_translation, stringtable_translation } from '@/core/string_table';
import { TranslateTable } from '@/core/translate';
import browse_file from '@/utils/browse_file';
import { messageBoxAlert, messageBoxConfirm } from '@/utils/messageBox';
import { computed, onMounted, reactive, ref, watch } from 'vue';


const lang_list = computed(()=>{
    return Object.entries(ascii_languages).sort((a,b)=>a[1].localeCompare(b[1]));
})

let project_name: string|null;

function compute_target_project(lang: string) {
    if (project_name == null) return "";
    const sep = project_name.lastIndexOf(".");
    return project_name.substring(0,sep)+"-"+lang+project_name.substring(sep);
}

const gen_config = reactive<{
    char?:boolean,
    enemies?:boolean,
    index0?:boolean,
    playlist?:boolean
}>({});



const defined_languages = ref<Record<string, boolean> >({});
const langpkg = reactive<{
    string_table:ArrayBuffer|null,
    book:ArrayBuffer|null,
    epilog:ArrayBuffer|null,
    target_project_name: string
}>({string_table:null, book:null, epilog:null,target_project_name:""});
const selected_language = ref("");

const invalid_lang = computed(()=>!selected_language.value)

async function load_languages() {
    project_name = await StatusBar.get_project_name();
    const lst = await server.lang_list();
    defined_languages.value = Object.fromEntries(lst.map(x=>[x,true]));    
}

async function load_selected_lang() {
    const l = selected_language.value;
    langpkg.book = langpkg.epilog = langpkg.string_table = null;
    if (l) {
        const f =await server.lang_get(selected_language.value);
        const iter = new BinaryIterator(f);
        const dec = new TextDecoder();
        while (true) {
            const s = parseSection(iter);
            switch(s.type) {
                case 1: langpkg.book = s.data;continue;
                case 2: langpkg.epilog = s.data;continue;
                case 3: langpkg.string_table = s.data;continue;
                case 4: langpkg.target_project_name = dec.decode(s.data);continue            
            }
            break;
        }
    } 
}

async function save_selected_lang() {
    const l = selected_language.value;
    if (l) {
        const enc = new TextEncoder();
        const wr = new BinaryWriter();
        if (langpkg.book) writeSection(wr, 1, langpkg.book);
        if (langpkg.epilog) writeSection(wr, 2, langpkg.epilog);
        if (langpkg.string_table) writeSection(wr, 3, langpkg.string_table);
        if (langpkg.target_project_name) writeSection(wr, 4, enc.encode(langpkg.target_project_name).buffer);                    
        writeSection(wr,0,new ArrayBuffer());
        server.lang_put(l, wr.getBuffer());
        defined_languages.value[l] = true;
    }    
}

watch(selected_language,()=>{
    const l = selected_language.value;
    if (!l) return;
    langpkg.target_project_name = compute_target_project(l);
    load_selected_lang();
});


async function browse_for_stringtable() {
    const f = await browse_file("text/csv");
    try {
        (new TranslateTable).import_csv(f.data);    //validate
        langpkg.string_table = f.data;
        await save_selected_lang();
    } catch (e) {
        const err = e as Error;
        messageBoxAlert(`Error: ${err.message}`);
    }
}
async function browse_for_booktxt() {
    const f = await browse_file("text/plain");
    langpkg.book = f.data;
    await save_selected_lang();
}
async function browse_for_epilog() {
    const f = await browse_file("text/plain");
    langpkg.epilog = f.data;
    await save_selected_lang();
}

function init() {
    load_languages();
}

async function delete_lang() {
    const l = selected_language.value;
    if (l && await messageBoxConfirm(`Do you really want to delete language version: ${ascii_languages[l as  keyof typeof ascii_languages]}`)) {
        await server.lang_delete(l);
        delete defined_languages.value[l]
    }
}

onMounted(init);

const string_table_gen_status = ref<HTMLDialogElement>();
const string_table_gen_result = ref<HTMLDialogElement>();
const generate_result_url = ref<string>();
const generate_name = ref<string>();
const other_files = ["POPISY.TXT"];



async function generate_stringtable() {
    const dlg = string_table_gen_status.value;
    const dlgres = string_table_gen_result.value;
    if (!dlg || !dlgres) return;
    dlg.showModal();
    let err : Error|null = null;
    let url: string|null = null;

    try {
        url = await do_generate_stringtable();
        
    } catch (e) {
        err = e as Error;        
    }
    dlg.close();
    if (err) {
        await messageBoxConfirm(`Generation failed with error: ${err.message}`);        
        return;
    }
    dlg.close();

    generate_result_url.value = url as string;
    generate_name.value = project_name + ".stringtable.csv";
    dlgres.showModal();
}

function close_gen_result() {
    string_table_gen_result.value?.close();
    URL.revokeObjectURL(generate_result_url.value as string);
}

async function do_generate_stringtable() : Promise<string> {
    const trn = new TranslateTable;
    const dec = new TextDecoder();
    try {
        const itemdata = await server.getDDLFile("ITEMS.DAT");
        const items = itemsFromArrayBuffer(itemdata);
        items_generate_translation(items, trn);
    } catch (e) {}

    if (gen_config.enemies) {
        try {
            const data = await server.getDDLFile("ENEMY.DAT");
            const enemies = enemyFromArrayBuffer(data);
            enemy_generate_translation(enemies, trn);
        } catch (e) {}
    }

    try {
        const data = await server.getDDLFile("DIALOGY.JSON");
        const dlg = new DialogManager;        
        dlg.load(dec.decode(data));
        dlg.generate_translation(trn);        
    } catch (e) {}

    try {
        const data = await server.getDDLFile("SHOPS.DAT");
        const shops = shopsFromArrayBuffer(data, true);
        shops_generate_translation(shops, trn);
    } catch (e) {}

    try {
        const data = await server.getDDLFile("KOUZLA.DAT");
        const spells = spellsFromArrayBuffer(data);
        spells_generate_translation(spells, trn);
    } catch (e) {}

    if (gen_config.char) {
        try {
            const data = await server.getDDLFile("POSTAVY.DAT");
            const human = humanDataFromArrayBuffer(data);
            characters_generate_translation(human.characters, trn);
        } catch (e) {}
    }    

    const maps = (await server.getDDLFiles(AssetGroup.MAPS)).files
            .filter(n=>n.name.toUpperCase().endsWith(".MAP"))
            .map(n=>n.name);
    for (const v of maps) {
        const str = (await map_load_stringtable(v));
        if (!gen_config.index0) delete str[0];
        if (!gen_config.playlist) delete_playlists(str);
        stringtable_generate_translation(v, str, trn);
    }

    for (const v of other_files) {
        try {
            const data = await server.getDDLFile(v);
            const strs = parse_stringtable(keybcs2string(data));
            if (!gen_config.playlist) delete_playlists(strs);
            stringtable_generate_translation(v, strs, trn);
        } catch (e) {

        }
    }

    const csv = trn.export_csv();
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    return url;
    

}

function delete_playlists(s: string[]) {
    const lst:number[] = [];
    s.forEach((x,idx)=>{
        if (x.match(/^\s*(FORWARD|RANDOM|FIRST)?\s+([^.]+\.(MP3|MUS)\s+)*([^.]+\.(MP3|MUS))\s*$/i)) {
            lst.push(idx);
        }
    })
    lst.forEach(v=>delete s[v]);
}

const translate_status = ref<HTMLDialogElement>();

async function update_target() {
    const dlg = translate_status.value;
    if (!dlg) return;
    if (!await messageBoxConfirm(`After processing, the workspace will be switched to the target project.\n\nConfirm that you want to edit the target project\n\n${langpkg.target_project_name}`))
        return;
    dlg.showModal();
    try {
        await server.lang_copyddl(langpkg.target_project_name);

        if (langpkg.book) await server.putDDLFile("KNIHA.TXT",langpkg.book, AssetGroup.MAPS);
        if (langpkg.epilog) await server.putDDLFile("ENDTEXT.TXT",langpkg.epilog, AssetGroup.MAPS);
        if (langpkg.string_table) {
            await do_apply_stringtable(langpkg.string_table);
        }

        dlg.close();
    } catch (e) {
        dlg.close();
        const err = e as Error;
        await messageBoxAlert(`An error reported during processing. Result can be incomplete: ${err.message}`);
    }

    location.reload();
}

async function do_apply_stringtable(csv: ArrayBuffer) {
    const trn = new TranslateTable();
    trn.import_csv(csv);
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    try {
        const itemdata = await server.getDDLFile("ITEMS.DAT");
        const items = itemsFromArrayBuffer(itemdata);
        items_translate(items, trn);
        await server.putDDLFile("ITEMS.DAT", itemsToArrayBuffers(items), AssetGroup.MAPS);
    } catch (e) {}

    try {
        const data = await server.getDDLFile("ENEMY.DAT");
        const enemies = enemyAndSoundFromArrayBuffer(data);
        if (enemies) {
            enemy_translate(enemies[0], trn);            
            await server.putDDLFile("ENEMY.DAT", enemyAndSoundToArrayBuffer(enemies[0], enemies[1]), AssetGroup.MAPS);
        }
    } catch (e) {}
    

    try {
        const data = await server.getDDLFile("DIALOGY.JSON");
        const dlg = new DialogManager;        
        dlg.load(dec.decode(data));
        dlg.translate(trn);        
        await server.putDDLFile("DIALOGY.JSON", enc.encode(dlg.save()).buffer, AssetGroup.MAPS);
        let db = new FactDB();
        
        try {
            const factsdata = await server.getDDLFile("FACTS.JSON");
            db = FactDB.fromJSON(dec.decode(factsdata));;
        } catch (e) {}

        const dat = dlg.generate_dat(dlg.compile(db.asDlgConsts()));
        await server.putDDLFile("DIALOGY.DAT", dat, AssetGroup.MAPS);
    } catch (e) {}

    try {
        const data = await server.getDDLFile("SHOPS.DAT");
        const shops = shopsFromArrayBuffer(data,false);
        shops_translate(shops, trn);
        await server.putDDLFile("SHOPS.DAT", shopsToArrayBuffer(shops), AssetGroup.MAPS);
    } catch (e) {}

    try {
        const data = await server.getDDLFile("KOUZLA.DAT");
        const spells = spellsFromArrayBuffer(data);
        spells_translate(spells, trn);
        await server.putDDLFile("KOUZLA.DAT", spellsToArrayBuffer(spells), AssetGroup.MAPS);
    } catch (e) {}

    try {
        const data = await server.getDDLFile("POSTAVY.DAT");
        const human = humanDataFromArrayBuffer(data);
        characters_translate(human.characters, trn)
        await server.putDDLFile("POSTAVY.DAT", humanDataToArrayBuffer(human), AssetGroup.MAPS);
    } catch (e) {}

    const maps = (await server.getDDLFiles(AssetGroup.MAPS)).files
            .filter(n=>n.name.toUpperCase().endsWith(".MAP"))
            .map(n=>n.name);
    for (const v of maps) {
        const str = (await map_load_stringtable(v));
        if (str.length) {
            stringtable_translation(v, str, trn);
            await map_save_stringtable(v, str);
        }
    }

    for (const v of other_files) {
        try {
            const data = await server.getDDLFile(v);
            const strs = parse_stringtable(keybcs2string(data));
            if (strs.length) {
                stringtable_translation(v, strs, trn);
                await server.putDDLFile(v, (new Uint8Array(string2keybcs(serialize_stringtable(strs)))).buffer, AssetGroup.MAPS);
            }
        } catch (e) {

        }
    }


    
}

</script>
<template>
    <x-workspace>   
        <div class="panel">
    <x-section>
        <x-section-title>String table</x-section-title>
        <x-form>
            <label><span>Generate & download</span><button @click="generate_stringtable">Generate</button></label>
            <label><input type="checkbox" v-model="gen_config.char"><span>Include character names</span></label>
            <label><input type="checkbox" v-model="gen_config.enemies"><span>Include enemy names (not visible in the game)</span></label>
            <label><input type="checkbox" v-model="gen_config.index0"><span>Include playlists (index 0)</span></label>
            <label><input type="checkbox" v-model="gen_config.playlist"><span>Include other playlists (detected in other indices)</span></label>
        </x-form>
        <p class="note">This function collects all texts from all resources
and generates a CSV string table. The file can be opened
in Excel or LibreOffice. Provide translations for each
entry in the table, then use the updated file in the
next step to generate the localized language version.
        </p>
        <p class="note warn">Some files are not included: Book(KNIHA.TXT) and Epilog (ENDTEXT.TXT). 
            You need extract them manually, translate them and attach separatedly</p>
    </x-section>
    <x-section>
        <x-section-title>Preparation of a language mutation</x-section-title>
        <x-form>
            <label><span>Target language</span><div><select v-model="selected_language" :class="{defined: !!defined_languages[selected_language]}"><option value="">-- Select language --</option>
                <option v-for="v of lang_list" :key="v[0]" :value="v[0]" :class="{defined: !!defined_languages[v[0]]}"> {{  v[1] }}</option>
            </select><button @click="delete_lang" :disabled="invalid_lang && !defined_languages[selected_language]">Delete</button></div></label>
            <label><span>Target project name</span><div><input :disabled="invalid_lang" type="text" @change="save_selected_lang" v-model="langpkg.target_project_name" placeholder="TRANSLATED.DDL"><div>Will be created if not exists</div></div></label>
            <div class="label"><span>String table</span><div class="present-state" :class="{present: !!langpkg.string_table}"><button :disabled="invalid_lang" @click="browse_for_stringtable"></button></div></div>
            <div class="label"><span>KNIHA.TXT</span><div class="present-state" :class="{present: !!langpkg.book}"><button  :disabled="invalid_lang"  @click="browse_for_booktxt"></button></div></div>
            <div class="label"><span>ENDTEXT.TXT</span><div class="present-state" :class="{present: !!langpkg.epilog}"><button :class="{present: !!langpkg.epilog}" :disabled="invalid_lang" @click="browse_for_epilog"></button></div></div>
        </x-form>
        <div class="deploy"><button :disabled="invalid_lang || (!langpkg.string_table && !langpkg.book && !langpkg.epilog)" @click="update_target">Create or update target project</button></div>
    </x-section>
    </div>
    <dialog ref="string_table_gen_status">
        <header>Generate stringtable</header>
        <p>Work in progress, please wait ...</p>
    </dialog>
    <dialog ref="translate_status">
        <header>Applying translation</header>
        <p>Work in progress, please wait ...</p>
    </dialog>
    <dialog ref="string_table_gen_result">
        <header>Generate DONE<button class="close" @click="close_gen_result"></button></header>
        <p>Download here: <a :href="generate_result_url" :download="generate_name"> {{ generate_name }}</a></p>
        <footer><button @click="close_gen_result">Close</button></footer>
    </dialog>
    </x-workspace>    
</template>
<style lang="css" scoped>
div.panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-around;
    margin: 2rem;
}
x-section {
    width: 40rem;
    height: auto;
}

.deploy {
    text-align: center;
}
option.defined, select.defined {
    font-weight: bold;
}
.present-state::before {
    content: "\2717";
    margin: 0 0.5rem;
    color: darkred;
    font-size: 1.5rem;
    vertical-align: middle;
    display: inline-block;
}
.present-state.present::before {
    content: "\2713";
    color: green;
}
.present-state button::before {
    content: "Attach"
}
.present-state.present button::before {
    content: "Update"
}

</style>