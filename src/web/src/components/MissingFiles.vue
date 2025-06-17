<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
import { readFileToArrayBuffer } from '@/core/read_file';
import { computed, onMounted, ref, watch } from 'vue';



const props = defineProps<{
    files: FileItem[]
    
}>();

const emit = defineEmits<{
    (e: 'imported'): void,
    (e: 'created_new'): void
}>();



interface FileAssign {
    name: FileItem;
    file: File | null;
}

const file_assign = ref<FileAssign[]>([]);


async function check() {
    const files = (await server.getDDLFiles(null, "user")).files;
    if (!props.files) return;
    file_assign.value = props.files.filter(n=>{
        const idx = files.findIndex(m=>m.name == n.name);
        return idx == -1;
    }).map(x=>({name:x, file:null}));
}

onMounted(check);
watch(props, check, {deep:true});

function getExtension(n:string) {
    const idx = n.lastIndexOf('.');
    return n.substring(idx);
}

function assign_import_file(event: Event, a: FileAssign) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length ==0) return;    
    const f =  target.files[0];
    if (!f || f.name.toUpperCase() != a.name.name.toUpperCase()) a.file = null;
    else a.file = f;
}

const import_disabled = computed(()=>{
    if (!file_assign.value) return false;
    return file_assign.value.findIndex(n=>n.file === null) != -1;
});

async function import_files() {
    if (!file_assign.value) return;
    const prms = file_assign.value.map(a=>{
        if (a.file === null) throw new Error("Some file is not assigned: "+a.name);
        return readFileToArrayBuffer(a.file).then(bin=>{
            return server.putDDLFile(a.name.name,bin,a.name.group)
        });
    })
    await Promise.all(prms);
    await check();
    if (file_assign.value.length == 0) emit("imported");
}

function create_new_project() {
    file_assign.value = [];
    emit("created_new");
}

</script>
<template>
        <div class="files-not-found" v-if="file_assign.length">
        <p>Some files are missing. Do you want to import them from the original game</p>
        <x-form>
            <label v-for="v of file_assign" :class="{isok: !!v.file}">
                <span>{{ v.name.name }}</span>
                <input type="file" @change="event =>assign_import_file(event, v)" :accept="getExtension(v.name.name)">
            </label>
        </x-form>
        <div class="button-panel"><button @click="import_files" :disabled="import_disabled">Import files</button><button @click="create_new_project">Create new files</button></div>
    </div>

</template>

<style scoped>

.files-not-found{
    position: absolute;
    left: 50%;
    top: 10vw;
    width: 25em;
    margin-left: -10em;
    border: 1px solid;
    background-color: white;
    text-align: center;
    box-shadow: 3px 3px 5px black;
}

.files-not-found x-form {
    padding: 0 2em;
}
.files-not-found x-form > label > input {
    width: 65%;
}

label.isok::after{
    content: "✓";
    display: block;
    color: green;
    position: absolute;
    right: 0;
    top: 0;
    font-size: 1.5em;
}

.files-not-found .button-panel {
    border-top: 1px solid;
    margin-top: 1em;
    padding: 0.5em;
    display: flex;
    justify-content: space-between;
    flex-direction: row-reverse;
    
}


</style>