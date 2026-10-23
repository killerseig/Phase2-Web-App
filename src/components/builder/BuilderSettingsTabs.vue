<script setup lang="ts" generic="T extends string">
const props = defineProps<{ modelValue: T; tabs: { id: T; label: string; disabled?: boolean }[]; label: string; idPrefix: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
function navigate(event: KeyboardEvent) {
  if (props.disabled) return
  const available = props.tabs.filter(tab => !tab.disabled)
  const index = available.findIndex(tab => tab.id === props.modelValue)
  const next = event.key === 'ArrowRight' ? (index + 1) % available.length : event.key === 'ArrowLeft' ? (index + available.length - 1) % available.length : event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : -1
  if (next < 0 || !available[next]) return
  event.preventDefault(); event.stopPropagation()
  const tab = available[next]!
  emit('update:modelValue', tab.id)
  const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')
  buttons[props.tabs.findIndex(item => item.id === tab.id)]?.focus()
}
</script>
<template>
  <div class="builder-settings-tabs" role="tablist" :aria-label="label" @keydown="navigate">
    <button v-for="tab in tabs" :id="`${idPrefix}-tab-${tab.id}`" :key="tab.id" type="button" role="tab" :aria-selected="modelValue === tab.id" :aria-controls="`${idPrefix}-panel-${tab.id}`" :tabindex="modelValue === tab.id ? 0 : -1" :disabled="disabled || tab.disabled" @click="emit('update:modelValue', tab.id)">{{ tab.label }}</button>
  </div>
</template>
<style scoped>
.builder-settings-tabs { display: flex; gap: .2rem; padding: 3px; border: 1px solid var(--editor-border, var(--border)); border-radius: 7px; background: var(--editor-field, var(--surface)); }
button { flex: 1; min-width: 0; padding: 5px 3px; font: inherit; font-size: 12px; color: var(--text-muted); border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; }
button[aria-selected='true'] { color: var(--editor-text, var(--text)); border-color: var(--editor-accent, var(--accent)); background: var(--editor-selected, var(--surface-2)); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
</style>
