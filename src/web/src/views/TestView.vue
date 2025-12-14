<script lang="ts" setup>
import MultiactionEditor from '@/components/MultiactionEditor.vue';
import { ActionType, create_action_instance, TMA_TEXT, type TMA_GEN } from '@/core/map_structs';
import { onMounted, ref, triggerRef } from 'vue';



const initial_script = ref<TMA_GEN[]>([]);


onMounted(()=>{            
//    initial_script.value = [... initial_script.value , create_action_instance(ActionType.TEXTL, 0xFFFF)];   
})


</script>

<template>

<div class="workspace">
<MultiactionEditor v-model="initial_script"> </MultiactionEditor>
</div>


</template>

<style lang="css" scoped>

.workspace {
    border: 1px solid;
    width: 200px;
    height: 400px;
}

</style>