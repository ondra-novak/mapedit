<script setup lang="ts">

import StatusBar from "@/core/status_bar_control";
import { nextTick, ref, watch } from "vue";

const vis = StatusBar.visible;
const en = StatusBar.enabled;
const conf = ref<boolean>(false);

function show_confirm() {
    setTimeout(()=>{
        conf.value = true;
        const stp: Record<string,any> = {};

        const dismiss = () => {
            window.removeEventListener("click",dismiss);
            conf.value = false;
            stp.watch();
        }
        stp.watch = watch([en,vis,conf], dismiss);

        window.addEventListener("click", dismiss);
    },50);
}

function do_revert() {
    conf.value = false;
    StatusBar.triggerRevert();
}

</script>
<template>
    <div class="bar">
        <div class="left">

        </div>
        <div class="right">
            <button v-if="vis" :disabled="!en" @click="show_confirm">Revert</button>
            <button v-if="vis"  :disabled="!en" @click="StatusBar.triggerSave">Save</button>
            <div class="revert-confirm" v-if="conf">
                Confirm you want to revert changes <button @click="do_revert">Confirm</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.bar {
    display:flex;
    justify-content: space-between;
}

.right {
    display: flex;
    gap: 0.2rem;
    height: 2rem;
}

.right > button {
    width: 6rem;
    font-size: 1.1rem;
}

.revert-confirm {
    position: absolute;
    right: 7em;
    bottom: 2.5em;
    border: 1px solid;
    background-color: white;
    padding: 1rem;

}
</style>