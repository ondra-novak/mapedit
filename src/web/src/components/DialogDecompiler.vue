<script lang="ts" setup>
import { server } from '@/core/api';
import { DialogDef } from '@/core/dialog_structs';
import { onMounted } from 'vue';


async function load_dlg() {
    const data = await server.getDDLFile("DIALOGY.DAT");
    const dd = new DialogDef();
    dd.load_from_buffer(data);
}


onMounted(load_dlg);

</script>
<template>
Dialog decompiler
</template>
<style lang="css" scoped>

</style>