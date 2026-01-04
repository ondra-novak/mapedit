<script setup lang="ts">
import AssetsPcxView from '@/components/AssetsPcxView.vue';
import AssetsHiView from '@/components/AssetsHiView.vue';
import AssetsList from '../components/AssetsList.vue'
import { computed, ref, watch } from 'vue';
import { AssetGroup } from '@/core/asset_groups';
import type {AssetGroupType}from '@/core/asset_groups';
import { server, type FileItem } from '@/core/api';
import AssetsDDLManage from '@/components/AssetsDDLManage.vue';
import AssetsToolCol from '@/components/AssetsToolCol.vue';
import AssetToolIcons from '@/components/AssetToolIcons.vue';
import AssetToolSeq from '@/components/AssetToolSeq.vue';
import AssetsFloorAndCeil from '@/components/AssetsFloorAndCeil.vue';
import AssetsToolUpload from '@/components/AssetsToolUpload.vue';
import HexView from '@/components/HexView.vue';
import AssetsToolMGF from '@/components/AssetsToolMGF.vue';
import AssetsFontsViewer from '@/components/AssetsFontsViewer.vue';
import TextsEditor from '@/components/TextsEditor.vue';
import FileHistory from '@/components/FileHistory.vue';
import { EditorID, mainMenuControl, mapEditorControl, type EditorRef } from '@/core/services';

const selected_tool = ref<string>("");
const selected_file = ref<string>("");
const selected_group = ref<AssetGroupType>(AssetGroup.UNKNOWN);
const cur_file_model = ref<FileItem>();
const disable_delete = ref<boolean>(true);
const props = defineProps<{
    active: boolean;
}>();

const listOfTools = {
    "walls":"Wall",
    "floorceil":"Floor/Ceil",
    "items":"Item",
    "icons":"Icons",
    "mgf":"MGF Animation",
    "enemies":"Enemy",
    "coledit":"Enemy colors",
    "seqedit":"Enemy animation",
    "uigfx":"Other graphic",
    "dialogshi":"Dialog portrait",
    "fonts":"Font",
    "strings":"Text editor",
    "upload":"Upload/Download",
    "history":"File History",
    "hexview":"Hex viewer",
    "ddlinfo":"Manage DDL",
};

const listOfEditors : Record<string,(s:string)=>void>= {
    "ADV.INI":()=>mainMenuControl.open_editor(EditorID.GENERAL),
    "ENEMY.DAT":()=>mainMenuControl.open_editor(EditorID.ENEMIES),
    "SOUND.DAT":()=>mainMenuControl.open_editor(EditorID.ENEMIES),
    "ITEMS.DAT":()=>mainMenuControl.open_editor(EditorID.ITEMS),
    "KOUZLA.DAT":()=>mainMenuControl.open_editor(EditorID.SPELLS),
    "KNIHA.TXT":()=>{},
    "POSTAVY.DAT":()=>mainMenuControl.open_editor(EditorID.CHARACTERS),
    "DIALOGY.DAT":()=>{},
    "DIALOGY.JSON":()=>{},
    ".MAP":(s:string)=>{
        mainMenuControl.open_editor(EditorID.MAP);
        mapEditorControl.open_map(s);
    }
};


watch([selected_tool], ()=>{
    switch (selected_tool.value) {
        case "walls": selected_group.value=AssetGroup.WALLS;break;
        case "enemies": selected_group.value=AssetGroup.ENEMIES;break;
        case "items": selected_group.value=AssetGroup.ITEMS;break;
        case "uigfx": selected_group.value=AssetGroup.UI;break;
    }
});

function is_editor_exists() {
    const s = cur_file_model.value;
    if (s) {
        for (let v in listOfEditors) {
            if (s.name.endsWith(v)) return true;
        }
    }
    return false;
}

const editor_exists = computed(()=>is_editor_exists());

function select_tool() : string | null {
    if (!cur_file_model.value) return null;
    for (let v in listOfEditors) {
        if (cur_file_model.value.name.endsWith(v)) return "editor_exists";
    }
    if (cur_file_model.value.name.endsWith(".MGF")) return "mgf";        
    if (cur_file_model.value.name.endsWith(".TXT")) return "strings";
    switch (cur_file_model.value.group) {
        case AssetGroup.WALLS: return "walls";
        case AssetGroup.ENEMIES:if (cur_file_model.value.name.endsWith(".SEQ") )
                                    return "seqedit";
                                else if (cur_file_model.value.name.endsWith(".COL") || selected_tool.value == "coledit" )
                                    return "coledit";
                                else 
                                    return  "enemies";
        case AssetGroup.ITEMS: if (cur_file_model.value.name.endsWith(".LIB")) 
                                    return  "icons";
                                else
                                    return "items";
        case AssetGroup.UI: return  "uigfx";
        case AssetGroup.FONTS: return "fonts";
        case AssetGroup.DIALOGS: if (cur_file_model.value.name.endsWith(".HI")) 
                                        return "dialogshi";
                                else if (cur_file_model.value.name.endsWith(".PCX"))
                                        return  "uigfx";
                                else    
                                    return null;        
        default:  return null;
    }    
}

