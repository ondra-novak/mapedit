<script setup lang="ts">
import AssetsList from '../components/AssetsList.vue'
import { ref, watch, onMounted, computed, defineEmits } from 'vue';

const selected_tool = ref<string>("");

watch([selected_tool], ()=>{console.log(selected_tool.value)});

</script>


<template>
    <div class="left-panel">
    <AssetsList />
    </div>
    <div class="middle-panel">
        <select v-model="selected_tool">
            <option value="">--- choose tool---</option>
            <option value="pcxwall">Walls and arcs</option>
            <option value="floorceil">Floor and ceils</option>
            <option value="enemyimg">Enemy graphics</option>
            <option value="enemyseq">Enemy sequence</option>
            <option value="enemycol">Enemy color palletes</option>
            <option value="itemgfx">Items graphics</option>
            <option value="itemicon">Items icons</option>
            <option value="othergfx">Other graphics</option>
            <option value="sft">Sound effects</option>
        </select>
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