<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

let modalIdCounter = 0

interface Props {
  open: boolean
  title?: string
  size?: 'sm' | 'lg' | 'xl'
  centered?: boolean
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  closeDisabled?: boolean
  hideClose?: boolean
  contentClass?: string
  headerClass?: string
  bodyClass?: string
  footerClass?: string
  closeButtonClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: undefined,
  centered: true,
  closeOnBackdrop: true,
  closeOnEscape: true,
  closeDisabled: false,
  hideClose: false,
  contentClass: '',
  headerClass: '',
  bodyClass: '',
  footerClass: '',
  closeButtonClass: '',
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const modalRef = ref<HTMLElement | null>(null)
const titleId = `base-modal-title-${++modalIdCounter}`
let previousFocusedElement: HTMLElement | null = null
let previousBodyOverflow = ''

const dialogClasses = computed(() => [
  'modal-dialog',
  props.centered ? 'modal-dialog-centered' : '',
  props.size ? `modal-${props.size}` : '',
].filter(Boolean).join(' '))

const contentClasses = computed(() => ['modal-content', props.contentClass].filter(Boolean).join(' '))
const headerClasses = computed(() => ['modal-header', props.headerClass].filter(Boolean).join(' '))
const bodyClasses = computed(() => ['modal-body', props.bodyClass].filter(Boolean).join(' '))
const footerClasses = computed(() => ['modal-footer', props.footerClass].filter(Boolean).join(' '))
const closeButtonClasses = computed(() => ['btn-close', props.closeButtonClass].filter(Boolean).join(' '))

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function emitClose() {
  if (props.closeDisabled) return
  emit('close')
}

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return []
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    return !element.hasAttribute('disabled') && element.getClientRects().length > 0
  })
}

async function focusInitialElement() {
  await nextTick()
  const modal = modalRef.value
  if (!modal) return

  const autofocusTarget = modal.querySelector<HTMLElement>('[autofocus]:not([disabled])')
  if (autofocusTarget) {
    autofocusTarget.focus()
    return
  }

  const [firstFocusable] = getFocusableElements()
  ;(firstFocusable ?? modal).focus()
}

function lockBodyScroll() {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  document.body.style.overflow = previousBodyOverflow
}

function restoreFocus() {
  previousFocusedElement?.focus()
  previousFocusedElement = null
}

function handleBackdropClick(event: MouseEvent) {
  if (!props.closeOnBackdrop) return
  if (event.target !== event.currentTarget) return
  emitClose()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (props.closeOnEscape) {
      event.preventDefault()
      emitClose()
    }
    return
  }

  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (!focusable.length) {
    event.preventDefault()
    modalRef.value?.focus()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return

  const active = document.activeElement
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open, wasOpen) => {
    if (open) {
      previousFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      lockBodyScroll()
      await focusInitialElement()
      return
    }

    if (wasOpen) {
      unlockBodyScroll()
      restoreFocus()
    }
  }
)

onBeforeUnmount(() => {
  if (props.open) {
    unlockBodyScroll()
    restoreFocus()
  }
})
</script>

<template>
  <div
    v-if="open"
    ref="modalRef"
    class="modal d-block bg-dark bg-opacity-50"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="title ? titleId : undefined"
    @click="handleBackdropClick"
    @keydown="handleKeydown"
  >
    <div :class="dialogClasses">
      <div :class="contentClasses">
        <div v-if="title || $slots.header" :class="headerClasses">
          <slot name="header">
            <h5 :id="titleId" class="modal-title">{{ title }}</h5>
          </slot>
          <button
            v-if="!hideClose"
            type="button"
            :class="closeButtonClasses"
            :disabled="closeDisabled"
            aria-label="Close"
            @click="emitClose"
          ></button>
        </div>

        <div :class="bodyClasses">
          <slot />
        </div>

        <div v-if="$slots.footer" :class="footerClasses">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>
