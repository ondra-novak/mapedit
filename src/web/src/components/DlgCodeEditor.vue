<script lang="ts" setup>
import { type DialogAction } from '@/core/dialog_structs';
import  {parse}  from '@/generated/parser'

import { ref, computed, watch, onMounted, nextTick } from "vue";

type Pos = { row: number; col: number };
type Annotation = { from: Pos; to: Pos };

const text = ref("");

const emit = defineEmits<{
  (e: 'focus'): void
  (e: 'blur'): void
}>()

function onFocus() {
  emit('focus')
}

function onBlur() {
  emit('blur')
}

function paste_str(value: string) {
    const el = textareaRef.value;
    if (value && el) {
        const beg = el.selectionStart;
        const end = el.selectionEnd;
        text.value = el.value.substring(0, beg) + value + el.value.substring(end);
        nextTick(() => {
            el.selectionEnd = el.selectionStart = end + value.length;
            compile_update_now()
        });


    }
}

defineExpose({ paste_str });

// jedna anotace
const annotation = ref<Annotation | null>(null);

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


const model = defineModel<DialogAction | null>();
const error_message = ref("");



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
        try {
            const ast = parse(txt);
            model.value = { ast: ast, source: txt };
            if (error_message.value) {
                error_message.value = "";
                annotation.value = null;
            }
        } catch (e) {
            if (e && typeof e === "object" && "message" in e) {
                const err = e as { message: string; location?: any };

                error_message.value = err.message;

                if (err.location?.start && err.location?.end) {
                    annotation.value = {
                        from: {
                            row: err.location.start.line,
                            col: err.location.start.column,
                        },
                        to: {
                            row: err.location.end.line,
                            col: err.location.end.column,
                        },
                    };
                }
            }
        }
    } else {
        model.value = { ast: null, source: "" };
        error_message.value = "";
        annotation.value = null;
    }

}

let tm: number | NodeJS.Timeout | null = null;
function compile_update_delayed() {
    annotation.value = null;
    if (tm !== null) clearTimeout(tm);
    tm = setTimeout(() => {
        tm = null;
        compile_update();
    }, 1000);
}
function compile_update_now() {
    if (tm !== null) clearTimeout(tm);
    tm = null;
    compile_update();
}

watch(text, compile_update_delayed);

watch(model, update_model);



</script>
<template>
    <div v-bind="$attrs">
        <div class="wrapper">
            <!-- textarea -->
            <textarea ref="textareaRef" spellcheck="false" v-model="text" @scroll="onScroll"
                @change="compile_update_now" class="textarea" @focus="onFocus" @blur="onBlur"/>
            <!-- mirror -->
            <div ref="mirrorRef" class="mirror"> {{ text }} </div>
            <!-- overlay -->
            <div ref="overlayRef" class="overlay" v-if="annotation">
                <div v-if="highlightStyle" class="highlight" :style="{
                    top: highlightStyle.top + 'px',
                    left: highlightStyle.left + 'px',
                    width: highlightStyle.width + 'px',
                    height: highlightStyle.height + 'px'
                }" />
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

pre> :deep(em) {
    color: red;
}



p.error {
    margin: 0;
    padding: 0;
    background-color: rgb(255, 219, 219);
    color: red;
}
</style>