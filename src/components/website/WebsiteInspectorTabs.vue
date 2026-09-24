<script setup lang="ts">
export type InspectorTab = 'content' | 'appearance' | 'layout'
const props = defineProps<{ modelValue: InspectorTab }>()
const emit = defineEmits<{ 'update:modelValue': [value: InspectorTab] }>()
const tabs: { id: InspectorTab; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'layout', label: 'Layout' },
]
function navigate(event: KeyboardEvent) {
  const index = tabs.findIndex((tab) => tab.id === props.modelValue)
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : -1
  if (next < 0) return
  event.preventDefault()
  event.stopPropagation()
  emit('update:modelValue', tabs[next]!.id)
  const list = event.currentTarget as HTMLElement
  list.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
</script>

<template>
  <div class="inspector-tabs" role="tablist" aria-label="Widget settings" @keydown="navigate">
    <button
      v-for="tab in tabs"
      :id="`widget-tab-${tab.id}`"
      :key="tab.id"
      type="button"
      role="tab"
      :aria-selected="modelValue === tab.id"
      :aria-controls="`widget-panel-${tab.id}`"
      :tabindex="modelValue === tab.id ? 0 : -1"
      @click="emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.inspector-tabs {
  display: flex;
  gap: 0.2rem;
  border-bottom: 1px solid var(--border);
}
button {
  flex: 1;
  min-width: 0;
  padding: 0.65rem 0.25rem;
  font: inherit;
  font-size: 0.8rem;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
button[aria-selected='true'] {
  border-bottom-color: var(--accent);
  color: var(--text);
  background: var(--surface-2);
}
button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
