<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';
import { getMessageBoxRefData, type MessageBoxData } from './messageBox';


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
            window.addEventListener("keydown", on_keyboard_enter);
        }
    } else {
            window.removeEventListener("keydown", on_keyboard_enter);
    }
})



</script>
<template>
    <template v-if="dlg">
    <div class="dark">
    <div class="popup">
        <div>
            <div class="msg"><div v-for="ln of dlg.message.split('\n')"> {{ ln  }}</div></div>
            <div class="buttons"><button v-for="(v,idx) of dlg.buttons" :key="idx" @click="on_button_click(idx)">{{ v }}</button></div>
        </div>
    </div>
    </div>
    </template>

</template>

<style scoped>
.dark {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    background-color: #0008;
}
.popup {
    position: fixed;
    left: 0;
    right: 0;
    top: 30vh;
    text-align: center;
    width: fit-content;
    margin: auto;
    border: 1px solid;
    background-color: white;
    box-shadow: 3px 3px 5px black;    
}

.popup .msg {
    text-align: left;
    padding: 1rem;
}

.popup .msg > div{
    min-height: 1rem;
}

.buttons {
    border-top: 1px solid;
    padding: 0.5rem;
    background-color: #ccc;
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    align-items: stretch;
}

.buttons > button {
    min-width: 5em;
}
</style>