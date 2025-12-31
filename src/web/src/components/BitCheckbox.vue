<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { watch } from 'vue';


const state = ref(false);
const model = defineModel<number>();
const props = defineProps<{
    mask:number
}>();   

watch(state, (newVal) => {
    const m = model.value || 0;
    let value = newVal ? (m | props.mask) : (m & ~props.mask);
    model.value = value;
});

function syncState() {
    const m = model.value || 0;
    state.value = (m & props.mask) !== 0;
}   

watch(model, syncState, { immediate: true });
onMounted(syncState);

</script>
<template>
  <input type="checkbox" v-model="state" v-bind="$attrs"/>
</template>
