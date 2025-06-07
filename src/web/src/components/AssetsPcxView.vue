<script setup lang="ts">
import { server, type FileItem } from '@/core/api';
import { AssetGroup, type AssetGroupType } from '@/core/asset_groups';
import { make_dosname } from '@/core/dosname';
import { extractImageData, findQuantizationAndGeneratePalette } from '@/core/image_manip';
import { PCX} from '@/core/pcx';
import  SkeldalImage from "@/components/SkeldalImage.vue"
import type  {ImageModel } from "@/components/SkeldalImage.vue"
import { ref, watch, onMounted, computed, defineEmits } from 'vue';
import { determineProfile } from '@/core/pcx_profle';

const filename = defineModel<string | null>("file");
const group = defineModel<AssetGroupType | null>("group");

const new_file = ref<File | null>();
const new_filename = ref<string>("");

const image = ref<ImageModel>();

const enemy_side = ref<string>();
const enemy_seq = ref<number>();


const emit = defineEmits<{
  (e: 'upload', name: string): void
}>();

function load_file(file: string, group: AssetGroupType) {
    image.value = {name:file, group:group};
    new_filename.value = file;
}


function onSelectFile(event: Event) {
  const target = event.target as HTMLInputElement
  // pokud není nic vybráno, target.files může být null nebo prázdné
  if (target.files && target.files.length > 0) {
        const file = target.files[0];
        new_file.value = file;
        new_filename.value = make_dosname(file.name,".PCX");
  } else {
        new_file.value = null;
  }
}

function  onUpdate() {
    if (filename.value && group.value) {
        load_file(filename.value, group.value);
        if (group.value == AssetGroup.ENEMIES && filename.value.length>8) {
            const side = filename.value[6];
            const seq = filename.value[7];
            if (seq>='0' && seq <= '9') enemy_seq.value = seq.charCodeAt(0)-48;
            else if (seq>='A' && seq <='F') enemy_seq.value = seq.charCodeAt(0)-55;
            enemy_side.value = side;
        }
    }
}

function onUpdateSideSeq() {
    if (group.value == AssetGroup.ENEMIES && enemy_seq.value) {
        let f= new_filename.value || "";
        let p = f.split('.');
        let n = p[0];
        while (n.length<6) n = n + "_";
        n = n.substring(0,6);
        n = n + enemy_side.value;
        n = n + String.fromCharCode(enemy_seq.value+(enemy_seq.value> 9?55:48));
        p[0] = n;
        new_filename.value = p.join('.');        
    }
}

watch([filename,group],onUpdate);
watch([enemy_seq, enemy_side], onUpdateSideSeq);
    
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
                    const grp = determineProfile(new_filename.value, group.value || AssetGroup.UNKNOWN);
                    const pcx = await PCX.fromImage(img, grp);
                    const arrbuf = pcx.toArrayBuffer();
                    if (new_filename.value) {
                        server.putDDLFile(new_filename.value, arrbuf, group.value || 0);
                        load_file(new_filename.value, group.value || 0);
                        emit("upload",new_filename.value);                        
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
        <label><span>Target image name (PCX)</span><input type="text" v-model="new_filename" maxlength="12"></label>    
        <template v-if="group==AssetGroup.ENEMIES">
        <label><span>Phase / Sequence</span><div><select v-model="enemy_side">
            <option value="F">Front</option>
            <option value="L">Left</option>
            <option value="R">Right</option>
            <option value="B">Back</option>
            <option value="C">Attack</option>
            <option value="H">Damaged</option>
            </select>
            <input type="number" v-model="enemy_seq" size="2" style="width: 3em;text-align: center;" min="0" max="35"></div></label>
        </template>
        <label><span>Local image </span><input type="file" @change="onSelectFile" accept="image/*"></label>
        <label><span></span><button @click="start_upload">Upload</button></label>
</x-form>
<div class="rec">
<p>Recommended resolutions</p>
<dl>
    <dt>Wall front</dt>
    <dd>500x320 (origin:bottom)</dd>
    <dt>Wall side</dt>
    <dd>(min)75x320 (origin: bottom) </dd>
    <dt>Tall wall front:</dt>
    <dd> 500x750 (origin:bottom)</dd>
    <dt>Tall Wall side</dt>
    <dd> (min)75x750 (origin: bottom) </dd>
    <dt>Floor: </dt>
    <dd>640x199</dd>
    <dt>Ceil: </dt>
    <dd>640x93</dd>
    <dt>Enemy:</dt>
    <dd> max 500x320 (origin: top)</dd>
    <dt>Game screen:</dt>
    <dd> 640x480 (origin: top)</dd>
</dl>

</div>
</div>
<div>
<SkeldalImage v-model="image" />
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