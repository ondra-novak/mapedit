<script lang="ts" setup>
import { server } from '@/core/api';
import { AssetGroup, AssetGroupLabel, type AssetGroupType } from '@/core/asset_groups';
import { dosname_sanitize } from '@/core/dosname';
import { readFileToArrayBuffer } from '@/core/read_file';
import { computed, onMounted, ref, watch } from 'vue';


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
    if (!new_file.value || !new_filename.value || new_group.value === undefined) return;
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

async function updateModel() {
    if (filename.value) {
        download_link.value = server.get_download_link(filename.value);
    }
    if (group.value !== undefined) {
        new_group.value = group.value;
    }
}

const file_list = ref<FileList|null>(null);
const progress_percent = ref<number>();
const skip_existing = ref(false);

function set_new_multiple_files(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target && target.files) {
        file_list.value = target.files;
    }
}

async function do_upload_multiple() {
    if (file_list.value) {
        let list = file_list.value;
        file_list.value = null;
        if (list) {
            for (let n = 0; n < list.length; ++n) {
                const item = list[n];
                const name = dosname_sanitize(item.name).slice(0,12);
                const data = await readFileToArrayBuffer(item);
                try {
                    await server.putDDLFile(name, data, new_group.value, skip_existing.value);
                } catch (e) {
                    console.warn(e);
                }
                progress_percent.value = 100 * n/list.length;
            }
        }

    }
}

const not_ready_for_upload_multiple = computed(()=>!(file_list.value?.length));

const multiple_files_list = ref<string[]>([]);
const multiple_files_selected = ref<string[]>([]);
const download_multi = ref<HTMLDialogElement>();
const multiple_files_download_pending = ref<boolean>(false);

async function begin_multiple_download() {
    download_multi.value?.showModal();
    multiple_files_selected.value = [];
    multiple_files_list.value = [];    
    const lst = await server.getDDLFiles()
    lst.files.forEach(x=>multiple_files_list.value.push(x.name));
    if (filename.value) multiple_files_selected.value.push(filename.value);    
}

async function download_zip() {
    multiple_files_download_pending.value = true;
    const response = await fetch('/api/ddl', {
      method: 'POST',
      headers: {'Content-Type': 'application/json' },      
      body: JSON.stringify(multiple_files_selected.value) 
    });

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const now = new Date();
    const datetime = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    const a = document.createElement('a');
    a.href = url;
    a.download = `mapedit_${datetime}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    multiple_files_download_pending.value = false;
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
<div class="download">
    <button @click="begin_multiple_download">Multiple files download</button>
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
<div class="upload">
    <h2>Multiple files upload</h2>
    <p>Upload already prepared binary files (no transformations are performed). Ensure they have also correct names</p>
    <x-form>
        <label><span>Group (type):</span><select v-model="new_group">
            <option v-for="(v,k) of groups" :value="k" :key="k">
                {{ v }}
            </option>
        </select></label>
        <label><span>Disk files</span><input type="file" @change="event => set_new_multiple_files(event)" multiple="true"></label>        
        <label><span></span><input type="checkbox" v-model="skip_existing">Skip existing items</label>
    </x-form>
    <button @click="do_upload_multiple" :disabled="not_ready_for_upload_multiple">Upload</button>
    <div v-if="progress_percent" class="progress">
        <div :style="{width: `${progress_percent}%`}"></div>
    </div>
</div>
<dialog ref="download_multi">
    <header>Download multiple files</header>
    <x-form>
        <label>Select multiple files</label><select size="20" v-model="multiple_files_selected" multiple :disabled="multiple_files_download_pending">
            <option v-for="f of multiple_files_list" :value="f"> {{ f }}</option>
        </select>
    </x-form>
    <footer>
        <button @click="download_zip" :disabled="multiple_files_download_pending"> Download ZIP </button><button @click="download_multi?.close()"> Close </button>
    </footer>
</dialog>

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
.progress {
    border: 1px solid;
    width: 400px;    
    height: 2em;
    margin: 2em auto;
}

.progress > div {
    background-color: green;
    height: 100%;
}

</style>