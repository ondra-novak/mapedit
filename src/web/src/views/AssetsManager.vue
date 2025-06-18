<script setup lang="ts">
import AssetsPcxView from '@/components/AssetsPcxView.vue';
import AssetsHiView from '@/components/AssetsHiView.vue';
import AssetsList from '../components/AssetsList.vue'
import { ref, watch, onMounted, computed, defineEmits, onUnmounted, getCurrentInstance } from 'vue';
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

const selected_tool = ref<string>("");
const selected_file = ref<string>("");
const selected_group = ref<AssetGroupType>(AssetGroup.UNKNOWN);
const cur_file_model = ref<FileItem>();
const disable_delete = ref<boolean>(true);

watch([selected_tool], ()=>{
    switch (selected_tool.value) {
        case "walls": selected_group.value=AssetGroup.WALLS;break;
        case "enemies": selected_group.value=AssetGroup.ENEMIES;break;
        case "items": selected_group.value=AssetGroup.ITEMS;break;
        case "uigfx": selected_group.value=AssetGroup.UI;break;
    }
});

function select_tool() : string | null {
    if (!cur_file_model.value) return null;
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
        case AssetGroup.MAPS:
                if (cur_file_model.value.name == "ENEMY.DAT" 
                    || cur_file_model.value.name == "SOUND.DAT") {
                        return "goto_editor:enemies";
                }
                if (cur_file_model.value.name == "FACTS.JSON") {
                    return "goto_editor:facts";
                }
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
    if (selected_tool.value != "upload" && selected_tool.value != "hexview") {
        const tool = select_tool();
        selected_tool.value = tool || "";
    }
})

const assetList = ref<InstanceType<typeof AssetsList> | null>(null)

async function onUploadDone(filename:string, done?:Promise<void>) {
    if (done) await done;
    assetList.value?.reload();
    if (cur_file_model.value) cur_file_model.value.name = filename;
}

function delete_file() {
    if (cur_file_model.value) {
        if (confirm("Are you sure to delete file: "+cur_file_model.value.name)) {
            server.deleteDDLFile(cur_file_model.value.name);
            assetList.value?.reload();
            cur_file_model.value = undefined;
            selected_tool.value="ddlinfo";
        }
    }
}


</script>


<template>
    <div class="left-panel">
    <AssetsList v-model="cur_file_model" ref="assetList" />
    </div>
    <button class="right-top" :disabled="disable_delete" @click="delete_file" >Delete file</button>

    <div class="middle-panel">
        <select v-model="selected_tool">
            <option value="">--- choose tool ---</option>
            <option value="walls">Walls and arcs</option>
            <option value="floorceil">Floors and ceils</option>
            <option value="items">Items</option>
            <option value="icons">Icons (items)</option>
            <option value="mgf">Animation MGF</option>
            <option value="enemies">Enemies</option>
            <option value="coledit">Enemy colors</option>
            <option value="seqedit">Enemy animation sets</option>
            <option value="uigfx">UI and other</option>
            <option value="dialogshi">Dialog portraits</option>
            <option value="fonts">Fonts</option>            
            <option value="strings">Texts</option>            
            <option value="upload">Upload and download</option>
            <option value="hexview">HexView</option>
            <option value="ddlinfo">Manage DDL</option>
        </select>
        <div class="tools">
            <AssetsPcxView v-if="selected_tool == 'walls' || selected_tool=='items' || selected_tool=='enemies' || selected_tool=='uigfx'" 
                v-model:file="selected_file" v-model:group="selected_group"
                @upload="onUploadDone" />
            <AssetsHiView v-if="selected_tool == 'dialogshi'"
                v-model="selected_file" @upload="onUploadDone" />
            <AssetsToolCol v-if="selected_tool == 'coledit'" 
                v-model="selected_file" @upload="onUploadDone" />
            <AssetToolIcons v-if="selected_tool == 'icons'" @upload="onUploadDone"/>
            <AssetToolSeq v-if="selected_tool == 'seqedit'" v-model="selected_file" @upload="onUploadDone"/>
            <AssetsFloorAndCeil v-if="selected_tool == 'floorceil'"  @upload="onUploadDone"/>
            <AssetsDDLManage v-if="selected_tool == 'ddlinfo'" />
            <AssetsToolUpload v-if="selected_tool == 'upload'" @upload="onUploadDone"
                v-model:file="selected_file" v-model:group="selected_group" />
            <HexView v-if="selected_tool == 'hexview'" v-model="selected_file" />
            <AssetsFontsViewer v-if="selected_tool == 'fonts'" v-model="selected_file" />
            <TextsEditor v-if="selected_tool == 'strings'" v-model="selected_file" @upload="onUploadDone"/>
            <AssetsToolMGF v-if="selected_tool == 'mgf'" v-model="selected_file" @upload="onUploadDone"/>
            <div v-if="selected_tool.startsWith('goto_editor:')">
                <div class="hint-link"><RouterLink :to="`/${selected_tool.split(':')[1]}`">Open editor</RouterLink></div>
            </div>

        </div>
    </div>

</template>

<style scoped>
.left-panel {
    width: 15rem;
    position: absolute;
    top: 2.25rem;
    bottom: 0px;
}
.middle-panel {
    text-align: center;
    display:flex;
    flex-direction: column;
    
    background-color: #CCC;
    position: absolute;
    left: 15rem;
    right: 0;
    top: 2.25rem;
    bottom: 0;    
}

.middle-panel > select {
    display: block;
    margin: 1em auto;
}
.middle-panel > .tools {
    overflow: auto;
    position: relative;

    
}

.right-top {
    position: absolute;
    right: 1em;
    top: 3em;
    width: 6em;
    display: block;
    z-index: 2;
}

</style>