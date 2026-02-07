<script lang="ts" setup>
import {type DialogAction } from '@/core/dialog_structs';
import peggy from "peggy";
import globalState from '@/utils/global';
import { ref, computed, watch, onMounted, nextTick } from "vue";

type Pos = { row: number; col: number };
type Annotation = { from: Pos; to: Pos };

const text = ref("");

// jedna anotace
const annotation = ref<Annotation|null>(null);

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const mirrorRef = ref<HTMLDivElement | null>(null);
const overlayRef = ref<HTMLDivElement | null>(null);

const scrollTop = ref(0);
const scrollLeft = ref(0);

function onScroll() {
  if (!textareaRef.value) return;
  scrollTop.value = textareaRef.value.scrollTop;
  scrollLeft.value = textareaRef.value.scrollLeft;
}

/**
 * Přepočet anotace na DOM rect
 */
const highlightStyle = computed(() => {
  if (!mirrorRef.value || !annotation.value) return null;

  const { from, to } = annotation.value;
  const lines = text.value.split("\n");

  const startIndex =
    lines.slice(0, from.row - 1).join("\n").length +
    (from.row > 1 ? 1 : 0) +
    from.col - 1;

  const endIndex =
    lines.slice(0, to.row - 1).join("\n").length +
    (to.row > 1 ? 1 : 0) +
    to.col - 1;

  const textNode = mirrorRef.value.firstChild as Text;
  if (!textNode) return null;

  const range = document.createRange();
  range.setStart(textNode, startIndex);
  range.setEnd(textNode, endIndex);

  const rect = range.getBoundingClientRect();
  const containerRect = mirrorRef.value.getBoundingClientRect();

  return {
    top: rect.top - containerRect.top - scrollTop.value,
    left: rect.left - containerRect.left - scrollLeft.value,
    width: rect.width,
    height: rect.height,
  };
});

onMounted(() => {
    update_model();
    nextTick(onScroll);
});


const model = defineModel<DialogAction|null>();
const error_message = ref("");

const peggy_compiler = globalState("peggy_compiler", async ()=>{
    const txt = await (await fetch("dialogs.peggy")).text();
    return peggy.generate(txt);
})


function update_model() {
    if (model.value) {
        const cur = text.value;
        if (cur != model.value.source) {
            text.value = model.value.source;
        }
    }
}


async function compile_update() {
        const txt = text.value;     
        if (txt) {
            const compiler = await peggy_compiler;
            try {
                const ast = compiler.parse(txt);
                model.value = {ast:ast, source:txt};
                if (error_message.value) {
                    error_message.value ="";
                    annotation.value = null;
                }
            } catch (e) {
                console.log(e);
                const err = e as peggy.GrammarError;
                error_message.value = err.message;
                if (err.location) {
                    annotation.value = {
                        from:{row: err.location.start.line, col: err.location.start.column},
                        to:{row: err.location.end.line, col: err.location.end.column},
                    }
                }
            }        
        } else {
            model.value = {ast:null,source:""};
            error_message.value = "";
            annotation.value = null;
        }

}

let tm: number |string| NodeJS.Timeout | undefined;
function compile_update_delayed() {
    annotation.value = null;
    if (tm !== undefined)  clearTimeout(tm);
    tm = setTimeout(()=>{
        tm = undefined;
        compile_update();
    }, 1000);
}
function compile_update_now() {
    if (tm !== undefined)  clearTimeout(tm);
    tm = undefined;
    compile_update();
}

watch(text, compile_update_delayed);

watch(model, update_model);



</script>
<template>
<div v-bind="$attrs">
    <div class="wrapper">
        <!-- textarea -->
        <textarea ref="textareaRef" spellcheck="false" v-model="text" @scroll="onScroll" @change="compile_update_now" class="textarea"/>
        <!-- mirror -->
        <div ref="mirrorRef" class="mirror"> {{ text }} </div>
        <!-- overlay -->
        <div ref="overlayRef" class="overlay" v-if="annotation">
        <div v-if="highlightStyle" class="highlight"
            :style="{
                top: highlightStyle.top + 'px',
                left: highlightStyle.left + 'px',
                width: highlightStyle.width + 'px',
                height: highlightStyle.height + 'px'
            }"
        />
        </div>
    </div>
    <p class="error" v-if="error_message">{{ error_message }}</p>
</div>
</template>

<style lang="css" scoped>
.wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  font-family: monospace;
}

/* textarea */
.textarea {
  position: absolute;
  inset: 0;
  resize: none;
  font: inherit;
  line-height: 1.1;
  background: transparent;
  color: black;
  z-index: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}

/* mirror text (neviditelný) */
.mirror {
  position: absolute;
  inset: 0;
  font: inherit;
  line-height: 1.1;
  white-space: pre-wrap;
  word-wrap: break-word;
  visibility: hidden;
  z-index: 1;
  padding: 2px;
}

/* overlay */
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  overflow: hidden;
}

/* anotace */
.highlight {
  position: absolute;
  background: rgba(255, 0, 0, 0.35);
  border-radius: 4px;
  filter: blur(0.3px);
}

div {
    display: flex;
    flex-direction: column;
}

pre > :deep(em) {
    color: red;
}



p.error {
    margin: 0;
    padding: 0;
    background-color: rgb(255, 219, 219);
    color: red;
}
</style>