watch([cur_file_model], ()=>{
    if (!cur_file_model.value) {
        disable_delete.value = true;
        return;
    }
    disable_delete.value = !cur_file_model.value.ovr;
    selected_file.value = cur_file_model.value.name;
    selected_group.value = cur_file_model.value.group;
    if (selected_tool.value != "upload" && selected_tool.value != "hexview" && selected_tool.value != "history") {
        const tool = select_tool();
        selected_tool.value = tool || "";
    }
})

const assetList = ref<InstanceType<typeof AssetsList> | null>(null)


function delete_file() {
    if (cur_file_model.value) {
            server.deleteDDLFile(cur_file_model.value.name);
            assetList.value?.reload();
            cur_file_model.value = undefined;
            selected_tool.value="ddlinfo";
    }
}

function tool_click(id:string) {
    selected_tool.value = id;
}

function open_editor() {
    const s = cur_file_model.value;
    if (!s) return ;
    for (const v in listOfEditors) {
        if (s.name.endsWith(v)) {
            const editor = listOfEditors[v];
            editor(s.name);
        }
    }

}

</script>


<template>    
<x-workspace :hidden="!active">
    <div class="left-panel">
    <AssetsList v-model="cur_file_model" ref="assetList" class="asslst" />
    </div>

    <div class="middle-panel-pos">
        <div class="middle-panel">
            <div class="tools-pos">
                <div class="tools" v-if="active">
                    <AssetsPcxView v-if="selected_tool == 'walls' || selected_tool=='items' || selected_tool=='enemies' || selected_tool=='uigfx'" 
                        v-model:file="selected_file" v-model:group="selected_group" />
                    <AssetsHiView v-if="selected_tool == 'dialogshi'" v-model="selected_file" />
                    <AssetsToolCol v-if="selected_tool == 'coledit'"  v-model="selected_file"  />
                    <AssetToolIcons v-if="selected_tool == 'icons'"/>
                    <AssetToolSeq v-if="selected_tool == 'seqedit'" v-model="selected_file"/>
                    <AssetsFloorAndCeil v-if="selected_tool == 'floorceil'" />
                    <AssetsDDLManage v-if="selected_tool == 'ddlinfo'" />
                    <AssetsToolUpload v-if="selected_tool == 'upload'" v-model:file="selected_file" v-model:group="selected_group" />
                    <HexView v-if="selected_tool == 'hexview'" v-model="selected_file" />
                    <AssetsFontsViewer v-if="selected_tool == 'fonts'" v-model="selected_file" />
                    <TextsEditor v-if="selected_tool == 'strings'" v-model="selected_file" />
                    <FileHistory v-if="selected_tool == 'history'" v-model="selected_file" />
                    <AssetsToolMGF v-if="selected_tool == 'mgf'" v-model="selected_file" />
                    <div v-if="selected_tool == 'editor_exists'" class="goto-tool">
                        <button @click="open_editor">Open editor</button>
                    </div>
                    <div v-if="selected_tool == 'delete'" class="delete-file">
                        <p>Confirm you want to delete file:</p>
                        <p>{{ selected_file }}</p>
                        <button @click="delete_file">Delete</button>
                    </div>
                    

                </div>
            </div>
            <div class="tool-bar">
                <div v-for="(t,id) in listOfTools" :class="{selected: selected_tool == id}" :key="id" @click="tool_click(id)"> {{ t }} </div>
                <div v-if="!disable_delete" :class="{selected: selected_tool == 'delete'}"  @click="tool_click('delete')">Delete file</div>
                <div v-if="editor_exists" :class="{selected: selected_tool == 'editor_exists'}" @click="tool_click('editor_exists')">Goto editor</div>
            </div>            
        </div>
    </div>

</x-workspace>
</template>

<style scoped>
.left-panel {
    width: 15rem;
    position: absolute;
    top: 0;
    bottom: 0px;
    
}

.middle-panel-pos {
    position: absolute;
    left: 15rem;
    right: 0;
    top: 0;
    bottom: 0;        
    background-color: #CCC;
}


.middle-panel {
    text-align: center;
    position: relative;        
    height: 100%;
}

.middle-panel > .tools-pos {
    padding-right: 10rem;
    height: 100%;
    box-sizing: border-box;
}
.middle-panel > .tools-pos > .tools {
    overflow: auto;
    position: relative;
    height: 100%;
    box-sizing: border-box;

    
}

.tool-bar {
    display: flex;
    flex-wrap: wrap;
    flex-direction: column;
    position: absolute;
    text-align: left;    
    top: 0;
    right: 0;
    bottom: 0;
    background-color: #aaa;
    width: 10rem;
    gap: 1px
}

.tool-bar > * {
    padding: 0.5rem 1rem;
    background: linear-gradient(-90deg, white, #ccc);
    border-radius: 0 1em 1em 0;
    cursor: pointer;
    width: 10rem;
    box-sizing: border-box;
    white-space: nowrap;
    
    

}
.tool-bar > .selected {
    font-weight: bold;
    background: linear-gradient(-90deg, #aaa, #ccc);
}

.delete-file, .goto-tool {
    border: 1px solid;
    background-color: white;
    width: 20rem;
    padding: 1rem;
    margin: auto;
    margin-top: 20vh;
}
.asslst {
    background-color: white;
    overflow: auto;
    height: 100%;
}

</style>