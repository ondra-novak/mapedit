<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { getMessageBoxRefData, type MessageBoxData } from './messageBox';
import { ref } from 'vue';


const dlg = getMessageBoxRefData();


function on_button_click(idx: number) {
    if (dlg.value) {
        dlg.value.selected(idx);
        dlg.value = undefined;
    }
}

function on_keyboard_enter(event : Event) {
    if (!dlg.value) {
        window.removeEventListener("keydown", on_keyboard_enter);
        return;
    }
    const e = event as KeyboardEvent;
    if (e.key == "Enter"){
        if (dlg.value.default_button  !== undefined) {
            on_button_click(dlg.value.default_button);        
        } else if (dlg.value.buttons.length < 2) {
            on_button_click(0);        
        }
        e.preventDefault();
        e.stopPropagation();
    } else if (e.key == "Escape") {
        if (dlg.value.cancel_button !== undefined) {
            on_button_click(dlg.value.cancel_button);        
        } else if (dlg.value.default_button  !== undefined) {
            on_button_click(dlg.value.default_button);      
        }
        e.preventDefault();
        e.stopPropagation();
    }
}

watch(dlg, (new_val, old_val)=>{
    if (new_val) {
        if (!old_val) {
            dlg_ref.value!.showModal();
        }
    } else {
        dlg_ref.value!.close();
    }
})

const dlg_ref = ref<HTMLDialogElement>();

watch(dlg_ref, ()=>{
    if (dlg_ref.value) {
        dlg_ref.value.addEventListener("keydown", on_keyboard_enter);
    }
})


</script>
<template>
    <dialog ref="dlg_ref">
        <template v-if="dlg">
        <header>
            {{  dlg.title }}
        </header>
        <div class="msg"><div v-for="ln of dlg.message.split('\n')"> {{ ln  }}</div></div>
        <footer>
            <button v-for="(v,idx) of dlg.buttons" :key="idx" @click="on_button_click(idx)">{{ v }}</button>
        </footer>
        </template>
    </dialog>
</template>
<style lang="css" scoped> 
.msg {
    max-width: 40rem;
    padding: 1rem;
}
.msg > div {
    min-height: 1rem;
}
</style>
