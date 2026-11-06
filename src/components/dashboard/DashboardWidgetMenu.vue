<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getViewportFloatingPosition } from '@/utils/viewportPosition'

export interface DashboardWidgetMenuAction {
  id: string
  label: string
  disabled?: boolean
  separatorBefore?: boolean
}
const props = withDefaults(
  defineProps<{
    x: number
    y: number
    anchor?: HTMLElement
    actions: readonly DashboardWidgetMenuAction[]
    label?: string
  }>(),
  { label: 'Widget actions' },
)
// The caller restores the trigger after Escape/actions, but must not steal
// focus after an outside click, Tab, scrolling or resizing.
const emit = defineEmits<{ action: [id: string]; close: [restoreFocus: boolean] }>()
const menu = ref<HTMLElement>()
const position = ref({ x: props.x, y: props.y })
const activeId = ref('')
const enabled = computed(() => props.actions.filter((action) => !action.disabled))
let disposed = false
let mounted = false
let closing = false
const scrollOrigins = new Map<EventTarget, { left: number; top: number }>()
function trackScrollOrigins() {
  scrollOrigins.clear()
  let ancestor = props.anchor
  while (ancestor) {
    scrollOrigins.set(ancestor, { left: ancestor.scrollLeft, top: ancestor.scrollTop })
    ancestor = ancestor.parentElement || undefined
  }
  scrollOrigins.set(document, { left: window.scrollX, top: window.scrollY })
}
function scrolled(event: Event) {
  const target = event.target
  if (!target || (target instanceof Node && menu.value?.contains(target))) return
  const origin = scrollOrigins.get(target)
  if (!origin) return
  const left = target === document ? window.scrollX : (target as HTMLElement).scrollLeft
  const top = target === document ? window.scrollY : (target as HTMLElement).scrollTop
  // A scroll event queued while revealing the trigger can arrive after opening.
  // Only movement since the menu opened invalidates its viewport position.
  if (origin.left !== left || origin.top !== top) close()
}

function focusItem(id: string) {
  activeId.value = id
  const item = [...(menu.value?.querySelectorAll<HTMLButtonElement>('button') || [])].find(
    (button) => button.dataset.action === id,
  )
  ;(item || menu.value)?.focus({ preventScroll: true })
}
async function positionMenu(resetFocus = false) {
  await nextTick()
  if (disposed || !menu.value) return
  const rect = menu.value.getBoundingClientRect()
  const point = getViewportFloatingPosition({
    x: Number.isFinite(props.x) ? props.x : 8,
    y: Number.isFinite(props.y) ? props.y : 8,
    elementWidth: rect.width,
    elementHeight: rect.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    margin: 8,
  })
  position.value = { x: Math.max(8, point.x), y: Math.max(8, point.y) }
  if (resetFocus || !enabled.value.some((item) => item.id === activeId.value))
    focusItem(enabled.value[0]?.id || '')
}
function close(restoreFocus = false) {
  if (closing) return
  closing = true
  emit('close', restoreFocus)
}
function outside(event: Event) {
  if (!(event.target instanceof Node) || !menu.value?.contains(event.target)) close()
}
function resized() {
  close()
}
function choose(action: DashboardWidgetMenuAction) {
  if (action.disabled || closing) return
  closing = true
  emit('action', action.id)
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close(true)
  } else if (event.key === 'Tab') close()
  else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const items = enabled.value
    if (!items.length) return
    const index = items.findIndex((item) => item.id === activeId.value)
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    focusItem(items[next]!.id)
  }
}
watch(
  () => [props.x, props.y, props.anchor],
  () => {
    if (mounted) {
      closing = false
      trackScrollOrigins()
      void positionMenu(true)
    }
  },
  { flush: 'post' },
)
watch(
  () => props.actions,
  () => {
    if (mounted) void positionMenu()
  },
  { deep: true, flush: 'post' },
)
onMounted(() => {
  mounted = true
  trackScrollOrigins()
  void positionMenu(true)
  window.addEventListener('pointerdown', outside)
  window.addEventListener('focusin', outside)
  window.addEventListener('scroll', scrolled, { capture: true, passive: true })
  window.addEventListener('resize', resized)
})
onBeforeUnmount(() => {
  disposed = true
  window.removeEventListener('pointerdown', outside)
  window.removeEventListener('focusin', outside)
  window.removeEventListener('scroll', scrolled, true)
  scrollOrigins.clear()
  window.removeEventListener('resize', resized)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menu"
      class="dashboard-widget-menu builder-floating"
      role="menu"
      :aria-label="label"
      tabindex="-1"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @pointerdown.stop
      @click.stop
      @keydown.stop="keydown"
      @contextmenu.stop.prevent
    >
      <template v-for="action in actions" :key="action.id">
        <div
          v-if="action.separatorBefore"
          class="dashboard-widget-menu__separator"
          role="separator"
        />
        <button
          type="button"
          role="menuitem"
          :data-action="action.id"
          :disabled="action.disabled"
          :tabindex="activeId === action.id ? 0 : -1"
          @focus="activeId = action.id"
          @click="choose(action)"
        >
          {{ action.label }}
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.dashboard-widget-menu {
  position: fixed;
  z-index: 1000;
  width: 228px;
  max-width: calc(100vw - 16px);
  max-height: calc(100dvh - 16px);
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: var(--editor-panel);
  color: var(--text);
  font:
    400 13px/1.5 'Source Sans 3',
    'Segoe UI',
    sans-serif;
  box-shadow: 0 8px 28px #0005;
}
.dashboard-widget-menu button {
  display: block;
  width: 100%;
  min-height: 34px;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.dashboard-widget-menu button:hover:not(:disabled),
.dashboard-widget-menu button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  background: var(--field-hover, #3289bf22);
}
.dashboard-widget-menu button:disabled {
  opacity: 0.45;
  cursor: default;
}
.dashboard-widget-menu__separator {
  height: 1px;
  margin: 4px 5px;
  background: var(--border);
}
</style>
