<script setup lang="ts">
import BuilderDisclosureButton from './BuilderDisclosureButton.vue'
defineProps<{ addLabel: string; addExpanded: boolean; addControls: string; addDisabled?: boolean; actionLabel: string; actionExpanded: boolean; actionControls: string; actionDisabled?: boolean }>()
const emit = defineEmits<{ add: []; actions: [] }>()
</script>
<template>
  <div class="builder-editing-tools" role="group" aria-label="Editing tools">
    <BuilderDisclosureButton :label="addLabel" icon="pi-plus" :expanded="addExpanded" :controls="addControls" :disabled="addDisabled" @toggle="emit('add')" />
    <BuilderDisclosureButton :label="actionLabel" icon="pi-ellipsis-h" :expanded="actionExpanded" :controls="actionControls" :disabled="actionDisabled" @toggle="emit('actions')" />
  </div>
</template>
<style scoped>
.builder-editing-tools { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; gap: .5rem; margin-bottom: .75rem; }
</style>
