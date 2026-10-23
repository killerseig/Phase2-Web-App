<script setup lang="ts">
type Pane = 'outline' | 'preview' | 'inspector'
const props = withDefaults(defineProps<{ modelValue: Pane; outlineLabel?: string; outlineControls: string; canvasControls: string; inspectorControls: string; disabled?: boolean }>(), { outlineLabel: 'Pages & widgets' })
const emit = defineEmits<{ 'update:modelValue': [value: Pane] }>()
const panes = ['outline', 'preview', 'inspector'] as const
function navigate(event: KeyboardEvent) {
  if (props.disabled) return
  const index = panes.indexOf(props.modelValue)
  const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1
  if (next < 0) return
  event.preventDefault(); event.stopPropagation()
  emit('update:modelValue', panes[next]!)
  ;(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
}
</script>
<template>
  <nav class="builder-panel-switcher" aria-label="Builder panels" @keydown="navigate">
    <button v-for="pane in panes" :key="pane" type="button" :aria-pressed="modelValue === pane" :aria-controls="pane === 'outline' ? outlineControls : pane === 'preview' ? canvasControls : inspectorControls" :tabindex="modelValue === pane ? 0 : -1" :disabled="disabled" @click="emit('update:modelValue', pane)">{{ pane === 'outline' ? outlineLabel : pane === 'preview' ? 'Canvas' : 'Editor' }}</button>
  </nav>
</template>
<style scoped>
.builder-panel-switcher { display: none; }
@media (max-width: 900px) {
  .builder-panel-switcher { display: flex; flex: 0 0 auto; gap: .35rem; padding: 0 0 .25rem; }
  button { flex: 1; min-width: 0; min-height: 40px; }
}
</style>
