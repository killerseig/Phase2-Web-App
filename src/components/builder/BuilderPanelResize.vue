<script setup lang="ts">
import { ref, watch } from 'vue'
const props = defineProps<{
  label: string
  controls: string
  value: number
  min: number
  max: number
  reverse?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:value': [value: number]
  commit: []
  start: []
  cancel: []
  reset: []
}>()
const dragging = ref(false)
let origin = 0,
  initial = 0,
  pointer: number | undefined
const clamp = (value: number) => Math.max(props.min, Math.min(props.max, Math.round(value)))
function start(event: PointerEvent) {
  if (props.disabled || event.button !== 0 || pointer !== undefined) return
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  target.focus({ preventScroll: true })
  target.setPointerCapture(event.pointerId)
  pointer = event.pointerId
  origin = event.clientX
  initial = props.value
  dragging.value = true
  emit('start')
}
function move(event: PointerEvent) {
  if (pointer !== event.pointerId) return
  emit('update:value', clamp(initial + (event.clientX - origin) * (props.reverse ? -1 : 1)))
}
function stop(cancel = false) {
  if (pointer === undefined) return
  pointer = undefined
  dragging.value = false
  if (cancel) emit('cancel')
  else emit('commit')
}
function keyboard(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'Escape') {
    event.preventDefault()
    stop(true)
    return
  }
  if (pointer !== undefined) return
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('reset')
    return
  }
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const step = event.shiftKey ? 40 : 10
  const delta = (event.key === 'ArrowRight' ? 1 : -1) * (props.reverse ? -1 : 1) * step
  emit(
    'update:value',
    event.key === 'Home' ? props.min : event.key === 'End' ? props.max : clamp(props.value + delta),
  )
  emit('commit')
}
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) stop(true)
  },
)
</script>

<template>
  <div
    class="builder-panel-resize"
    :class="{ dragging }"
    role="separator"
    aria-orientation="vertical"
    :aria-label="label"
    :aria-controls="controls"
    :aria-valuenow="Math.round(value)"
    :aria-valuemin="min"
    :aria-valuemax="Math.round(max)"
    :aria-valuetext="`${Math.round(value)} pixels`"
    :aria-disabled="disabled || undefined"
    :tabindex="disabled ? -1 : 0"
    title="Drag to resize. Arrow keys adjust width; Enter or double-click resets."
    @pointerdown.stop="start"
    @pointermove.stop="move"
    @pointerup.stop="stop()"
    @pointercancel.stop="stop(true)"
    @lostpointercapture="stop(true)"
    @keydown.stop="keyboard"
    @dblclick.prevent.stop="!disabled && emit('reset')"
    @click.stop
  />
</template>

<style scoped>
.builder-panel-resize {
  position: relative;
  width: 6px;
  min-width: 0;
  background: #102331;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
  z-index: 4;
}
.builder-panel-resize::after {
  content: '';
  position: absolute;
  inset: 0 2px;
  border-radius: 2px;
}
.builder-panel-resize:hover::after,
.builder-panel-resize.dragging::after,
.builder-panel-resize:focus-visible::after {
  background: #91c9ed;
}
.builder-panel-resize:focus-visible {
  outline: 1px solid #91c9ed;
  outline-offset: -1px;
}
.builder-panel-resize[aria-disabled='true'] {
  cursor: default;
}
@media (max-width: 900px) {
  .builder-panel-resize {
    display: none;
  }
}
</style>
