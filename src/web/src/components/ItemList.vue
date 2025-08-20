<script lang="ts" setup>
import type { ItemDef } from '@/core/items_struct';
import globalGetItems from '@/utils/global_item_list';
import { onMounted, ref} from 'vue';


const itmlist = defineModel<number[]>();
const list_html_id = ref('itemlist-' + Math.random().toString(36).substring(2, 9));
const item_templates = ref<ItemDef[]>();
const cur_inv_item = ref<string>("");


const props = defineProps<{
    filter?: (item: ItemDef) => boolean
}>();


function delete_item(event: Event, idx: number) {
    if (itmlist.value) {
        itmlist.value.splice(idx,1);
        event.stopPropagation();
        event.preventDefault();
    }
}

function set_item_by_name(event: Event, arr:number[], pos:number) {
    const t = event.target as HTMLInputElement;
    const v = t.value.trim();            
    if (v) {
        const match = v.match(/#(\d+)$/);
        if (match) {
            const num = parseInt(match[1]);
            if (!isNaN(num)) {
                arr[pos] = num;
                t.value = get_item_name(num);
                return;
            }
        } else if (item_templates.value) {
            const f = item_templates.value.findIndex(x=>x.jmeno.trim() == v);
            if (f != -1) {
                arr[pos] = f;
                t.value = get_item_name(f);
                return;
            }
        }
    } else {
        delete arr[pos];
    }
    t.value = get_item_name(arr[pos]);
}


function get_item_name(idx: number) : string{
    if (idx === undefined) return "";
    if (item_templates.value) {
        const v = item_templates.value[idx];
        if (v) return v.jmeno;                
        else return `#${idx}`;
    } else {
        return "???";
    }
}

function add_item_to_inv(event: Event) {
    const c : number[] = [];
    set_item_by_name(event,c,0);
    if (c[0] && itmlist.value) {
        itmlist.value.push(c[0]);
        (event.target as HTMLInputElement).value="";
        cur_inv_item.value = "";
    }
}

function add_item_to_inv_enter(event: Event) {
    const e = event as KeyboardEvent;
    if (e.key == "Enter") {
        e.stopPropagation();
        e.preventDefault();
        add_item_to_inv(e);
    }
}

onMounted(async ()=>{
     item_templates.value = await globalGetItems();

});

import { computed } from 'vue';

const filtered_items = computed(() => {
    if (!item_templates.value) return [];
    if (typeof props.filter === 'function') {
        return item_templates.value.filter(props.filter);
    }
    return item_templates.value;
});

</script>
<template>
 <datalist :id="list_html_id"><option v-for="(v,idx) of filtered_items" :key="idx" :value="`${v.jmeno.trim()} #${idx}`"></option></datalist>
<div class="itemlist"><div v-if="item_templates" v-for="(v,idx) of itmlist" :title="`#${v}`">{{ get_item_name(v) }}<button @click="$event=>delete_item($event, idx)">×</button></div>
        <div> {{  cur_inv_item }}
        <input type="text" v-model="cur_inv_item" :list="list_html_id" placeholder="add item" 
        @keydown="$event=>add_item_to_inv_enter($event)" @change="$event=>add_item_to_inv($event)">
        </div>
</div>
</template>
<style lang="css" scoped>

.itemlist {
    display:flex;
    flex-wrap: wrap;
    gap: 2px;    
}
.itemlist > div {
    border: 1px solid;
    background-color: aliceblue;
    padding: 0 0 0 0.2rem;
    position: relative;
}
.itemlist  button {
    margin-left: 0.2rem;
    border: 0;
}
.itemlist input {
    position: absolute;
    left: 0;top: 0; right: 0;
}
.itemlist > div:last-child {
    padding-right: 3rem;
    white-space: nowrap;
    min-width: 3rem;
    border: 0;
    height: 1rem;
}
</style>