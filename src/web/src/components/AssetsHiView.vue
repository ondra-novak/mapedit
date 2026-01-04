<script setup lang="ts">
import { server} from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { make_dosname } from '@/core/dosname';
import HIFormat from '@/core/hiformat';
import { ref, watch, onMounted, computed} from 'vue';

import  SkeldalImage from "@/components/SkeldalImage.vue"
import type  { ImageModel } from "@/components/SkeldalImage.vue"

const filename = defineModel<string | null>();

const new_file = ref<File | null>();
const new_filename = ref<string>("");

const image = ref<ImageModel>();


const emit = defineEmits<{
  (e: 'upload', name: string): void
}>();


async function load_file(file: string) {
    try {
        const data = await server.getDDLFile(file);
        const pic = HIFormat.fromArrayBuffer(data);
        return pic.createCanvas();
    } catch (e) {
        alert(e);
    }    
}


function onSelectFile(event: Event) {
  const target = event.target as HTMLInputElement
  // pokud není nic vybráno, target.files může být null nebo prázdné
  if (target.files && target.files.length > 0) {
        const file = target.files[0];
        new_file.value = file;
        new_filename.value = make_dosname(file.name,".HI");
  } else {
        new_file.value = null;
  }
}

async function  onUpdate() {
    image.value = {
        name:filename.value || "",
        group:AssetGroup.DIALOGS
    };
    new_filename.value = filename.value || "";

}


watch([filename],onUpdate);
    
onMounted(()=>{
    onUpdate();
})

async function start_upload() {
    if (new_file.value) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const hi = await HIFormat.fromImage(img);
                    const arrbuf = hi.toArrayBuffer();
                    if (new_filename.value) {
                        server.putDDLFile(new_filename.value, arrbuf, AssetGroup.DIALOGS);
                        emit("upload",new_filename.value);                        
                        onUpdate();
                    }
                } catch (e) {
                    alert(e);
                }
            };
            if (e.target && typeof e.target.result === 'string') {
                img.src = e.target.result;
            }
        };
        reader.readAsDataURL(new_file.value);
    }
}

</script>

<template>
<div class="split">

<div>
<x-form>
        <label><span>Target image name (HI)</span><input type="text" v-model="new_filename" class="centered" maxlength="12"></label>
        <label><span>Local image </span><input type="file" @change="onSelectFile" accept="image/*"></label>
        <label><span></span><button @click="start_upload">Upload</button></label>
</x-form>
<div class="rec">
<p>Required resolutions</p>
<dl>
    <dt>Dialogs:</dt><dd>340x200</dd>
    <dt>Shops:</dt><dd>264x180</dd>
</dl>
</div>
</div>
<div>
<SkeldalImage v-model="image"/>
</div>
</div>
</template>

<style  scoped>

.split {
    display:flex;
    flex-wrap: wrap;
    justify-content: space-around;
}

.split > div:first-child  {
    width: 40%;    
}
.rec {
    text-align: left;
}
dt {
    font-weight: bold;
    margin-top: 0.5em;
}

</style>