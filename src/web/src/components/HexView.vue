<template>
  <x-workspace>
    <!-- Offset input -->
    <div class="stk">
        <button @click="offset = Math.max(0,offset-MAX_BYTES)" :disabled="offset == 0">&lt;&lt;</button>
      <label >Offset (hex):
      <input
        v-model="offsetInput"
        @input="parseOffset"
        class="addrinput"
      /> / 0x{{  buffer.byteLength.toString(16) }}</label>
      <button @click="offset = Math.min(buffer.byteLength-BYTES_PER_LINE,offset+MAX_BYTES)" :disabled="offset >= buffer.byteLength-BYTES_PER_LINE">&gt;&gt;</button>
    </div>

    <!-- HEX view -->
    <div class="hexview">
      <div v-for="(line, index) in lines" :key="index">
        {{ line }}
      </div>
    </div>
  </x-workspace>
</template>

<style scoped>
.hexview{
    font-family: monospace;;
    white-space: pre;
    text-align: left;
    width: fit-content;
    margin: auto;
}

.addrinput {
    width: 10em;
    text-align: center;
}
.stk {
    position: sticky;
    top: 0;
    background-color: #ccc;
    border-bottom: 1px solid;
    display: flex;
    justify-content: space-around;
}

</style>

<script lang="ts" setup>
import { server } from '@/core/api';
import { ref, computed, defineProps, watch, onMounted } from 'vue'

const filename = defineModel<string>();

const buffer = ref<ArrayBuffer>(new ArrayBuffer(0));

const MAX_BYTES = 4096
const BYTES_PER_LINE = 16

const offsetInput = ref('0x0')
const offset = ref(0)

function parseOffset() {
  const val = offsetInput.value.trim().toLowerCase()
  const num = parseInt(val.startsWith('0x') ? val : '0x' + val, 16)
  offset.value = isNaN(num) ? 0 : num
}

watch([offset], ()=>offsetInput.value = "0x"+(offset.value || 0).toString(16));
watch([buffer], ()=>offset.value = 0);
async function loadFile() {
    if (filename.value) {
        try {            
            buffer.value = (await server.getDDLFile(filename.value)).buffer;
        } catch (e) {
            alert(e);
        }
    }
}

watch(offsetInput, parseOffset, { immediate: true })
watch([filename], loadFile);

onMounted(loadFile);


const lines = computed(() => {
  const bytes = new Uint8Array(buffer.value)
  const start = Math.min(offset.value, bytes.length)
  const end = Math.min(start + MAX_BYTES, bytes.length)
  const result: string[] = []

  for (let i = start; i < end; i += BYTES_PER_LINE) {
    const chunk = bytes.slice(i, Math.min(i + BYTES_PER_LINE, end))

    let hex = Array.from(chunk)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')

    const ascii = Array.from(chunk)
      .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('')

    const offsetStr = i.toString(16).padStart(8, '0')
    const paddedHex = hex.padEnd(BYTES_PER_LINE * 3 - 1, ' ')

    result.push(`${offsetStr}  ${paddedHex}      ${ascii}`)
  }

  return result
})
</script>
