<script setup lang="ts">
import type { AssetConfiguration, GlobalPaletteConfiguration } from '@/core/map_structs';
import { toRaw, watch } from 'vue';
import { onMounted, ref } from 'vue';


const props = defineProps<{
    palette: GlobalPaletteConfiguration<AssetConfiguration> 
}>();

const emit = defineEmits<{
    (e:'addmodify',item:AssetConfiguration|null, index: number):void
}>();

const model = defineModel<AssetConfiguration|null>();

const cur_index = ref<number>(-1);

function updateModel() {
    if (model.value) {
        const idx = props.palette.list.findIndex(x=>model.value?.get_key() == x.get_key());
        if (idx < 0) {
            cur_index.value = 0;
        } else {
            cur_index.value = idx+2;
        }
    } else {
        cur_index.value = 0;
    }
}
onMounted(updateModel);
watch(model, updateModel);

watch(cur_index, (x)=>{
    if (x == 1) {
        emit("addmodify",null,-1);
        return;
    } else if (x == 0) {
        model.value = null;        
    } else {
        model.value = props.palette.list[x-2];
    }        
})

function on_dbl_click() {
    if (cur_index.value == 1) {
        emit("addmodify",null,-1);
        return;
    } else if (cur_index.value > 1) {
        let idx = cur_index.value-2;
        emit("addmodify",props.palette.list[idx],idx);
    }
}
function on_key_down(ev: Event) {
    const kev  = ev as  KeyboardEvent;
    if (kev.key == "Enter") {
        on_dbl_click();
        kev.stopPropagation();
        kev.preventDefault();
    }
}

</script>
<template>
<select v-bind="$attrs" v-model.number="cur_index" @dblclick="on_dbl_click" @keydown="on_key_down">
    <option :value="0">(none)</option>
    <option :value="1">Add new ...</option>
    <option v-for="(itm, idx) of palette.list" :key="idx" :value="idx+2">{{ itm.get_name() }}</option>
</select>
</template>