<script setup lang="ts">
import { bb2html } from '@/core/bb2html';
import { onMounted, ref, watch } from 'vue';


const htmltext = ref<HTMLElement>() 

const model = defineModel<string>({default: ""});

const props = defineProps<{
    format?: ("BBCode"|"Book"|"HTML")
}>()



let built_model = "";

function model2html() {

    const editor = htmltext.value!;

    built_model = model.value;

    if (props.format == "BBCode") {
        editor.innerHTML = "";
        editor.appendChild(bb2html(built_model))
    } else if (props.format == "Book") {

    } else if (props.format == "HTML") {
        htmltext.value!.innerHTML = built_model;
    }
}


function bb_walk_recursive(iter: ChildNode | null, parts: string[]) {
    function putnl_ifneeded() {
        if (parts.length && parts[parts.length-1] != '\n') {
            parts.push('\n');
        }
    }

    while(iter) {
        switch(iter.nodeType) {
            case Node.TEXT_NODE: parts.push(iter.nodeValue as string);break;
            case Node.ELEMENT_NODE: switch ((iter as HTMLElement).tagName) {
                case "B": parts.push("[b]"); 
                          bb_walk_recursive(iter.firstChild, parts);
                          parts.push("[/b]"); 
                          break;
                case "I": parts.push("[i]"); 
                          bb_walk_recursive(iter.firstChild, parts);
                          parts.push("[/i]"); 
                          break;
                case "U": parts.push("[u]"); 
                          bb_walk_recursive(iter.firstChild, parts);
                          parts.push("[/u]"); 
                          break;
                case "A": parts.push("[url="); 
                          parts.push((iter as HTMLAnchorElement).href);
                          parts.push("]");
                          bb_walk_recursive(iter.firstChild, parts);
                          parts.push("[/url]"); 
                          break;
                case "IMG": parts.push("[img]",(iter as HTMLImageElement).src,"[/img]");break
                case "PRE":
                case "TT": if (iter.textContent) parts.push("[code]",iter.textContent,"[/code]");break;
                case "HR": parts.push("[hr]");break
                case "DIV": 
                          putnl_ifneeded()
                          bb_walk_recursive(iter.firstChild, parts);
                          putnl_ifneeded()
                          break;
                case "P": parts.push('\n');
                          bb_walk_recursive(iter.firstChild, parts);
                          putnl_ifneeded()
                          break;
                case "BR":
                          parts.push("\n");
                          break;
                case "UL":
                          parts.push("[list]");
                          bb_walk_recursive(iter.firstChild, parts);
                          parts.push("[/list]");
                          break;
                case "LI":parts.push("[*]");
                          bb_walk_recursive(iter.firstChild, parts);
                          break;

                    
                default: bb_walk_recursive(iter.firstChild, parts);break;

            };break;
        }
        iter = iter.nextSibling;
    }
}


function handle_shortcuts(iter: ChildNode|null) {
    const p = iter?.parentElement;
    if (!p) return;
    let x = iter;;    
    while (iter) {
        x = iter;
        iter = iter.nextSibling;
    }

    if (x) {
        if (x.nodeType == Node.ELEMENT_NODE) {
            const el = x as HTMLElement;
            if ((el.tagName == "DIV" || el.tagName == "P") && el.textContent == '-') {
                p.removeChild(x);
                const list = document.createElement('UL');
                const li = document.createElement('LI');
                list.appendChild(li);
                p.appendChild(list);
            }
        }
    }
}
function build_model() {
    const editor = htmltext.value!;
    const parts :string[] = [];
    handle_shortcuts(editor.firstChild);
    if (props.format == "BBCode") {
        bb_walk_recursive(editor.firstChild, parts);
    } else if (props.format == "HTML"){

    } else {
        parts.push(editor.innerHTML);
    }
    built_model = parts.join("").trim();
    model.value = built_model;
}

onMounted(()=>model2html)
watch(model, (nw)=>{
    if (nw != built_model) {
        model2html();
    }
});

</script>
<template>
<div contenteditable="true" @input="build_model" ref="htmltext" v-bind="$attrs">

</div>
</template>
<style lang="css" module>

</style>