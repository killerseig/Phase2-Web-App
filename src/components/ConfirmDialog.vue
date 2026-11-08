<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'

const props = withDefaults(defineProps<{
  busy?: boolean
  cancelLabel?: string
  confirmLabel?: string
  destructive?: boolean
  message: string
  open: boolean
  title: string
}>(), {
  busy: false,
  cancelLabel: 'Cancel',
  confirmLabel: 'Confirm',
  destructive: false,
})

const emit = defineEmits<{
  cancel: []
  confirm: []
  'update:open': [value: boolean]
}>()

const dialog = ref<HTMLDialogElement>()
let opener: HTMLElement | null = null
let generation = 0
function restoreFocus() {
  dialog.value?.close()
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}
watch(() => props.open, async (open) => {
  const owner = ++generation
  if (!open) { restoreFocus(); return }
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  if (owner !== generation || !props.open || !dialog.value?.isConnected) return
  dialog.value.showModal()
  const cancel = dialog.value.querySelector<HTMLButtonElement>('.confirm-dialog__actions button:not(:disabled)')
  ;(cancel ?? dialog.value).focus({ preventScroll: true })
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { generation++; restoreFocus() })

function keyboard(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeDialog()
  } else if (event.key === 'Tab') {
    const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('.confirm-dialog__actions button:not(:disabled)')
    const first = buttons?.[0], last = buttons?.[buttons.length - 1]
    if (!first) { event.preventDefault(); dialog.value?.focus(); return }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}

function closeDialog() {
  if (props.busy) return
  emit('update:open', false)
  emit('cancel')
}

function confirmAction() {
  if (props.busy) return
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <dialog v-if="open" ref="dialog" class="confirm-dialog" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @keydown="keyboard" @cancel.prevent="closeDialog">
      <button
        type="button"
        class="confirm-dialog__backdrop"
        aria-label="Cancel confirmation"
        :disabled="busy"
        tabindex="-1"
        @click="closeDialog"
      ></button>

      <section class="confirm-dialog__panel">
        <div class="confirm-dialog__content">
          <span class="confirm-dialog__eyebrow">Please Confirm</span>
          <h2 class="confirm-dialog__title">{{ title }}</h2>
          <p class="confirm-dialog__message">{{ message }}</p>
        </div>

        <div class="confirm-dialog__actions">
          <AppButton :disabled="busy" @click="closeDialog">
            {{ cancelLabel }}
          </AppButton>
          <AppLoadingButton
            :label="confirmLabel"
            loading-label="Working..."
            :variant="destructive ? 'danger' : 'primary'"
            :loading="busy"
            :disabled="busy"
            @click="confirmAction"
          />
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  border: 0;
  color: inherit;
  background: transparent;
}

.confirm-dialog::backdrop { background: transparent; }

.confirm-dialog__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--overlay-backdrop);
}

.confirm-dialog__panel {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--space-5);
  width: min(100%, 32rem);
  padding: var(--space-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel-background);
  box-shadow: none;
}

.confirm-dialog__content {
  display: grid;
  gap: var(--field-gap);
}

.confirm-dialog__eyebrow {
  color: var(--text-muted);
  font-size: var(--font-size-eyebrow);
  letter-spacing: var(--letter-spacing-eyebrow);
  text-transform: uppercase;
}

.confirm-dialog__title {
  margin: 0;
  color: var(--text);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-heading);
}

.confirm-dialog__message {
  margin: 0;
  color: var(--text-muted);
  line-height: 1.55;
}

.confirm-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--action-gap);
}

@media (max-width: 560px) {
  .confirm-dialog__actions {
    display: grid;
  }
}
</style>
