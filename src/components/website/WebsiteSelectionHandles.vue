<script setup lang="ts">
import { resizeDirections, type ResizeDirection } from '@/features/website/grid'
import { onMounted, onBeforeUnmount, ref } from 'vue'

const rotateButton = ref<HTMLElement>()
const insetTop = ref(false)
const insetLeft = ref(false)
let observer: ResizeObserver | undefined
function positionControls() {
  const target = rotateButton.value?.parentElement
  const viewport = target?.closest('.preview-viewport') as HTMLElement | null
  if (!target || !viewport) return
  const bounds = target.getBoundingClientRect()
  const edge = viewport.getBoundingClientRect()
  const scale = edge.width / viewport.offsetWidth
  const padding = parseFloat(getComputedStyle(viewport).paddingTop) * scale
  insetTop.value = bounds.top - edge.top - padding < 40 * scale
  insetLeft.value = bounds.left - edge.left - padding < 6 * scale
}
onMounted(() => {
  observer = new ResizeObserver(positionControls)
  const target = rotateButton.value?.parentElement
  if (target) observer.observe(target)
  const viewport = target?.closest('.preview-viewport')
  if (viewport) observer.observe(viewport)
  window.addEventListener('scroll', positionControls, true)
  positionControls()
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('scroll', positionControls, true)
})
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
    :class="[`text-resize-${direction}`, { 'inset-top': insetTop, 'inset-left': insetLeft }]"
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
    ref="rotateButton"
    :class="{ 'inset-top': insetTop }"
    :aria-label="`Rotate ${label}`"
    title="Drag to rotate. Move slowly for precision; Alt bypasses snapping."
    @pointerdown.stop.prevent="emit('drag', $event, 'rotate')"
    @click.stop
    @dblclick.stop
    @keydown.stop="emit('key', $event, 'rotate')"
  >
    <i class="pi pi-refresh" aria-hidden="true" />
  </button>
  <span
    v-if="rotation !== undefined"
    class="rotation-reading"
    :class="{ 'inset-top': insetTop }"
    role="status"
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
.text-rotate.inset-top {
  top: 8px;
  bottom: auto;
  left: auto;
  right: 8px;
}
.text-rotate.inset-top::after {
  display: none;
}
.text-resize-top-left.inset-top,
.text-resize-top.inset-top,
.text-resize-top-right.inset-top {
  top: 0;
}
.text-resize-top-left.inset-left,
.text-resize-left.inset-left,
.text-resize-bottom-left.inset-left {
  left: 0;
}
.rotation-reading.inset-top {
  top: 8px;
  bottom: auto;
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
