<script setup lang="ts">
import { SpellEffectName, SpellEffects } from '@/core/common_defs';
import BitCheckbox from './BitCheckbox.vue';


const model = defineModel<number>();

</script>
<template>
    <x-form>
        <label v-for="(v, idx) of Object.values(SpellEffects)" :key="idx">
            <BitCheckbox v-model="model" :mask="v"/>
            <span> {{ SpellEffectName[idx] }}</span>
        </label>
    </x-form>
</template>
<style lang="css" scoped>

</style>