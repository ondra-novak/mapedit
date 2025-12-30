<script lang="ts" setup>
import type { ItemDef } from '@/core/items_struct';
import { create_datalist, type DataListItem } from '@/utils/datalist';
import globalGetItems from '@/utils/global_item_list';
import { onMounted, ref, watch} from 'vue';


const itmlist = defineModel<number[]>();
const item_templates = ref<ItemDef[]>();
const cur_inv_item = ref<string>("");
const put_inside = ref(false);


const props = defineProps<{
    filter?: (item: ItemDef) => boolean;
    limit?: number;
    inside?: boolean;
}>();


function delete_item(event: Event, idx: number) {
    if (itmlist.value) {
        itmlist.value = [...itmlist.value.slice(0,idx),...itmlist.value.slice(idx+1)];
        event.stopPropagation();
        event.preventDefault();
    }
    put_inside.value = false;
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
        const adjidx = idx<0?(-idx-2):idx;
        const v = item_templates.value[adjidx];
        if (v) return v.jmeno;                
        else return `#${idx}`;
    } else {
        return "???";
    }
}

function is_inside(idx: number) {
    return idx < 0;
}

function add_item_to_inv(event: Event) {
    const c : number[] = [];
    set_item_by_name(event,c,0);
    if (c[0] && itmlist.value) {
        let v = c[0];
        if (put_inside.value && itmlist.value.length) v = (-v-2);
        itmlist.value = [...itmlist.value, v ];
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

function create_list() : DataListItem[]{
    if (!item_templates.value) return [];
    let itms;
    if (typeof props.filter === 'function') {
        itms =  item_templates.value.filter(props.filter);
    } else{
         itms = item_templates.value;
    }
    return itms.map((v,idx)=>{
        const n = `${v.jmeno.trim()} #${idx}`;
        return {value: n};
    })

}

const datalist = create_datalist(()=>create_list());
watch(item_templates, ()=>datalist.update());

</script>
<template>
<div class="itemlist"><div v-if="item_templates" v-for="(v,idx) of itmlist" :title="`#${v}`" :class="{inside: is_inside(v)}">{{ get_item_name(v) }}<button @click="$event=>delete_item($event, idx)">×</button></div>
        <div> {{  cur_inv_item }}
        <input v-if="typeof props.limit != 'number' || !itmlist || itmlist.length < props.limit" type="text" v-model="cur_inv_item" :list="datalist.id" placeholder="add item" 
        @keydown="$event=>add_item_to_inv_enter($event)" @change="$event=>add_item_to_inv($event)">
        </div>
</div>
<div v-if="props.inside && itmlist?.length"><input type="checkbox" v-model="put_inside"><span>put inside</span></div>
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
    min-width: 5rem;
    border: 0;
    height: 1.5rem;
}
.inside {
    font-style: italic;
}
.inside::before  {
    content: "...";
}
</style>