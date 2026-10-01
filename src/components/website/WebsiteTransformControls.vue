<script setup lang="ts">
import type { WidgetAction } from '@/features/website/grid'
import type { TransformOptions } from '@/features/website/transformControls'

defineProps<TransformOptions>()
const emit = defineEmits<{
  drag: [event: PointerEvent, action: WidgetAction]
  geometryKey: [event: KeyboardEvent, action: WidgetAction]
  activate: [action: WidgetAction]
}>()
</script>
<template>
  <span class="transform-controls">
    <button
      v-for="tool in [
        {
          action: 'move',
          icon: 'pi-arrows-alt',
          label: 'Move widget',
          hint: 'Drag to move. Arrow keys move; Shift uses larger steps.',
        },
        {
          action: canTransform ? 'bottom-right' : 'height',
          icon: 'pi-arrow-down-right',
          label: 'Resize widget',
          hint: canTransform
            ? 'Drag to resize. Arrow keys adjust width and height.'
            : 'Drag to change height. Up and down arrows adjust height.',
        },
        {
          action: 'rotate',
          icon: 'pi-refresh',
          label: 'Rotate widget',
          hint: 'Drag to rotate; go slowly for precision. Alt bypasses snapping; Shift uses 15° steps. Arrow keys rotate; Home resets.',
        },
      ] as const"
      :key="tool.action"
      type="button"
      :data-transform="tool.action"
      :aria-label="tool.label"
      :title="tool.hint"
      :disabled="
        disabled ||
        fixed ||
        (tool.action === 'height' ? !canResizeHeight : tool.action !== 'rotate' && !canTransform)
      "
      @pointerdown.prevent="emit('drag', $event, tool.action)"
      @keydown="emit('geometryKey', $event, tool.action)"
      @click="emit('activate', tool.action)"
    >
      <i class="pi" :class="tool.icon" aria-hidden="true" />
    </button>
  </span>
</template>
<style scoped>
.transform-controls {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  padding-right: 4px;
  margin-right: 2px;
  border-right: 1px solid var(--border, #61788b);
}
button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  touch-action: none;
}
button:hover:not(:disabled) {
  background: var(--field, #275d86);
}
button:focus-visible {
  outline: 2px solid #168bd4;
  outline-offset: 1px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
@media (max-width: 700px) {
  button {
    width: 32px;
    height: 36px;
  }
}
</style>
