<template>
  <div ref="container"></div>
</template>

<script lang="ts" setup>
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  canvas: HTMLCanvasElement | null
}>()

const container = ref<HTMLDivElement | null>(null)

onMounted(() => {
  if (props.canvas && container.value) {
    container.value.appendChild(props.canvas)
  }
})

watch(
  () => props.canvas,
  (newCanvas) => {
    if (container.value) {
      container.value.innerHTML = ''
      if (newCanvas) {
        container.value.appendChild(newCanvas)
      }
    }
  }
)
</script>
