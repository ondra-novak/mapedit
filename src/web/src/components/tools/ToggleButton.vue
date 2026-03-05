<script setup lang="ts">
import { computed } from 'vue'


interface Props {
  modelValue: boolean | undefined
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const isActive = computed(() => props.modelValue)

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    :class="['toggle-btn', { active: isActive, disabled }]"
    :aria-pressed="isActive"
    :disabled="disabled"
    @click="toggle"
  >
    <slot />
  </button>
</template>

<style scoped>
.toggle-btn {
  border: 1px solid black;
  background: #f3f3f3;
  cursor: pointer;
  transition: all 0.15s ease;
}


.toggle-btn.active {
  background: rgb(120, 22, 22);
  color: white;
  font-weight: bold;
  border-color: rgb(120, 22, 22);;
}

.toggle-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>