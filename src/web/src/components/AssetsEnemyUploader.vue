<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ImageModel } from './SkeldalImage.vue';
import { server, type FileItem } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import SkeldalImage from './SkeldalImage.vue';
import { messageBoxAlert } from '@/utils/messageBox';
import ProgressBar from './tools/progressBar';
import { readFileToArrayBuffer, readFileToImage } from '@/core/read_file';
import { extractImageData, findQuantizationAndGeneratePalette } from '@/core/image_manip';
import { ColorLUT } from '@/core/lut';
import { PCX } from '@/core/pcx';
import { dosname_sanitize } from '@/core/dosname';
import { COLPaletteSet } from '@/core/col_palette_set';


const filename = defineModel<string | null>();

const image = computed(() : ImageModel =>{
    return {group: AssetGroup.ENEMIES,name:filename.value ?? "EMPTY.PCX"}
});

const base = ref<string>("");

const selected_files = ref<FileList | null>();

function onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement
    // pokud není nic vybráno, target.files může být null nebo prázdné
    if (target.files && target.files.length > 0) {
        //check whether all files have the same base name (first 6 characters)
        let base_n : string|null = null;
        for (let i = 0; i < target.files.length; i++) {
            const file = target.files[i];
            const [name, ext] = file.name.split(".",2);
            if (name.length < 3) {
                messageBoxAlert(`A file '${file.name}' has invalid name. There is no base name`);
                return
            }
            const base_name = file.name.substring(0, 6);
            if (base_n === null) {
                 base_n = base_name;
            } else if (base_name != base_n) {
                messageBoxAlert(`A file '${file.name}' has different base. Expected '${base_n}', found '${base_name}'`);
                selected_files.value = null;
            }
        }
        selected_files.value = target.files;
        base.value = base_n ?? "";
        adjust_base();        
    } else {
        selected_files.value = null;
    }
}
const emits = defineEmits<{
    (e:"switch_to",name:FileItem):void
}>();


async function run() {
    const flist = selected_files.value;
    if (!flist) return;    
    const col = await run_files(flist,base.value);
    if (col) emits("switch_to", {group: AssetGroup.ENEMIES, name: col},);
}


async function run_files(lst: FileList, base: string) {


    let canceled: boolean = false;

    const pg = await ProgressBar.open();
    pg.set_title("Processing, please wait...");
    pg.set_text("Uploading files");
    pg.set_cancel_callback(()=>canceled = true);

    try {

        const images : {imgdata:ImageData,name:string}[] = [];

        for (let i = 0; i < lst.length; ++i) {
            pg.set_value(i/(lst.length*2));
            const f = lst[i];
            const ab = await readFileToImage(f);
            const imgdata = await extractImageData(ab);
            const name = f.name;
            images.push({imgdata, name});
            if (canceled) {
                pg.close();
                return;
            }
        }

        pg.set_text("Calculating");
        await new Promise(x=>setTimeout(x,10));  //update screen

        const pal1 = findQuantizationAndGeneratePalette(images.map(x=>x.imgdata),127,173,255)
        const pal2 = findQuantizationAndGeneratePalette(images.map(x=>x.imgdata),128,85,172)
        const lut1 = new ColorLUT(pal1, 6);
        const lut2 = new ColorLUT(pal2, 6);
        pal1.unshift([0,0,0]);          
        let pal = pal1.concat(pal2);
        const results = images.map(x=>{        
            const pcx = new PCX(x.imgdata.width, x.imgdata.height);
            pcx.set_palete(pal);
            pcx.clear(0);
            pcx.convertImageData(x.imgdata, lut1, 1, 173, 255);
            pcx.convertImageData(x.imgdata, lut2, 128, 85, 172);

            const [n,_] = x.name.split(".",2);
            const id = n.substring(n.length-2, n.length);
            const newname = dosname_sanitize(`${base}${id}.pcx`);

            return {pcx,newname};    

        })
        
        pg.set_text("Converting images");

        for (let i = 0; i < results.length; ++i) {
            pg.set_value((i+results.length)/(2*results.length));
            const r = results[i];
            await server.putDDLFile(r.newname, r.pcx.toArrayBuffer(),AssetGroup.ENEMIES);
            if (canceled) {
                pg.close();
                return;
            }
        }

        pg.set_text("Creating palette");
        const cols = new COLPaletteSet;
        cols.addPalette(pal);
        const col_name = dosname_sanitize(`${base}.COL`);
        await server.putDDLFile(col_name,cols.toArrayBuffer(),AssetGroup.ENEMIES);

        pg.close();
        return col_name;
    } catch (e) {
        messageBoxAlert(`Error: ${(e as Error).message}`);
        pg.close();
        return null;
    }
}

function adjust_base() {
    if (base.value !== undefined) {
        let v = dosname_sanitize(base.value.substring(0,6));
        while (v.length < 6) {
            v = v + '_';
        }
        base.value = v;
    }
}

</script>
<template>
<x-workspace>
<div class="panel">
<div class="prw">
<SkeldalImage v-model="image" />
</div>
<x-section>
    <x-section-title>Upload enemy animation</x-section-title>
    <p>It is necessary to upload all sequences at once. This is because the images share a single color palette and this palette is calculated across all uploaded images.</p>
    <p>Prepare pictures that have the name in the following pattern</p>
    <pre class="note pattern"><strong>ABCDEF</strong><u>nn</u>.png</pre>
    <p>Where <strong>ABCDEF</strong> is the enemy ID and <u>nn</u> are any distinguishing numbers or letters. 
        It is of course a good idea to number the images in the order they follow each other in the animation 
        and label them appropriately to distinguish the individual phases.</p>

    <x-form>
        <label><span>Select multiple files</span><input type="file" multiple="true" @change="onFileSelected" accept="image/*"></label>
        <label><span>Files</span><select size="8">
            <option v-for="v of Array.prototype.map.call(selected_files ?? [],x=>x.name)"> {{ v }}</option>
        </select></label>
        <label><span>Base name:</span><input type="text" maxlength="6" v-model="base" @change="adjust_base"></label>
        <div>
            <button @click="run" :disabled="!base.length || !selected_files?.length">Upload and convert</button>
            <div>(overwrites existing files)</div>
        </div>
    </x-form>
</x-section>
</div>
</x-workspace>
</template>
<style lang="css" scoped>
.prw {
    float:right;
}
x-section {
    display: inline-block;
    max-width: 30rem;
}

</style>