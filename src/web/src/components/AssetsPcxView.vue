<script setup lang="ts">
import { ApiClient, type FileItem } from '@/core/api';
import { AssetGroup, type AssetGroupType } from '@/core/asset_groups';
import { extractImageData, findQuantizationAndGeneratePalette } from '@/core/image_manip';
import { PCX, PCXProfile, type PCXProfileType } from '@/core/pcx';
import { ref, watch, onMounted, computed, defineEmits } from 'vue';

const filename = defineModel<string | null>("file");
const group = defineModel<AssetGroupType | null>("group");

const new_file = ref<File | null>();
const new_filename = ref<string>("");


const canvasWrapper = ref<HTMLDivElement | null>(null);

const api : ApiClient = new ApiClient();

const emit = defineEmits<{
  (e: 'upload', name: string): void
}>();

function determineProfile(file:string, group:AssetGroupType, pcx?: PCX) : PCXProfileType {
    switch (group) {
        case AssetGroup.WALLS: return (pcx && pcx.width == 640)?PCXProfile.default:PCXProfile.wall;
        case AssetGroup.ITEMS: return PCXProfile.item;
        case AssetGroup.ENEMIES: return PCXProfile.enemy;
        default: return PCXProfile.default;                                
    }
}

async function load_file(file: string, group: AssetGroupType) {
    try {
        const data = await api.getDDLFile(file);
        const pcx = PCX.fromArrayBuffer(data.buffer);
        return pcx.createCanvas(determineProfile(file, group, pcx));
    } catch (e) {
        alert(e);
    }    
}

function make_name(name: string) : string {
    let stem = name.split(".")[0].substring(0,8).toUpperCase();
    return `${stem}.PCX`
}


function onSelectFile(event: Event) {
  const target = event.target as HTMLInputElement
  // pokud není nic vybráno, target.files může být null nebo prázdné
  if (target.files && target.files.length > 0) {
        const file = target.files[0];
        new_file.value = file;
        new_filename.value = make_name(file.name);
  } else {
        new_file.value = null;
  }
}

async function  onUpdate() {
    if (canvasWrapper.value) {
        canvasWrapper.value.innerHTML = ''
        if (!filename.value|| group.value === null) {
            
        } else {
            new_filename.value = filename.value || "";
            const canvas = await load_file(filename.value || "", group.value || 0);;
            if (canvas) canvasWrapper.value.appendChild(canvas);
        }
    }
}


watch([filename,group],onUpdate);
    
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
                    if (canvasWrapper.value) {
                        canvasWrapper.value.innerHTML="";
                        canvasWrapper.value.appendChild(pcx.createCanvas(grp));
                    }
                    const arrbuf = pcx.toArrayBuffer();
                    if (new_filename.value) {
                        api.putDDLFile(new_filename.value, arrbuf, group.value || 0);
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

<x-form>
        <label><span>Target image name (PCX)</span><input type="text" v-model="new_filename" maxlength="12"></label>
        <label><span>Local image </span><input type="file" @change="onSelectFile" accept="image/*"></label>
        <label><span></span><button @click="start_upload">Upload</button></label>
</x-form>
<div>
<div ref="canvasWrapper" class="checkerboard"></div>
</div>
</div>
</template>

<style  scoped>
.checkerboard {
  width: max-content;  
  display: inline-block;
  background-color: #fff;
  background-image: 
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  border: 1px solid;
  font-size: 0;
}
.split {
    display:flex;
    flex-wrap: wrap;
    justify-content: space-around;
}

.split > div:first-child  {
    width: 40%;    
}
</style>