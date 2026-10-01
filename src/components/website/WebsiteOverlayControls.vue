<script setup lang="ts">
import type { ImageSettings } from '../../../functions/src/websiteContent'
const props = defineProps<{ value?: ImageSettings }>()
const emit = defineEmits<{ update: [value: ImageSettings] }>()
function set(key: keyof ImageSettings, value: string | number) {
  emit('update', { ...props.value, [key]: value })
}
</script>
<template>
  <details>
    <summary>Image overlay and gradient</summary>
    <label
      >Overlay style<select
        aria-label="Overlay style"
        :value="value?.overlayMode || 'solid'"
        @change="set('overlayMode', ($event.target as HTMLSelectElement).value)"
      >
        <option value="solid">Solid tint</option>
        <option value="linear">Directional gradient</option>
      </select></label
    >
    <label
      >Overlay color<input
        type="color"
        :value="value?.overlay || '#000000'"
        @input="set('overlay', ($event.target as HTMLInputElement).value)"
    /></label>
    <label
      >Overlay opacity: {{ value?.overlayOpacity || 0 }}%<input
        type="range"
        aria-label="Overlay opacity"
        min="0"
        max="80"
        :value="value?.overlayOpacity || 0"
        @input="set('overlayOpacity', ($event.target as HTMLInputElement).valueAsNumber)"
    /></label>
    <label v-if="value?.overlayMode === 'linear'"
      >Gradient direction: {{ value?.overlayAngle ?? 90 }}°<input
        type="range"
        aria-label="Gradient direction"
        min="0"
        max="360"
        :value="value?.overlayAngle ?? 90"
        @input="set('overlayAngle', ($event.target as HTMLInputElement).valueAsNumber)"
    /></label>
  </details>
</template>
<style scoped>
label {
  display: grid;
  gap: 4px;
  margin: 8px 0;
}
input,
select {
  width: 100%;
  min-width: 0;
  font: inherit;
  color: inherit;
  background: var(--field);
  border: 1px solid var(--border);
}
summary {
  cursor: pointer;
  font-weight: 600;
}
</style>
