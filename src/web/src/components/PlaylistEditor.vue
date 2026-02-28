<script lang="ts" setup>
import { server } from '@/core/api';
import { AssetGroup } from '@/core/asset_groups';
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import DelayLoadedList from './DelayLoadedList.vue';
import { watch } from 'vue';


const playlist = defineModel<string>();
const new_track = ref<string>();
const emit = defineEmits<{
  (e: 'change'): void
}>()

function onChange() {
  emit('change')
}



interface ParsedPlaylist {
    control:string;
    tracks: string[];    
}

const parsed_playlist = reactive<ParsedPlaylist>({control:"",tracks:[]});

function parse_playlist() {
    const tracks = (playlist.value ?? "").split(" ").filter(s=>s);
    let  control = "";
    if (tracks.length && 
        (tracks[0] == "FORWARD" || tracks[0] == "RANDOM" || tracks[0] == "FIRST")) {
            control = tracks.shift() ?? "";
        }
    parsed_playlist.control = control;
    parsed_playlist.tracks = tracks;
}

watch(playlist, ()=>{
    parse_playlist();
})

let tm: number | NodeJS.Timeout | null =  null;

watch(parsed_playlist, ()=>{
        const s = [];
        const x = parsed_playlist;
        if (x) {
            if (x.control) s.push(x.control);
            s.push(...x.tracks);
        }
        playlist.value = s.join(" ");
        if (tm) clearTimeout(tm);
        tm = setTimeout(onChange,10);

}, {deep:true});


function stdlist() : string[] {
    const r : string[] = [];
    for (let i = 1; i <= 13; ++i) {
        r.push(`TRACK${i<10?'0':''}${i}.MUS`)
    }
    return r;
}   

async function load_music() : Promise<{value: string}[]> {
    const tracks = await server.getDDLFiles(AssetGroup.MUSIC);
    return tracks.files.map(f=>f.name).concat(stdlist()).map(f=>({value:f}))
    
}

const music = load_music();

watch(new_track, (nw)=>{
    if (nw && parsed_playlist) {
        parsed_playlist.tracks.push(nw);
        nextTick(()=>{
            new_track.value = "";
        });
    }
})

function remove_track(idx:number) {
    const newlist = parsed_playlist.tracks.slice(0,idx).concat(parsed_playlist.tracks.slice(idx+1));
    parsed_playlist.tracks =newlist;
}

onMounted(parse_playlist);

</script>
<template>
<div v-bind="$attrs">
    <div class="lst" v-if="parsed_playlist">
        <select v-model="parsed_playlist.control">
            <option value="">(select order)</option>
            <option value="FIRST">first->random</option>
            <option value="FORWARD">In order</option>            
            <option value="RANDOM">Random</option>
        </select>
        <div  v-for="(s,idx) of parsed_playlist.tracks" :key="s" @click="remove_track(idx)">
            {{ s }}
        </div>
        <DelayLoadedList v-model="new_track" :list="music" />
    </div>
</div>
</template>
<style lang="css" scoped>
.lst {
    display:flex;
    flex-wrap: wrap;
    gap: 0.2rem;
}
.lst > div {
    border: 1px solid;
    background-color: white;
    padding: 0.2rem;    
    cursor: pointer;
}
.lst > div::before {
    content: "x";
    font-weight: bold;
    display:inline-block;
    margin-right: 0.2rem;
    width: 1rem;
    text-align: center;
    color:red;
}
</style>
