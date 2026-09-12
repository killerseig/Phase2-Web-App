<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'

const props = withDefaults(defineProps<{
  confirmationOpen?: boolean
  testId?: string
}>(), {
  confirmationOpen: false,
  testId: undefined,
})

const orderTrigger = ref<HTMLElement | null>(null)
const workspace = ref<HTMLElement | null>(null)
const compact = ref(false)
const drawerOpen = ref(false)
const drawerVisible = computed(() => compact.value && drawerOpen.value)
let mediaQuery: MediaQueryList | undefined
let confirmationTrigger: HTMLElement | null = null

function syncLayout() {
  compact.value = mediaQuery?.matches ?? false
  if (!compact.value) drawerOpen.value = false
  else if (workspace.value?.contains(document.activeElement)) drawerOpen.value = true
}

function closeDrawer() {
  if (!props.confirmationOpen) drawerOpen.value = false
}

function openDrawer(event: MouseEvent) {
  orderTrigger.value = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  drawerOpen.value = true
}

function focusCloseButton() {
  workspace.value?.querySelector<HTMLButtonElement>('[data-testid="shoporder-close-drawer"]')?.focus({ preventScroll: true })
}

function handleKeydown(event: KeyboardEvent) {
  if (!drawerVisible.value || event.defaultPrevented) return
  if (event.key === 'Escape') {
    const fromConfirmation = event.composedPath().some((element) =>
      element instanceof HTMLElement && element.classList.contains('confirm-dialog'),
    )
    if (props.confirmationOpen || fromConfirmation) return
    event.preventDefault()
    closeDrawer()
    return
  }
  if (event.key !== 'Tab') return

  // Confirmations sit above the drawer and receive their own keyboard focus.
  const panel = props.confirmationOpen
    ? document.querySelector<HTMLElement>('.confirm-dialog__panel')
    : workspace.value
  const controls = Array.from(panel?.querySelectorAll<HTMLElement>(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  ) ?? []).filter((element) => element.getClientRects().length > 0)
  const first = controls[0]
  const last = controls[controls.length - 1]
  if (!first || !last) return
  if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) {
    event.preventDefault()
    first.focus()
  }
}

watch(drawerVisible, async (visible) => {
  await nextTick()
  if (visible && !workspace.value?.contains(document.activeElement)) focusCloseButton()
  else if (!visible && compact.value) {
    orderTrigger.value?.focus({ preventScroll: true })
  }
})

watch(() => props.confirmationOpen, async (open) => {
  if (!drawerVisible.value) return
  if (open) {
    confirmationTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    document.querySelector<HTMLButtonElement>('.confirm-dialog__panel button:not(:disabled)')?.focus()
  } else {
    await nextTick()
    if (confirmationTrigger?.isConnected) confirmationTrigger.focus({ preventScroll: true })
    else focusCloseButton()
    confirmationTrigger = null
  }
})

