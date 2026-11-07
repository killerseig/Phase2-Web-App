<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type {
  DashboardPublishedFrame,
  DashboardViewport,
} from '../../../functions/src/sharedDashboardModel'
import type { Direction } from '@/features/dashboard/editorGeometry'
import { transformPublishedFrame } from '@/features/dashboard/publishedFrameGeometry'
import DashboardSelectionFrame from './DashboardSelectionFrame.vue'

const props = defineProps<{
  frame: DashboardPublishedFrame
  canvasWidth: number
  scale: number
  grid: DashboardViewport['grid']
  disabled: boolean
}>()
const emit = defineEmits<{ change: [frame: DashboardPublishedFrame] }>()
const host = ref<HTMLElement>()
const draft = ref<DashboardPublishedFrame>()
const spacing = computed(() =>
  props.grid.snap
    ? { x: (props.grid.x * props.canvasWidth) / 24, y: props.grid.y * 32 }
    : { x: 1, y: 1 },
)
const geometry = computed(() => {
  const f = draft.value || props.frame
  return {
    x: (f.x * 24) / props.canvasWidth,
    y: f.y / 32,
    w: (f.width * 24) / props.canvasWidth,
    h: f.height / 32,
  }
})
let cancel: (() => void) | undefined
function start(event: PointerEvent, action: 'move' | Direction) {
  if (props.disabled || !event.isPrimary || event.button !== 0 || !host.value) return
  event.preventDefault()
  cancel?.()
  ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
  const original = { ...props.frame },
    scale = props.scale,
    origin = host.value.getBoundingClientRect()
  const local = {
    x: (event.clientX - origin.left) / scale,
    y: (event.clientY - origin.top) / scale,
  }
  let moved = false
  const move = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId || !host.value) return
    if (!moved && Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) < 3) return
    moved = true
    const bounds = host.value.getBoundingClientRect()
    draft.value = transformPublishedFrame(
      original,
      action,
      (e.clientX - bounds.left) / scale - local.x,
      (e.clientY - bounds.top) / scale - local.y,
      spacing.value,
    )
  }
  const finish = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return
    move(e)
    const next = draft.value
    cancel?.()
    if (next && JSON.stringify(next) !== JSON.stringify(original)) emit('change', next)
  }
  const escape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    cancel?.()
  }
  cancel = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', abort)
    window.removeEventListener('blur', abort)
    window.removeEventListener('keydown', escape, true)
    draft.value = undefined
    cancel = undefined
  }
  const abort = (e: Event) => {
    if (e instanceof PointerEvent && e.pointerId !== event.pointerId) return
    cancel?.()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', abort)
  window.addEventListener('blur', abort)
  window.addEventListener('keydown', escape, true)
}
function key(event: KeyboardEvent, action: 'move' | 'resize', direction: Direction = 'se') {
  if (
    props.disabled ||
    cancel ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    !event.key.startsWith('Arrow')
  )
    return
  event.preventDefault()
  const step = event.shiftKey ? props.grid.majorEvery : 1
  const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0
  const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0
  const next = transformPublishedFrame(
    props.frame,
    action === 'move' ? action : direction,
    dx * spacing.value.x,
    dy * spacing.value.y,
    spacing.value,
  )
  if (JSON.stringify(next) !== JSON.stringify(props.frame)) emit('change', next)
}
watch(
  () => [props.disabled, props.scale, props.canvasWidth, props.frame, props.grid],
  () => cancel?.(),
  { deep: true },
)
onBeforeUnmount(() => cancel?.())
</script>

<template>
  <div ref="host" class="dashboard-published-frame-host" data-selection-control>
    <DashboardSelectionFrame
      :geometry="geometry"
      :scale="scale"
      control-label="Published frame"
      widget-title="published frame"
      :disable-move="disabled"
      :disable-resize="disabled"
      @move="start($event, 'move')"
      @resize="start"
      @key="key"
    />
  </div>
</template>

<style scoped>
.dashboard-published-frame-host {
  position: absolute;
  inset: 0;
  z-index: 45;
  pointer-events: none;
}
.dashboard-published-frame-host :deep(.dashboard-selection-frame) {
  border: 2px dashed #e8bc72;
  box-shadow: none;
}
.dashboard-published-frame-host :deep(.dashboard-selection-frame__move) {
  color: #ffe3ad;
  border-color: #e8bc72;
}
.dashboard-published-frame-host :deep(.dashboard-selection-frame__resize::before) {
  background: #ffe3ad;
  box-shadow: 0 0 0 1px #e8bc72;
}
</style>
