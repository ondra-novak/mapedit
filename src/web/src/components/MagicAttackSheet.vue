<script setup lang="ts">
import { CharacterStats, ElementTypeName } from '@/core/common_defs';
import { computed } from 'vue';
import BitCheckbox from './BitCheckbox.vue';

const model = defineModel<number[]>({default: []});


const element = computed({
    get:()=>model.value[CharacterStats.VLS_MGZIVEL] & 0xFF,
    set:(x:number)=>model.value[CharacterStats.VLS_MGZIVEL] =(model.value[CharacterStats.VLS_MGZIVEL] & ~0xFF) | x,
})

</script>
<template>
 <x-form>
            <label><span>Magic attack</span><div><input type="number" v-model="model[CharacterStats.VLS_MGSIL_L]" v-watch-range :min="0" max="32767"/>-<input type="number" v-model="model[CharacterStats.VLS_MGSIL_H]" v-watch-range :min="0" max="32767"/></div></label>
            <label><span>Magic attack type</span><div><select v-model="element">
                <option v-for="(v,idx) of ElementTypeName" :key="idx" :value="idx"> {{ v }}</option>
            </select></div></label>
            <label><span>Magic dmg. need phys.dmg (attacker)</span><bit-checkbox v-model="model[CharacterStats.VLS_MGZIVEL]" :mask="0x100" /></label>
            <label><span>Magic dmg. need phys.dmg (defeder)</span><bit-checkbox v-model="model[CharacterStats.VLS_MGZIVEL]" :mask="0x200" /></label>
            <label><span>Only magic dmg. (defender)</span><bit-checkbox v-model="model[CharacterStats.VLS_MGZIVEL]" :mask="0x400" /></label>
    </x-form>
</template>
<style scoped lang="css">
input[type=number] {
    width: 5rem;
    box-sizing: border-box;
    text-align: right;
}
</style>