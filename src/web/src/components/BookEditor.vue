<script lang="ts" setup>
import Hive from '@/utils/hive';
import { watch } from 'vue';
import { onMounted, reactive } from 'vue';


interface BookRecord {
    text: string;
    topic: string;
};

class BookHive extends Hive<BookRecord> {

};

const model = defineModel<string>();
const section = /^\[([0-9]+)w?\]$/;
const hive = reactive(new BookHive);

function parseBook() {
    const txt = model.value;
    hive.clear();
    if (txt) {
        const lines =txt.split("\n").map(x=>x.trim());
        let idx = lines.findIndex(x=>!!x.match(section));
        while (idx != -1) {
            if (idx) lines.splice(0, idx);
            const mark = lines[0].match(section);
            if (mark && mark[1]) {
                const id = parseInt(mark[1]);
                lines.shift();
                const cpy : string[] =[];
                while (lines.length && lines[0] != "[]") {
                    cpy.push(lines.shift() ?? "");
                }
                let topic:string = "";
                if (cpy.length && cpy[0].startsWith("&TOPIC:")) {
                    topic = cpy[0].substring(7);
                    cpy.shift();
                }
                hive.set(id, {text:cpy.join("\n"),topic});                
            } else {
                lines.shift();
            }
            idx = lines.findIndex(x=>!!x.match(section));
        }
    }
}

function buildBook() {
    const out : string[] = [];
    hive.forEach((v,idx)=>{
        out.push(`[${idx}]`);
        if (v.topic) out.push(`&TOPIC:${v.topic}`);
        out.push(v.text);
        out.push("[]");
        out.push("");
    });
    model.value = out.join("\n");
}

onMounted(parseBook);
watch(model,parseBook);

</script>



<template>
{{ hive }}
 
</template>
<style lang="css" scoped>
</style>