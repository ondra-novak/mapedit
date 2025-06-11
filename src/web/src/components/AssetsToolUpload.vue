<script lang="ts" setup>
import { server } from '@/core/api';
import { AssetGroup, AssetGroupLabel, type AssetGroupType } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { readFileToArrayBuffer } from '@/core/read_file';
import { onMounted, ref, watch } from 'vue';


const filename = defineModel<string | null>("file");
const download_link = ref<string>();
const group = defineModel<AssetGroupType>("group");


const new_filename = ref<string>("");
const new_file = ref<File | null>();
const new_group = ref<AssetGroupType>(AssetGroup.UNKNOWN);
const groups = ref(AssetGroupLabel);

const emit = defineEmits<{
  (e: 'upload', name: string): void
}>();

function set_new_file(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target && target.files) {
        const v = target.files[0];
        new_file.value = v;        
        if (!new_filename.value) {
            new_filename.value = dosname_sanitize(new_file.value.name);
        }
    }
}

async function do_upload() {
    if (!new_file.value || !new_filename.value || !new_group.value) return;
    try {
        const buffer = await readFileToArrayBuffer(new_file.value);
        await server.putDDLFile(new_filename.value, buffer, new_group.value);
        emit("upload", new_filename.value);
        new_filename.value = "";
        new_file.value = null;
    } catch (e) {
        alert(e);
    }
}

function updateModel() {
    if (filename.value) {
        download_link.value = server.getDownloadLink(filename.value);
    }
}

onMounted(updateModel);

watch([filename],updateModel);
watch([group],()=>new_group.value = group.value || AssetGroup.UNKNOWN);

</script>
<template>
<div class="download" v-if="download_link && filename">
    <h2>Download</h2>
    <a :href="download_link">Download file {{ filename }}</a>
</div>
<div class="upload">
    <h2>Upload</h2>
    <p>Upload already prepared binary file (no transformations are performed)</p>
    <x-form>
        <label><span>New file name:</span><input type="text" class="centered" v-model="new_filename" @input="new_filename = dosname_sanitize(new_filename)" maxlength="12"></label>
        <label><span>Group (type):</span><select v-model="new_group">
            <option v-for="(v,k) of groups" :value="k" :key="k">
                {{ v }}
            </option>
        </select></label>
        <label><span>Disk file</span><input type="file" @change="event => set_new_file(event)"></label>        
    </x-form>
    <button @click="do_upload" :disabled="!new_file || !new_filename">Upload</button>
</div>

</template>
<style scoped>
.download {
    border: 1px solid;
    padding: 1em;
    width: 20em;
    margin: auto;
    background-color: white;
}

.upload {
    border: 1px solid;
    padding: 1em;
    background-color: white;
    margin: 2em auto;
    width: 30em;
    
}
h2 {
    margin: 0 auto 1em auto;
    
}
input {
    text-align: center;
}

</style>