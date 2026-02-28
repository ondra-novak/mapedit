<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import StatusBar, { type SaveRevertControl } from '@/components/statusBar.ts'
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { humanDataFromArrayBuffer, humanDataToArrayBuffer, Runes, type THumanData } from '@/core/character_structs';
import { getDDLFileWithImport } from '@/components/tools/missingFiles';
import { string2keybcs } from '@/core/keybcs2';
import { IniConfig } from '@/core/ini';
import WYSIWYGedit from '@/components/WYSIWYGedit.vue';
import { supported_languages } from '@/core/languages';
import { create_datalist } from '@/utils/datalist';
import { publish_tags } from '@/core/publis_tags';
import { bb2html } from '@/core/bb2html';
import { messageBox, messageBoxAlert, messageBoxConfirm } from '@/utils/messageBox';
import { readFileToArrayBuffer } from '@/core/read_file';
import { WsRpcException } from '@/core/wsrpc';


class BasicInfoData {
    name:string = "My new adventure";
    desc:string = "some description of adventure";
    characters_min:number = 3;
    characters_max:number = 3;
    start_map: string = "START.MAP";
    dlc:number = 0;
    language: string = "en";
    langddl: string = "en";
};

class PublishData {
    item_id: string = "";
    last_publish: Date | null = null;
    image:Blob|null = null;
    tags: string[] = [];
    visibility: number = 0;
};

const basic_info = ref<BasicInfoData>(new BasicInfoData);
const publish_data = ref<PublishData>(new PublishData);
const postavy_dat = ref<THumanData>()
const runes = ref<Runes>(new Runes());
const next_tag = ref("");
const new_changelog = ref("");
let save_state: SaveRevertControl;

function reload() {
    server.getDDLFile("ADV.INI").then(buff=>{
        const dec = new TextDecoder();
        const s = dec.decode(buff);
        const ini = new IniConfig(s);
        const data = ini.getSection("ADV");
        Object.assign(basic_info.value, data);
        nextTick(()=>save_state.set_changed(false));
    });
    getDDLFileWithImport(server,"POSTAVY.DAT",AssetGroup.MAPS).then(buff=>{
        if (buff) {
            postavy_dat.value = humanDataFromArrayBuffer(buff);
            runes.value = postavy_dat.value.runes;
            nextTick(()=>save_state.set_changed(false));
        }
    });
    server.get_publish_status().then(data=>{
        const n = new PublishData();
        const [status,ctx] = data.data as [Record<string, any>, string];        
        n.item_id = status.item_id;
        n.last_publish = status.last_publish?new Date(status.last_publish*1000):null;
        n.tags = status.tags;
        n.visibility = status.visibility;
        n.image = ctx?new Blob(data.attachments, {type:ctx}):null;
        publish_data.value = n;
    });
    new_changelog.value="";
}

async function save() {
    const ini = new IniConfig();
    ini.set("ADV", basic_info.value);
    const s = ini.save();
    const enc = new TextEncoder();
    const buff = enc.encode(s).buffer;
    await server.putDDLFile("ADV.INI", buff, AssetGroup.UNKNOWN);

    if (postavy_dat.value) {
        const buff3 = humanDataToArrayBuffer(postavy_dat.value);
        await server.putDDLFile("POSTAVY.DAT", buff3, AssetGroup.MAPS);
    }
}

async function init() {
    save_state = await StatusBar.register_save_control();
    save_state.on_save(save);
    save_state.on_revert(reload);
    reload();
}

onMounted(init);
onUnmounted(()=>save_state.unmount());

watch([basic_info, runes], ()=>save_state.set_changed(true),{deep:true});

const lang_list = computed(()=>{
    return supported_languages.sort((a,b)=>a[0].localeCompare(b[0]));
})

const taglist = create_datalist(()=>{
    return publish_tags.map(x=>({value:x}));
})

