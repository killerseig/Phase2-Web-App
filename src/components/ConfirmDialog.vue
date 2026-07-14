<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'

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
    <div v-if="open" class="confirm-dialog" @keydown.esc="closeDialog">
      <button
        type="button"
        class="confirm-dialog__backdrop"
        aria-label="Cancel confirmation"
        :disabled="busy"
        @click="closeDialog"
      ></button>

      <section class="confirm-dialog__panel" role="dialog" aria-modal="true" :aria-label="title">
        <div class="confirm-dialog__content">
          <span class="confirm-dialog__eyebrow">Please Confirm</span>
          <h2 class="confirm-dialog__title">{{ title }}</h2>
          <p class="confirm-dialog__message">{{ message }}</p>
        </div>

        <div class="confirm-dialog__actions">
          <AppButton :disabled="busy" @click="closeDialog">
            {{ cancelLabel }}
          </AppButton>
          <AppButton
            :variant="destructive ? 'danger' : 'primary'"
            :disabled="busy"
            @click="confirmAction"
          >
            {{ busy ? 'Working...' : confirmLabel }}
          </AppButton>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.confirm-dialog__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(3, 8, 13, 0.72);
  backdrop-filter: blur(10px);
}

.confirm-dialog__panel {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 1.25rem;
  width: min(100%, 32rem);
  padding: 1.25rem;
  border: 1px solid rgba(114, 203, 245, 0.28);
  border-radius: var(--radius-lg, 20px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015)),
    rgba(25, 34, 44, 0.98);
  box-shadow: var(--shadow-hard, 0 24px 80px rgba(0, 0, 0, 0.42));
}

.confirm-dialog__content {
  display: grid;
  gap: 0.45rem;
}

.confirm-dialog__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.confirm-dialog__title {
  margin: 0;
  color: var(--text);
  font-size: 1.35rem;
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
  gap: 0.7rem;
}

@media (max-width: 560px) {
  .confirm-dialog__actions {
    display: grid;
  }
}
</style>
