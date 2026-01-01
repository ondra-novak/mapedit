<script setup lang="ts">
import { CharacterStats } from '@/core/common_defs';

const model = defineModel<number[]>({default: []});

const props = defineProps<{
    enemy?: boolean;
    changes?: boolean;
}>();

const min0 = props.changes?-32767:0
const min100 = props.changes?-100:0

</script>
<template>
 <x-form>
        <label><span>Strength</span><input v-model="model[CharacterStats.VLS_SILA]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label><span>Magic</span><input v-model="model[CharacterStats.VLS_SMAGIE]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label><span>Speed</span><input v-model="model[CharacterStats.VLS_POHYB]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label><span>Dexterity</span><input v-model="model[CharacterStats.VLS_OBRAT]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label><span>Max hitpoints</span><input v-model="model[CharacterStats.VLS_MAXHIT]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label v-if="!enemy"><span>Max vitality</span><input v-model="model[CharacterStats.VLS_KONDIC]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label v-if="!enemy"><span>Max mana</span><input v-model="model[CharacterStats.VLS_MAXMANA]" type="number" v-watch-range :min="min0" max="32767" /></label>
        <label><span>Attack</span><div><input type="number" v-model="model[CharacterStats.VLS_UTOK_L]" v-watch-range :min="min0" max="32767"/>-<input type="number" v-model="model[CharacterStats.VLS_UTOK_H]" v-watch-range :min="min0" max="32767"/></div></label>
        <label><span>Defese</span><div><input type="number" v-model="model[CharacterStats.VLS_OBRAN_L]" v-watch-range :min="min0" max="32767"/>-<input type="number" v-model="model[CharacterStats.VLS_OBRAN_H]" v-watch-range :min="min0" max="32767"/></div></label>
        <label><span>Magic attack</span><div><input type="number" v-model="model[CharacterStats.VLS_MGSIL_L]" v-watch-range :min="min0" max="32767"/>-<input type="number" v-model="model[CharacterStats.VLS_MGSIL_H]" v-watch-range :min="min0" max="32767"/></div></label>
        <label><span>Magic attack type</span><div><select v-model="model[CharacterStats.VLS_MGZIVEL]">
            <option value="-1">--select--</option>
            <option value="0">fire</option>
            <option value="1">water</option>
            <option value="2">earth</option>
            <option value="3">air</option>
            <option value="4">mind</option>
        </select></div></label>
        <label><span>Extra damage</span><input v-model="model[CharacterStats.VLS_DAMAGE]" type="number" v-watch-range min="-10000" max="10000" /></label>
        <label><span>Protection fire</span><input v-model="model[CharacterStats.VLS_OHEN]" type="number" v-watch-range min="-100" max="100" /></label>
        <label><span>Protection water</span><input v-model="model[CharacterStats.VLS_VODA]" type="number" v-watch-range min="-100" max="100" /></label>
        <label><span>Protection earth</span><input v-model="model[CharacterStats.VLS_ZEME]" type="number" v-watch-range min="-100" max="100" /></label>
        <label><span>Protection air</span><input v-model="model[CharacterStats.VLS_VZDUCH]" type="number" v-watch-range min="-100" max="100" /></label>
        <label><span>Protection mind</span><input v-model="model[CharacterStats.VLS_MYSL]" type="number" v-watch-range min="-100" max="100" /></label>
        <label><span>Regeneration hit points</span><input v-model="model[CharacterStats.VLS_HPREG]" type="number" v-watch-range :min="min100" max="100" /></label>
        <label v-if="!enemy"><span>Regeneration vitality</span><input v-model="model[CharacterStats.VLS_VPREG]" type="number" v-watch-range :min="min100" max="100" /></label>
        <label v-if="!enemy"><span>Regeneration mana</span><input v-model="model[CharacterStats.VLS_MPREG]" type="number" v-watch-range :min="min100" max="100" /></label>
    </x-form></template>
<style scoped lang="css">
input[type=number] {
    width: 5rem;
    box-sizing: border-box;
    text-align: right;
}
</style>