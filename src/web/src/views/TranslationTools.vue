<script lang="ts" setup>

</script>
<template>
    <x-workspace>
    <div class="notes">
        <h2>Multilingual adventure</h2>
        <p>Unfortunately, the current format does not allow for multiple languages ​​to be supported in a single adventure. 
            To create a language variant, you need to create a copy and translate all the texts. The following tool was created for this purpose:</p>
        <p>There are two operations available</p>
        <dl>
            <dt>Export of all texts</dt>
            <dd>
                Exports all texts to a CSV table. The table can be opened in Excel.
                 You need to replace the text in each row with the translation while 
                 preserving the other columns that contain the reference where the text is located.
            </dd>
            <dt>
                Import translated texts
            </dt>
            <dd>
                Perform this operation on a copy of the adventure,
                 it will replace all texts according to the translation table
            </dd>
        </dl>
    </div>
    </x-workspace>
</template>
<style lang="css" scoped>
</style>