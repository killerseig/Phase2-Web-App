<script setup lang="ts">
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
  padding: var(--space-4);
}

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
