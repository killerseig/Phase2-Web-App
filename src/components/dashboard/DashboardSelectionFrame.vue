<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { resizeDirections, type Direction } from '@/features/dashboard/editorGeometry'

const props = defineProps<{
  geometry: { x: number; y: number; w: number; h: number }
  disableMove?: boolean
  disableResize?: boolean
  positionLocked?: boolean
  widgetTitle?: string
  controlLabel?: string
  scale?: number
  clipBounds?: { left: number; top: number; right: number; bottom: number }
}>()
const emit = defineEmits<{
  move: [event: PointerEvent]
  resize: [event: PointerEvent, direction: Direction]
  key: [event: KeyboardEvent, action: 'move' | 'resize', direction?: Direction]
  'focus-hidden': []
}>()
const element = ref<HTMLElement>()
const hiddenControls = ref(new Set<string>())
function syncClippedControls() {
  const hidden = new Set<string>(),
    clip = props.clipBounds
  if (clip && element.value) {
    for (const button of element.value.querySelectorAll<HTMLElement>(
      'button[data-selection-control]',
    )) {
      const bounds = button.getBoundingClientRect()
      if (
        clip.right <= clip.left ||
        clip.bottom <= clip.top ||
        bounds.right <= clip.left ||
        bounds.left >= clip.right ||
        bounds.bottom <= clip.top ||
        bounds.top >= clip.bottom
      )
        hidden.add(button.dataset.selectionControl!)
    }
  }
  const focused = document.activeElement as HTMLElement | null
  if (
    focused &&
    element.value?.contains(focused) &&
    hidden.has(focused.dataset.selectionControl || '')
  )
    emit('focus-hidden')
  if (
    hidden.size !== hiddenControls.value.size ||
    [...hidden].some((key) => !hiddenControls.value.has(key))
  )
    hiddenControls.value = hidden
}
watch(
  [element, () => props.geometry, () => props.clipBounds, () => props.scale],
  syncClippedControls,
  { flush: 'post' },
)
// The parent supplies bounds in the coordinate system of the common canvas.
// Its existing transform scales this frame along with the selected widgets.
const frameStyle = computed(() => ({
  left: (props.geometry.x / 24) * 100 + '%',
  top: props.geometry.y * 32 + 'px',
  width: (props.geometry.w / 24) * 100 + '%',
  height: props.geometry.h * 32 + 'px',
  '--selection-control-scale':
    1 / (Number.isFinite(props.scale) && props.scale! > 0 ? props.scale! : 1),
}))
function resizeDisabled(direction: Direction) {
  return props.disableResize || (props.positionLocked && /[nw]/.test(direction))
}
function resizeLabel(direction: Direction) {
  return props.widgetTitle
    ? `Resize ${props.widgetTitle}${direction === 'se' ? '' : ' from ' + direction}`
    : `Resize selected widgets from ${direction}`
}
function handleStyle(direction: Direction) {
  return {
    left: direction.includes('w') ? '0%' : direction.includes('e') ? '100%' : '50%',
    top: direction.includes('n') ? '0%' : direction.includes('s') ? '100%' : '50%',
    cursor: resizeDisabled(direction) ? 'not-allowed' : `${direction}-resize`,
  }
}
function move(event: PointerEvent) {
  if (!props.disableMove && event.button === 0) emit('move', event)
}
function resize(event: PointerEvent, direction: Direction) {
  if (!resizeDisabled(direction) && event.button === 0) emit('resize', event, direction)
}
function key(event: KeyboardEvent, action: 'move' | 'resize', direction?: Direction) {
  if (action === 'move' ? props.disableMove : resizeDisabled(direction || 'se')) return
  emit('key', event, action, direction)
  // Let unhandled keys reach the existing editor and drag-cancellation handlers.
  if (event.defaultPrevented) event.stopPropagation()
}
</script>

<template>
  <div
    ref="element"
    class="dashboard-selection-frame"
    data-selection-control
    :style="frameStyle"
    role="group"
    :aria-label="controlLabel || (widgetTitle ? 'Selected widget frame' : 'Selected widgets frame')"
  >
    <button
      type="button"
      class="dashboard-selection-frame__move"
      data-selection-control="move"
      :disabled="disableMove"
      :inert="hiddenControls.has('move') || undefined"
      :aria-hidden="hiddenControls.has('move') || undefined"
      :aria-label="
        controlLabel
          ? 'Move ' + controlLabel
          : widgetTitle
            ? 'Move selected widget'
            : 'Move selected widgets'
      "
      :title="
        controlLabel
          ? 'Move ' + controlLabel
          : widgetTitle
            ? 'Move selected widget'
            : 'Move selected widgets'
      "
      @pointerdown.stop="move"
      @keydown="key($event, 'move')"
      @click.stop
    >
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
        <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
      </svg>
      <span>{{ controlLabel || 'Move' }}</span>
    </button>
    <button
      v-for="direction in resizeDirections"
      :key="direction"
      type="button"
      class="dashboard-selection-frame__resize"
      :data-selection-control="direction"
      :class="`resize-${direction}`"
      :style="handleStyle(direction)"
      :disabled="resizeDisabled(direction)"
      :inert="hiddenControls.has(direction) || undefined"
      :aria-hidden="hiddenControls.has(direction) || undefined"
      :aria-label="resizeLabel(direction)"
      :title="resizeLabel(direction)"
      @pointerdown.stop="resize($event, direction)"
      @keydown="key($event, 'resize', direction)"
      @click.stop
    />
  </div>
</template>

<style scoped>
.dashboard-selection-frame {
  position: absolute;
  z-index: 30;
  box-sizing: border-box;
  border: 1px solid #46c4ffd1;
  background: transparent;
  box-shadow: 0 0 0 2px #46c4ff14;
  pointer-events: none;
}
.dashboard-selection-frame button {
  position: absolute;
  box-sizing: border-box;
  margin: 0;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}
.dashboard-selection-frame__move {
  top: calc(4px * var(--selection-control-scale));
  left: calc(20px * var(--selection-control-scale));
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 26px;
  padding: 3px 7px;
  border: 1px solid #46c4ff;
  border-radius: 5px;
  background: #111925;
  color: #bef5ff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  cursor: grab;
  transform: translateY(-50%) scale(var(--selection-control-scale));
  transform-origin: left center;
}
.dashboard-selection-frame__move:active:not(:disabled) {
  cursor: grabbing;
}
.dashboard-selection-frame__move svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
}
.dashboard-selection-frame__resize {
  width: 24px;
  height: 24px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  transform: translate(-50%, -50%) scale(var(--selection-control-scale));
}
.dashboard-selection-frame__resize::before {
  content: '';
  position: absolute;
  inset: 5px;
  border: 2px solid #111925;
  border-radius: 50%;
  background: #68f0ff;
  box-shadow: 0 0 0 1px #46c4ff;
}
.dashboard-selection-frame button:focus-visible {
  outline: 2px solid #bef5ff;
  outline-offset: 2px;
}
.dashboard-selection-frame button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
