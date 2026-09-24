<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { WidgetAction } from '@/features/website/grid'
import WebsiteTransformControls from './WebsiteTransformControls.vue'
const props = defineProps<{
  id: string
  scroller?: HTMLElement
  disabled: boolean
  fixed: boolean
  ownLock: boolean
  parentLocked: boolean
  canTransform: boolean
  canResizeHeight?: boolean
  canCopy: boolean
  canDelete: boolean
}>()
const emit = defineEmits<{
  action: [action: string]
  drag: [event: PointerEvent, action: WidgetAction]
  geometryKey: [event: KeyboardEvent, action: WidgetAction]
}>()
const toolbar = ref<HTMLElement>()
const position = ref({ left: '0px', top: '0px', maxWidth: '360px' })
const visible = ref(false)
let frame = 0
let resize: ResizeObserver | undefined
let mutations: MutationObserver | undefined
function update() {
  frame = 0
  const scroller = props.scroller
  const element = Array.from(
    scroller?.querySelectorAll<HTMLElement>('[data-widget-id]') || [],
  ).find((entry) => entry.dataset.widgetId === props.id)
  if (!scroller || !element || !toolbar.value) {
    visible.value = false
    return
  }
  const bounds = scroller.getBoundingClientRect()
  const rect = element.getBoundingClientRect()
  const left = Math.max(8, bounds.left + 8)
  const right = Math.min(window.innerWidth - 8, bounds.right - 8)
  const top = Math.max(8, bounds.top + 8)
  const bottom = Math.min(window.innerHeight - 8, bounds.bottom - 8)
  visible.value =
    bounds.width > 0 &&
    bounds.height > 0 &&
    right > left &&
    bottom > top &&
    rect.bottom > top &&
    rect.top < bottom &&
    rect.right > left &&
    rect.left < right
  if (!visible.value) return
  const height = toolbar.value.offsetHeight
  const width = Math.min(toolbar.value.offsetWidth, right - left)
  const above = rect.top - height - 10
  const below = rect.bottom + 10
  position.value = {
    left: `${Math.max(left, Math.min(rect.left, right - width))}px`,
    top: `${Math.max(top, Math.min(above >= top ? above : below + height <= bottom ? below : rect.top + 8, bottom - height))}px`,
    maxWidth: `${right - left}px`,
  }
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(update)
}
defineExpose({
  async focusTransform(action: WidgetAction) {
    // A newly mounted toolbar starts hidden until its position is measured.
    update()
    await nextTick()
    toolbar.value
      ?.querySelector<HTMLElement>(`[data-transform="${action}"]`)
      ?.focus({ preventScroll: true })
  },
})
onMounted(() => {
  resize = new ResizeObserver(schedule)
  if (props.scroller) resize.observe(props.scroller)
  if (toolbar.value) resize.observe(toolbar.value)
  mutations = new MutationObserver(schedule)
  if (props.scroller)
    mutations.observe(props.scroller, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true,
    })
  window.addEventListener('scroll', schedule, true)
  window.addEventListener('resize', schedule)
  void nextTick(schedule)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resize?.disconnect()
  mutations?.disconnect()
  window.removeEventListener('scroll', schedule, true)
  window.removeEventListener('resize', schedule)
})
</script>
<template>
  <div
    ref="toolbar"
    class="widget-toolbar"
    role="group"
    aria-label="Widget actions"
    :style="{ ...position, visibility: visible ? 'visible' : 'hidden' }"
    @pointerdown.stop
    @click.stop
  >
    <WebsiteTransformControls
      :disabled="disabled"
      :fixed="fixed"
      :can-transform="canTransform"
      :can-resize-height="canResizeHeight"
      @drag="(event, action) => emit('drag', event, action)"
      @geometry-key="(event, action) => emit('geometryKey', event, action)"
    />

    <button
      type="button"
      aria-label="Duplicate selection"
      title="Duplicate widget"
      :disabled="disabled || !canCopy"
      @click="emit('action', 'duplicate')"
    >
      <i class="pi pi-copy" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Bring to front"
      title="Bring to front"
      :disabled="disabled || fixed"
      @click="emit('action', 'front')"
    >
      <i class="pi pi-angle-double-up" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Send to back"
      title="Send to back"
      :disabled="disabled || fixed"
      @click="emit('action', 'back')"
    >
      <i class="pi pi-angle-double-down" aria-hidden="true" />
    </button>
    <button
      type="button"
      :aria-label="ownLock ? 'Unlock widget' : 'Lock widget'"
      :title="
        parentLocked
          ? 'Unlock the parent container first'
          : ownLock
            ? 'Unlock widget layout'
            : 'Lock widget layout'
      "
      :disabled="disabled || parentLocked"
      :aria-pressed="ownLock"
      @click="emit('action', 'lock')"
    >
      <i class="pi" :class="ownLock ? 'pi-lock' : 'pi-lock-open'" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Delete widget"
      title="Delete widget"
      :disabled="disabled || !canDelete"
      @click="emit('action', 'delete')"
    >
      <i class="pi pi-trash" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Widget settings"
      title="Open full widget settings"
      :disabled="disabled"
      @click="emit('action', 'settings')"
    >
      <i class="pi pi-sliders-h" aria-hidden="true" />
    </button>
    <button
      type="button"
      aria-label="Deselect widgets"
      title="Deselect"
      :disabled="disabled"
      @click="emit('action', 'deselect')"
    >
      <i class="pi pi-times" aria-hidden="true" />
    </button>
  </div>
</template>
<style scoped>
.widget-toolbar {
  position: fixed;
  z-index: 80;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 4px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--bg-panel);
  color: var(--text);
  box-shadow: 0 3px 12px #0005;
}
button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  touch-action: none;
}
button:hover:not(:disabled),
button[aria-pressed='true'] {
  background: var(--field);
  color: var(--accent, #8cc9f0);
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
