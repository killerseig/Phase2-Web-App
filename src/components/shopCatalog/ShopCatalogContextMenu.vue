<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useWindowEventListener } from '@/composables/useWindowEventListener'
import { getViewportFloatingPosition } from '@/utils/viewportPosition'

export interface ShopCatalogContextMenuAction {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  anchor?: HTMLElement | null
  actions: readonly ShopCatalogContextMenuAction[]
}>()
const emit = defineEmits<{ close: [restoreFocus: boolean] }>()
const menu = ref<HTMLElement>()
const position = ref({ x: props.x, y: props.y })
const activeKey = ref('')
let revision = 0

function buttons() {
  return Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
}
function keydown(event: KeyboardEvent) {
  const items = buttons()
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault()
    // Return to the trigger before Tab takes its normal next/previous step.
    emit('close', true)
  }
}
function choose(action: ShopCatalogContextMenuAction) {
  if (action.disabled) return
  // Restore before running an action so a resulting dialog or inline field owns focus.
  emit('close', true)
  action.run()
}
function outside(event: Event) {
  if (props.visible && event.target instanceof Node && !menu.value?.contains(event.target)) emit('close', false)
}
watch(() => [props.visible, props.x, props.y, props.anchor], async () => {
  const owner = ++revision
  if (!props.visible) return
  await nextTick()
  if (owner !== revision || !menu.value) return
  const rect = menu.value.getBoundingClientRect()
  const point = getViewportFloatingPosition({
    x: props.x, y: props.y, elementWidth: rect.width, elementHeight: rect.height,
    viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, margin: 8,
  })
  position.value = { x: Math.max(8, point.x), y: Math.max(8, point.y) }
  buttons()[0]?.focus({ preventScroll: true })
}, { immediate: true })
useWindowEventListener('focusin', outside)
useWindowEventListener('wheel', outside, { passive: true })
useWindowEventListener('touchmove', outside, { passive: true })
useWindowEventListener('resize', () => { if (props.visible) emit('close', false) })
onBeforeUnmount(() => { revision++ })
</script>

<template>
  <div
    v-if="visible"
    ref="menu"
    class="shop-catalog-context-menu"
    role="menu"
    aria-label="Catalog actions"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @pointerdown.stop
    @keydown.stop="keydown"
    @contextmenu.prevent
  >
    <button
      v-for="action in actions"
      :key="action.key"
      type="button"
      role="menuitem"
      :tabindex="activeKey === action.key ? 0 : -1"
      class="shop-catalog-context-menu__item"
      :class="{ 'shop-catalog-context-menu__item--danger': action.danger }"
      :disabled="action.disabled"
      @focus="activeKey = action.key"
      @click="choose(action)"
    >
      {{ action.label }}
    </button>
  </div>
</template>

<style scoped>
.shop-catalog-context-menu {
  position: fixed;
  z-index: 30;
  display: grid;
  gap: 0.2rem;
  min-width: 13rem;
  max-width: calc(100vw - 16px);
  max-height: calc(100dvh - 16px);
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel-background);
  box-shadow: none;
}

.shop-catalog-context-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.shop-catalog-context-menu__item:hover:not(:disabled) {
  background: var(--field-hover);
}

.shop-catalog-context-menu__item:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.shop-catalog-context-menu__item:disabled {
  color: var(--text-soft);
  opacity: 0.55;
  cursor: default;
}

.shop-catalog-context-menu__item--danger {
  color: var(--danger);
}

.shop-catalog-context-menu__item--danger:hover:not(:disabled) {
  background: var(--danger-surface);
}
</style>