function tag_add() {
    const s = next_tag.value;
    const idx = publish_data.value.tags.findIndex(x=>x==s);
    if (idx >= 0) publish_data.value.tags.splice(idx,1);
    publish_data.value.tags.push(s);
    next_tag.value = "";
}

function deltag(s: string) {
    const idx = publish_data.value.tags.findIndex(x=>x==s);
    if (idx >= 0) publish_data.value.tags.splice(idx,1);
}

function tag_keydown(e: KeyboardEvent) {
    if (e.key == "Enter") {
        tag_add();
        e.stopPropagation();
        e.preventDefault();
    }
    else if (e.key == "Backspace" && !next_tag.value && publish_data.value.tags.length) {
        publish_data.value.tags.pop();
        e.stopPropagation();
        e.preventDefault();
    }
}

function tag_change() {
    tag_add();
}

const curImgUrl = ref("");

function generate_url(s: Blob) {
    if (curImgUrl.value) URL.revokeObjectURL(curImgUrl.value);
    curImgUrl.value = URL.createObjectURL(s);
    return curImgUrl;
}

watch(()=>publish_data.value.image, ()=>{
    if (publish_data.value.image) {
        generate_url(publish_data.value.image);
    }
})

onUnmounted(()=>{
    if (curImgUrl.value) URL.revokeObjectURL(curImgUrl.value);
});

function upload_image() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const ab = await readFileToArrayBuffer(file);
            try {
                publish_data.value.image = file;
                await server.set_publish_image(ab, file.type)
            } catch (e) {
                publish_data.value.image = null;
                await messageBoxAlert(`Failed to set image: ${(e as Error).message}`);
            }
        }
    };
    input.click();
}

async function publish_publish() {
    await save();
    if (await messageBoxConfirm("Confirm you want to publish this content")) {
        try {
            await server.publish(basic_info.value.name,
                basic_info.value.desc,basic_info.value.language,
                publish_data.value.tags, publish_data.value.visibility,
                new_changelog.value);            
            messageBoxAlert("Succesfully published");
            reload();
        } catch (e) {
            await messageBoxAlert(`Publish failed: ${(e as Error).message}`);
        }
    }

}

async function warning_msg() {
    setTimeout(()=>{
        if (basic_info.value.dlc) {
            messageBoxAlert("This feature can only be enabled if your adventure is an expansion of the original game. This requires that all original definitions be retained, such as all items, monsters, shops, dialogue, or spells. Any modification to these definitions may cause saved games from the original game to be unplayable, or cause undefined behavior.")
        }
    },100);
}

const dlc = computed({
    get:()=>!!parseInt(`${basic_info.value.dlc}`),
    set:(b:boolean)=>basic_info.value.dlc = b?1:0
})

</script>
<template>

