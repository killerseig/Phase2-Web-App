<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'

interface Confirmation {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}
const dialog = ref<HTMLDialogElement>()
const cancelButton = ref<HTMLButtonElement>()
const request = ref<Confirmation>()
const id = useId()
let pending: ((accepted: boolean) => void) | undefined
let opener: HTMLElement | null = null

async function ask(options: Confirmation, trigger?: Event): Promise<boolean> {
  // Never replace an unanswered request or leave its caller waiting.
  if (pending) return false
  opener =
    trigger?.currentTarget instanceof HTMLElement
      ? trigger.currentTarget
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  request.value = options
  const answer = new Promise<boolean>((resolve) => {
    pending = resolve
  })
  await nextTick()
  if (!pending || !dialog.value?.isConnected) {
    finish(false)
    return answer
  }
  dialog.value.showModal()
  cancelButton.value?.focus()
  return answer
}
function finish(accepted: boolean) {
  const resolve = pending
  pending = undefined
  dialog.value?.close()
  request.value = undefined
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
  resolve?.(accepted)
}
function keepFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const buttons = dialog.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  const first = buttons?.[0],
    last = buttons?.[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
onBeforeUnmount(() => finish(false))
defineExpose({ ask })
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="builder-controls builder-dialog builder-confirm"
      :aria-labelledby="`${id}-title`"
      :aria-describedby="`${id}-message`"
      @cancel.prevent="finish(false)"
      @close="!dialog?.open && pending && finish(false)"
      @keydown.stop="keepFocus"
    >
      <template v-if="request">
        <header>
          <h2 :id="`${id}-title`">{{ request.title }}</h2>
        </header>
        <p :id="`${id}-message`">{{ request.message }}</p>
        <footer>
          <button ref="cancelButton" type="button" @click="finish(false)">
            {{ request.cancelLabel || 'Cancel' }}
          </button>
          <button
            type="button"
            data-confirm-action
            :class="request.destructive ? 'confirm-danger' : 'confirm-primary'"
            @click="finish(true)"
          >
            {{ request.confirmLabel }}
          </button>
        </footer>
      </template>
    </dialog>
  </Teleport>
</template>

<style scoped>
.builder-confirm {
  box-sizing: border-box;
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  overflow: auto;
}
h2 {
  margin: 0;
}
p {
  margin: 0 0 20px;
  overflow-wrap: anywhere;
}
footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.builder-confirm button.confirm-primary {
  background: #236795;
  border-color: #4081ac;
  color: white;
}
.builder-confirm button.confirm-danger {
  background: #763541;
  border-color: #ba7883;
  color: white;
}
.builder-confirm button.confirm-primary:hover {
  background: #2c78aa;
}
.builder-confirm button.confirm-danger:hover {
  background: #924251;
}
</style>
