<script setup lang="ts">
import SoundControl from '@/utils/sound';
import { onMounted, onUnmounted, ref, watch } from 'vue';


const props = defineProps<{
    name:string
}>();


const  playing = ref(false);

function start_sound() {
    const s = props.name;
    if (s) {
        SoundControl.play(s);
        playing.value = true
    } else {
        playing.value = false;
    }
}

function stop_sound() {
    SoundControl.stop();
    playing.value = false;
}

onMounted(start_sound);
onUnmounted(()=>SoundControl.stop());
watch(()=>props.name, start_sound);

</script>
<template>
<div class="panel">
    <div>Music player:</div>
    <div>{{ name }}</div>
    <button :disabled="!playing"  @click="stop_sound">Stop</button>
    <button :disabled="playing" @click="start_sound">Play</button>
</div>
</template>

<style lang="css" scoped>
.panel {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    gap: 0.2rem;
}
.panel > * {
    flex-grow: 1;
}
</style>