<script setup lang="ts">
import AssetsPcxView from '@/components/AssetsPcxView.vue';
import AssetsList from '../components/AssetsList.vue'
import { ref, watch, onMounted, computed, defineEmits } from 'vue';
import { AssetGroup } from '@/core/asset_groups';
import type {AssetGroupType}from '@/core/asset_groups';
import type { FileItem } from '@/core/api';

const selected_tool = ref<string>("");
const selected_file = ref<string>("");
const selected_group = ref<AssetGroupType>(AssetGroup.UNKNOWN);
const cur_file_model = ref<FileItem>();

watch([selected_tool], ()=>{
    switch (selected_tool.value) {
        case "walls": selected_group.value=AssetGroup.WALLS;break;
        case "enemies": selected_group.value=AssetGroup.ENEMIES;break;
        case "items": selected_group.value=AssetGroup.ITEMS;break;
        case "uigfx": selected_group.value=AssetGroup.UI;break;
    }
});

watch([cur_file_model], ()=>{
    if (!cur_file_model.value) return;
    selected_file.value = cur_file_model.value.name;
    selected_group.value = cur_file_model.value.group;
    switch (cur_file_model.value.group) {
        case AssetGroup.WALLS: selected_tool.value = "walls";break;
        case AssetGroup.ENEMIES: selected_tool.value = "enemies";break;
        case AssetGroup.ITEMS: selected_tool.value = "items";break;
        case AssetGroup.UI: selected_tool.value = "uigfx";break;
        case AssetGroup.DIALOGS: if (cur_file_model.value.name.endsWith(".HI"))
                                        selected_tool.value = "dialogshi";
                                break;        
        default: selected_tool.value = "";break;
    }    
})



</script>


<template>
    <div class="left-panel">
    <AssetsList v-model="cur_file_model" />
    </div>
    <div class="middle-panel">
        <select v-model="selected_tool">
            <option value="">--- choose tool ---</option>
            <option value="walls">Walls and arcs</option>
            <option value="items">Items</option>
            <option value="enemies">Enemies</option>
            <option value="uigfx">UI and other</option>
            <option value="dialogshi">Dialog portraits</option>
        </select>
        <div>
            <AssetsPcxView v-if="selected_tool == 'walls' || selected_tool=='items' || selected_tool=='enemies' || selected_tool=='uigfx'" v-model:file="selected_file" v-model:group="selected_group" />
        </div>
    </div>

</template>

<style scoped>
.left-panel {
    width: 15em;
    position: absolute;
    top: 2.25rem;
    bottom: 0px;
}
.middle-panel {
    left: 15em;
    position: absolute;
    top:2.25rem;
    bottom: 0;
    right: 0;
    text-align: center;
    background-color: #CCC;
}

.middle-panel > select {
    display: block;
    margin: 1em auto;
}

</style>