<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppIconButton from '@/components/common/AppIconButton.vue'

const props = withDefaults(defineProps<{ zoom: number; fitLabel?: string }>(), { fitLabel: 'Fit' })
const emit = defineEmits<{ change: [zoom: number] }>()
function change(delta: number) {
  emit('change', Math.max(0.5, Math.min(3, props.zoom + delta)))
}
</script>

<template>
  <div class="document-zoom-controls" role="group" aria-label="Document zoom">
    <AppIconButton label="Zoom out" :disabled="zoom <= 0.5" @click="change(-0.25)">-</AppIconButton>
    <AppButton variant="ghost" :aria-label="fitLabel" @click="emit('change', 1)">Fit</AppButton>
    <AppIconButton label="Zoom in" :disabled="zoom >= 3" @click="change(0.25)">+</AppIconButton>
  </div>
</template>

<style scoped>
.document-zoom-controls {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}
.app-button {
  min-height: 2rem;
  padding: 0 0.65rem;
}
</style>
