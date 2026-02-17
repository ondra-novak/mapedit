<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';


const model = defineModel<any>()

let cur_list : {value: (string|number), label?:string}[] = [];

const props = defineProps<{
    list: {value: any, label?:string}[]|Promise<{value: any, label?:string}[]>;
}>();

const elref = ref<HTMLSelectElement>();

async function updateList() {
    const el = elref.value;
    if (!el) return;
    const lst = await Promise.resolve(props.list);
    if (!lst) return ;
    const v = model.value;
    
    while (el.options.length) el.options.remove(0);
    let found_idx = -1;
    lst.forEach((item,idx) => {
        const option = document.createElement('option');
        if (item.value === model.value) found_idx = idx;
        option.textContent = item.label ?? String(item.value);
        el.options.add(option);
    });
    el.selectedIndex = found_idx;
    cur_list = lst;
}

function selectionChanged() {
    const el = elref.value;
    if (!el) return;
    let idx = el.selectedIndex;
    if (idx < 0) model.value = undefined;
    else model.value = cur_list[idx].value;    
}

watch([elref, ()=>props.list],updateList);
watch(model, ()=>{
    if (elref.value) {
        const v = model.value;
        const idx = cur_list.findIndex(x=>x.value === v);
        elref.value.selectedIndex = idx;
    }
})
onMounted(updateList);

</script>
<template>
<select v-bind="$attrs" ref="elref" @change="selectionChanged"></select>
</template>