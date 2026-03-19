<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import ProgressBar from './progressBar';


const dlg = ref<HTMLDialogElement>();
interface Attrs {
    title: string;
    text: string;
    value: number;
    error: boolean;
    cancel_cb: (()=>void)|null;
    close_butt: boolean;
};

function default_attrs() : Attrs{
return {
    title:"Processing...",
    text: "",
    value: 0,        
    cancel_cb:null,
    close_butt:false,
    error:false
}
};

const attrs = reactive<Attrs>(default_attrs());

function close() {
    dlg.value?.close();
}

function open() {    
    Object.assign(attrs,default_attrs());
    dlg.value?.showModal();
}

function set_value(n:number) {attrs.value = n;}
function set_text(s:string) {attrs.text = s;}
function set_title(s:string) {attrs.title = s;}
function set_error_state(e:boolean) {attrs.error = e;}
function set_cancel_callback(cb: (()=>void)|null) {attrs.cancel_cb = cb;}
function close_by_user() {attrs.close_butt = true;}

function init() {
    ProgressBar.set_implementation({
        set_value,
        set_text,
        set_title,
        set_error_state,
        set_cancel_callback,
        close,
        close_by_user,
        open,

    })
}

onMounted(init);

</script>


<template>

<dialog ref="dlg" class="progress" :class="{error: attrs.error}">
    <header> {{ attrs.title }} </header>
    <div class="temp"><div :style="{width: `${(attrs.value*100).toFixed(1)}%`}"></div></div>
    <div> {{ attrs.text }}</div>        
    <footer>
        <button v-if="attrs.close_butt" @click="close">Close</button>
        <button v-else :disabled="!attrs.cancel_cb" @click="attrs.cancel_cb!()">Cancel</button>        
    </footer>
</dialog>

</template>
<style lang="css" scoped>

.progress {
    width: 35rem;
}

.temp {
    border: 1px solid;
    margin: 0.5rem 0;
}

.temp > * {
    height: 1.5rem;
    margin-left: 0;
    margin-right: auto;
    background-color: green;
}

.progress.error .temp > * {
    background-color: red;
}

.progress.error {
    color: red;
}

</style>