<x-workspace>
    <div class="panels">
    <div class="advinfo">
    <x-section>
        <x-section-title>Adventure Definition</x-section-title>
        <x-form>
            <label><span>Name</span><input type="text" v-model="basic_info.name"></label>
            <label><span>Description [BBCodes allowed]<br>(ctrl+b bold, ctrl+i italic) </span><w-y-s-i-w-y-gedit class="descedit" v-model="basic_info.desc" format="BBCode"></w-y-s-i-w-y-gedit></label>
            <label><span>Language</span><select v-model="basic_info.language">
                <option v-for="v of lang_list" :key="v[0]" :value="v[2]"> {{ v[0] }} </option>
            </select></label>
            <label><span>Game UI language</span><select v-model="basic_info.langddl">
                <option value="CZ">Brány Skeldalu (česká verze) - default</option>
                <option value="EN">Gates of Skeldal (english version)</option>
            </select></label>
            <label><span>Start map</span><input type="text" maxlength="12" v-model="basic_info.start_map" @input="basic_info.start_map=dosname_sanitize(basic_info.start_map)"></label>
            <label><span>Initial number of adventurers</span><div><input type="number" v-watch-range min="1" max="6" v-model="basic_info.characters_min">-
                                        <input type="number" v-watch-range :min="basic_info.characters_min" max="6" v-model="basic_info.characters_max"></div></label>
            <div class="label"><span>Initial runes</span>        <table>
            <tbody>
                <tr v-for="(r, n) of runes" :key="n">
                    <td>{{ n }}</td>
                    <td v-for="(v,idx) of r" :key="idx"><input type="checkbox" v-model="r[idx]" /></td>
                </tr>
            </tbody>
        </table>
        </div>
            <label><input type="checkbox" v-model="dlc" @click="warning_msg"><span>DLC / Game plus</span></label>
        </x-form>
    </x-section>    
    </div>
    <div class="publish">
        <x-section>
            <x-section-title>Steam Workshop publishing</x-section-title>
            <header>{{ basic_info.name }}</header>
            <div class="imagepreview" >
                <img :src="curImgUrl" v-if="publish_data.image">
                <button @click="upload_image">Upload image</button>
            </div>
            <x-form>                

                <label><span>Steam ID</span><span v-if="publish_data.item_id" > {{ publish_data.item_id }} </span><span v-else>Not published yet</span></label>
                <label><span>Publised date</span><span> {{ publish_data.last_publish?.toLocaleString()  }} </span></label>
                <label><span>Tags</span><div class="tags">
                    <div v-for="v of publish_data.tags" @click="deltag(v)"> {{ v }}</div>
                    <input v-model="next_tag" @keydown="(e:KeyboardEvent)=>tag_keydown(e)" @change="tag_change" :list="taglist.id" placeholder="Click to add a tag">
                </div></label>
                <label><span>Visibility</span><select v-model="publish_data.visibility">
                    <option :value="0">Public - visible to everyone</option>
                    <option :value="1">Friends only</option>
                    <option :value="2">Private - creator only</option>
                    <option :value="3">Unlisted - creator and subscribers</option>
                </select></label>
            </x-form>
        </x-section>
        <x-section>
            <x-section-title>Publish an update</x-section-title>
            <label  v-if="publish_data.item_id"><span>Description of changes:</span><w-y-s-i-w-y-gedit v-model="new_changelog" format="BBCode" class="chgdesc"/></label>
            <div class="pub"><button @click="publish_publish" :disabled="new_changelog.length == 0 && !!publish_data.item_id">Publish</button></div>
            <p class="note">You can't publish! This feature is not implemented yet  (mock-up only)</p>
        </x-section>
    </div>
</div>
</x-workspace>


</template>
<style lang="css" scoped>

.descedit,.chgdesc {    
    padding: 0.2rem;
    min-height: 1rem;
    border: 1px solid;
    text-align: left;
    background-color: white;
    min-height: 5rem;;
}


.advinfo {
    width: 50rem;    
    
}
.publish {
    width: 40rem;
}
.panels {
    padding-top: 1rem;    ;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
}

.tags {
    display: flex;
    gap: 0.2rem;
    flex-wrap: wrap;
}
.tags > * {
    border: 1px solid;
    background-color: white;
    padding: 0.2rem;
    border-radius: 0.3rem;
    cursor: pointer;
}
.tags input {
    width: 10rem;
}

.imagepreview {
    height: 300px;
    position: relative;
    border: 1px solid;
    text-align: center;
}
.imagepreview > img {
    height: 300px;

}

.imagepreview > button {
    position: absolute;
    right: 0;
    bottom: 0;
}
.chglog {
    padding: 2rem;

}
.chglog > * {
    position: relative;
    border-top: 1px dotted;
}
.chglog > * > *:last-child{
    padding-left: 2rem;
}
.pub {
    text-align: right;
}
.publish header{
    font-weight: bold;
    font-size: 2rem;
    text-align: center;
    margin: 0.3rem 0;
}
input[type=number] {
    text-align: right   ;
}

p.note  {
    color: red;
    font-size: 1.2rem;
}

</style>