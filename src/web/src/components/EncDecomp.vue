<script lang="ts" setup>
import { server } from '@/core/api';
import type { AssetGroupType } from '@/core/asset_groups';
import { ref, watch } from 'vue';



var model_file = defineModel<string>();
var props = defineProps<{group: AssetGroupType}>();
const dis = ref<boolean>(false);


async function decode() {

    if (model_file.value && props.group !== undefined) {
        const data = await server.getDDLFile(model_file.value);
        const b = new Uint8Array(data);
        let last = 0;
        const dec = b.map(x=>{
            last = (last + x) & 0xFF;
            return last;
        })
        const new_file_name = model_file.value.replace(/\.[^/.]+$/, ".TXT");
        await server.putDDLFile(new_file_name, dec.buffer, props.group);
        dis.value = true;
    }
}

watch(model_file,()=>{
    dis.value = false;
})

</script>
<template>
    <x-workspace>
        <div>
            <button :disabled="dis" @click="decode()">Decrypt ENC</button>
        </div>
    </x-workspace>
</template>
<style lang="css" scoped>
div {
    text-align: center;;
}
</style>