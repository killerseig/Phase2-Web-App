<script setup lang="ts">
import { resizeDirections, type ResizeDirection } from '@/features/website/grid'
defineProps<{ label: string; rotation?: number; snapped?: boolean }>()
const emit = defineEmits<{
  drag: [event: PointerEvent, action: ResizeDirection | 'rotate']
  key: [event: KeyboardEvent, action: ResizeDirection | 'rotate']
}>()
</script>
<template>
  <button
    v-for="direction in resizeDirections"
    :key="direction"
    type="button"
    class="text-resize"
    :class="`text-resize-${direction}`"
    :aria-label="`Resize ${label} from ${direction}`"
    title="Drag to resize. Shift toggles proportions on corner handles."
    @pointerdown.stop.prevent="emit('drag', $event, direction)"
    @click.stop
    @dblclick.stop
    @keydown.stop="emit('key', $event, direction)"
  />
  <button
    type="button"
    class="text-rotate"
    :aria-label="`Rotate ${label}`"
    title="Drag to rotate. Move slowly for precision; Alt bypasses snapping."
    @pointerdown.stop.prevent="emit('drag', $event, 'rotate')"
    @click.stop
    @dblclick.stop
    @keydown.stop="emit('key', $event, 'rotate')"
  >
    <i class="pi pi-refresh" aria-hidden="true" />
  </button>
  <span v-if="rotation !== undefined" class="rotation-reading" role="status"
    >{{ Math.round(rotation * 100) / 100 }}°{{ snapped ? ' · snapped' : '' }}</span
  >
</template>
<style scoped>
.text-resize,
.text-rotate {
  position: absolute;
  z-index: 20;
  width: 12px;
  height: 12px;
  min-height: 0;
  padding: 0;
  margin: 0;
  border: 1px solid #168bd4;
  border-radius: 50%;
  background: white;
  color: #174878;
  touch-action: none;
}
.text-resize-top-left {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}
.text-resize-top {
  top: -6px;
  left: calc(50% - 6px);
  cursor: ns-resize;
}
.text-resize-top-right {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}
.text-resize-right {
  right: -6px;
  top: calc(50% - 6px);
  cursor: ew-resize;
}
.text-resize-bottom-right {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}
.text-resize-bottom {
  bottom: -6px;
  left: calc(50% - 6px);
  cursor: ns-resize;
}
.text-resize-bottom-left {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}
.text-resize-left {
  left: -6px;
  top: calc(50% - 6px);
  cursor: ew-resize;
}
.text-rotate {
  width: 24px;
  height: 24px;
  bottom: calc(100% + 16px);
  left: calc(50% - 12px);
  display: grid;
  place-items: center;
  font-size: 12px;
  cursor: grab;
}
.text-rotate::after {
  content: '';
  position: absolute;
  top: 100%;
  height: 16px;
  width: 1px;
  background: #168bd4;
  pointer-events: none;
}
.rotation-reading {
  position: absolute;
  left: calc(50% + 20px);
  bottom: calc(100% + 16px);
  padding: 3px 6px;
  border-radius: 4px;
  font: 12px/1.4 system-ui;
  color: white;
  background: #174878;
  white-space: nowrap;
  pointer-events: none;
}
</style>
