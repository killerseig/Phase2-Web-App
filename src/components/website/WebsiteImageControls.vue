<script setup lang="ts">
import type { ImageSettings } from '../../../functions/src/websiteContent'
import WebsiteOverlayControls from './WebsiteOverlayControls.vue'
const props = defineProps<{ value?: ImageSettings }>()
const emit = defineEmits<{ update: [value: ImageSettings | undefined] }>()
function change(key: keyof ImageSettings, event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.validity.valid) return
  emit('update', {
    ...props.value,
    [key]: input.type === 'range' ? Number(input.value) : input.value,
  })
}
</script>
<template>
  <details>
    <summary>Image crop and effects</summary>
    <label
      v-for="field in [
        { key: 'focusX', label: 'Horizontal focal point', max: 100, step: 1, fallback: 50, min: 0 },
        { key: 'focusY', label: 'Vertical focal point', max: 100, step: 1, fallback: 50, min: 0 },
        { key: 'zoom', label: 'Crop zoom', max: 3, step: 0.05, fallback: 1, min: 1 },
        { key: 'darken', label: 'Darken image', max: 100, step: 1, fallback: 0, min: 0 },
      ] as const"
      :key="field.key"
      >{{ field.label }}: {{ value?.[field.key] ?? field.fallback
      }}<input
        type="range"
        :aria-label="field.label"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :value="value?.[field.key] ?? field.fallback"
        @input="change(field.key, $event)"
    /></label>
    <WebsiteOverlayControls :value="value" @update="emit('update', $event)" />
    <label
      >Image caption<input
        :value="value?.caption || ''"
        maxlength="300"
        @input="change('caption', $event)"
    /></label>
    <small
      >Crop and effects change how the image is displayed; the original upload is retained.</small
    >
    <button type="button" @click="emit('update', undefined)">Reset image effects</button>
  </details>
</template>
<style scoped>
label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
  margin: 0.5rem 0;
}
input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
summary {
  cursor: pointer;
  font-weight: 600;
}
small {
  font-size: 0.75rem;
}
</style>
