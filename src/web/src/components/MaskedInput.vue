<template>
  <input
    v-bind="$attrs"
    ref="inputEl"
    :value="modelValue"
    @beforeinput="onBeforeInput"
    @input="onInput"
    @paste.prevent="onPaste"
  />
</template>

<script setup lang="ts">
import { ref, nextTick } from "vue";

const modelValue = defineModel<string>();

const props = defineProps<{
  mask: RegExp;
}>();


const inputEl = ref<HTMLInputElement | null>(null);
let lastValidValue = modelValue.value;

function isValid(v: string) {
 if (!v) return true;
  return props.mask.test(v);
}

function onBeforeInput(e: InputEvent) {
  if (!inputEl.value) return;

  // mazání / undo necháme projít
  if (e.inputType.startsWith("delete") || e.inputType === "historyUndo") {
    return;
  }

  const el = inputEl.value;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;

  const inserted = e.data ?? "";
  const nextValue =
    el.value.slice(0, start) + inserted + el.value.slice(end);

  if (!isValid(nextValue)) {
    e.preventDefault();
  }
}

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value;

  if (isValid(v)) {
    lastValidValue = v;
    modelValue.value =v;
  } else {
    // fallback – vrátíme poslední validní stav a zachováme kurzor
    const el = e.target as HTMLInputElement;
    const pos = el.selectionStart ?? v.length;

    modelValue.value = lastValidValue;

    nextTick(() => {
      if (!inputEl.value) return;
      inputEl.value.setSelectionRange(pos - 1, pos - 1);
    });
  }
}

function onPaste(e: ClipboardEvent) {
  if (!inputEl.value) return;

  const paste = e.clipboardData?.getData("text") ?? "";
  const el = inputEl.value;

  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;

  const nextValue = el.value.slice(0, start) + paste + el.value.slice(end);

  if (isValid(nextValue)) {
    modelValue.value = nextValue;
  }
}
</script>