onMounted(() => {
  mediaQuery = window.matchMedia?.('(max-width: 1180px)')
  syncLayout()
  mediaQuery?.addEventListener('change', syncLayout)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener('change', syncLayout)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    class="shop-orders-explorer"
    :class="{ 'shop-orders-explorer--drawer-open': drawerVisible }"
    :data-testid="testId"
  >
    <div class="shop-orders-explorer__pane" :inert="drawerVisible">
      <slot name="catalog" :compact="compact" :drawer-visible="drawerVisible" :open-order="openDrawer" />
    </div>

    <button
      v-if="drawerVisible"
      class="shop-orders-explorer__backdrop"
      data-testid="shoporder-drawer-backdrop"
      type="button"
      tabindex="-1"
      aria-label="Back to catalog"
      @click="closeDrawer"
    ></button>

    <Transition name="shop-order-drawer">
      <div
        id="shop-order-drawer"
        ref="workspace"
        v-show="!compact || drawerVisible"
        class="shop-orders-explorer__pane shop-orders-explorer__workspace"
        :role="compact ? 'dialog' : undefined"
        :aria-modal="compact ? true : undefined"
        :aria-label="compact ? 'Your Order' : undefined"
      >
        <div v-if="compact" class="shop-orders-explorer__drawer-header">
          <h2>Your Order</h2>
          <AppButton
            data-testid="shoporder-close-drawer"
            aria-label="Close order"
            title="Close order"
            @click="closeDrawer"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
          </AppButton>
        </div>
        <div class="shop-orders-explorer__workspace-content" :inert="drawerVisible && confirmationOpen">
          <slot name="workspace" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.shop-orders-explorer {
  --shop-line: var(--border);
  --shop-line-soft: var(--border-soft);
  --shop-surface: rgba(255, 255, 255, 0.018);
  --shop-surface-soft: rgba(255, 255, 255, 0.035);
  --shop-field: var(--control-background);
  --shop-radius-md: var(--control-radius);
  --shop-radius-lg: var(--radius-sm);
  --shop-control-height: var(--control-height-form);
  --shop-number-control-height: 2rem;
  display: grid;
  grid-template-columns: minmax(340px, 0.92fr) minmax(540px, 1.08fr);
  gap: var(--space-4);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.shop-orders-explorer__pane {
  display: grid;
  min-width: 0;
  min-height: 0;
}

.shop-orders-explorer__workspace {
  display: flex;
  flex-direction: column;
}

.shop-orders-explorer__workspace-content {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.shop-orders-explorer__backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  padding: 0;
  border: 0;
  background: rgba(5, 11, 18, 0.52);
  touch-action: none;
}

.shop-orders-explorer__drawer-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated) url('../../assets/images/sidebar-matte-metal.webp') repeat;
  background-size: 256px 256px;
}

.shop-orders-explorer__drawer-header h2 {
  margin: 0;
  font-size: var(--font-size-pane-title);
}

.shop-orders-explorer__drawer-header .app-button {
  width: 2.5rem;
  min-height: 2.5rem;
  padding: 0;
  border-color: transparent;
  background: transparent;
}

/* Numeric fields stay compact on touch screens as well as desktop. */
.shop-orders-explorer :deep(input[type="number"]) {
  --app-text-input-min-height: var(--shop-number-control-height);
  height: var(--shop-number-control-height);
  min-height: var(--shop-number-control-height);
  padding-top: 0;
  padding-bottom: 0;
  line-height: 1.25;
}

.shop-orders-explorer :deep(.shop-orders-item-card__field:not(.shop-orders-item-card__note) .app-readonly-field) {
  --app-readonly-field-min-height: var(--shop-number-control-height);
}

:global(.app-shell__content:has(.shop-orders-explorer--drawer-open)) {
  overflow: hidden;
}

@media (pointer: coarse) {
  .shop-orders-explorer {
    --shop-control-height: 2.75rem;
  }
}

@media (max-width: 1440px) {
  .shop-orders-explorer {
    grid-template-columns: minmax(320px, 0.88fr) minmax(480px, 1.12fr);
  }
}

@media (max-width: 1180px) {
  .shop-orders-explorer {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
    align-content: start;
    height: auto;
    min-height: 100%;
    overflow: visible;
  }

  .shop-orders-explorer__workspace {
    position: fixed;
    inset: 0 0 0 auto;
    z-index: 90;
    width: min(48rem, calc(100vw - 2.5rem));
    height: 100dvh;
    border-left: 1px solid var(--border);
    background: var(--panel-background);
  }

  .shop-orders-explorer__workspace-content {
    overflow: auto;
    overscroll-behavior: contain;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .shop-orders-explorer__workspace-content :deep(.shop-orders-workspace-pane) {
    --app-pane-border: 0;
    --app-pane-radius: 0;
  }

  .shop-order-drawer-enter-active,
  .shop-order-drawer-leave-active {
    transition: transform 0.22s ease;
  }

  .shop-order-drawer-enter-from,
  .shop-order-drawer-leave-to {
    transform: translateX(calc(100% + 1rem));
  }
}

@media (prefers-reduced-motion: reduce) {
  .shop-order-drawer-enter-active,
  .shop-order-drawer-leave-active {
    transition: none;
  }
}
</style>
