<script setup lang="ts">
import { ApiClient, type FileItem } from '@/core/api';
import { AssetGroup, type AssetGroupType } from '@/core/asset_groups';
import { PCX, PCXProfile, type PCXProfileType } from '@/core/pcx';
import { ref, watch, onMounted, computed, defineEmits } from 'vue';

const filename = defineModel<string | null>("file");
const group = defineModel<AssetGroupType | null>("group");

const canvas = ref<HTMLCanvasElement | null>(); 
const new_file = ref<File | null>();
const new_filename = ref<string>("");

const canvasWrapper = ref<HTMLDivElement | null>(null);

const api : ApiClient = new ApiClient();

function determineProfile(file:string, group:AssetGroupType, pcx: PCX) : PCXProfileType {
    switch (group) {
        case AssetGroup.WALLS: return pcx.width == 640?PCXProfile.default:PCXProfile.wall;
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
    new_file.value = target.files[0]
    if (!new_filename.value)  {
        new_filename.value = make_name(target.name);
    }
  } else {
        new_file.value = null;
  }
}

async function  onUpdate() {
    if (canvasWrapper.value) {
        canvasWrapper.value.innerHTML = ''
        if (filename.value === null || group.value === null) {
            
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

</script>

<template>
<div class="split">

<x-form>
        <label><span>Target image name (PCX)</span><input type="text" v-model="new_filename"></label>
        <label><span>Local image </span><input type="file" @change="onSelectFile" accept="image/*"></label>
        <label><span></span><button>Upload</button></label>
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