<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ExplorerMenuAction } from '@/features/sds/explorerMenu'

const props = defineProps<{
  x: number
  y: number
  label: string
  actions: ExplorerMenuAction[]
}>()
const emit = defineEmits<{ action: [id: string]; close: [restoreFocus: boolean] }>()
const menu = ref<HTMLElement>()
const left = ref(props.x)
const top = ref(props.y)
function buttons() {
  return Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
}
function keydown(event: KeyboardEvent) {
  const items = buttons()
  const index = items.indexOf(document.activeElement as HTMLButtonElement)
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    if (event.key === 'Escape') event.preventDefault()
    emit('close', true)
  }
}
function outside(event: Event) {
  if (!menu.value?.contains(event.target as Node)) emit('close', false)
}
function dismiss() {
  emit('close', false)
}
onMounted(async () => {
  await nextTick()
  const rect = menu.value!.getBoundingClientRect()
  left.value = Math.max(8, Math.min(props.x, window.innerWidth - rect.width - 8))
  top.value = Math.max(8, Math.min(props.y, window.innerHeight - rect.height - 8))
  buttons()[0]?.focus({ preventScroll: true })
  window.addEventListener('pointerdown', outside)
  window.addEventListener('focusin', outside)
  window.addEventListener('resize', dismiss)
  // Dismiss on deliberate scrolling, not a pending scroll from revealing the clicked row.
  window.addEventListener('wheel', outside, { passive: true })
  window.addEventListener('touchmove', outside, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', outside)
  window.removeEventListener('focusin', outside)
  window.removeEventListener('resize', dismiss)
  window.removeEventListener('wheel', outside)
  window.removeEventListener('touchmove', outside)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menu"
      role="menu"
      :aria-label="label"
      class="explorer-menu"
      :style="{ left: `${left}px`, top: `${top}px` }"
      @keydown="keydown"
      @contextmenu.prevent
    >
      <div class="explorer-menu__title">{{ label }}</div>
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        role="menuitem"
        tabindex="-1"
        :disabled="action.disabled"
        :class="{ 'is-danger': action.danger }"
        @click="emit('action', action.id)"
      >
        <i :class="['pi', action.icon || 'pi-angle-right']" aria-hidden="true" />
        {{ action.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.explorer-menu {
  position: fixed;
  z-index: 1000;
  width: 260px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  overflow-y: auto;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-background);
  color: var(--text);
  box-shadow: 0 8px 28px #0004;
}
.explorer-menu__title {
  padding: 0.5rem 0.65rem;
  font-size: 0.8rem;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
button {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 44px;
  padding: 0.6rem;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
button:hover:not(:disabled),
button:focus-visible {
  background: var(--field-hover, #3289bf22);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.is-danger {
  color: var(--danger, #c95349);
}
</style>
