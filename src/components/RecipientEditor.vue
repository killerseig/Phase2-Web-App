<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppIconButton from '@/components/common/AppIconButton.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'

const props = withDefaults(defineProps<{
  disabled?: boolean
  emptyLabel?: string
  hint?: string
  modelValue?: string
  placeholder?: string
  readOnly?: boolean
  recipients: readonly string[]
  removeLabel?: string
  rowBadge?: string
  title: string
}>(), {
  disabled: false,
  emptyLabel: 'No recipients yet.',
  hint: '',
  modelValue: '',
  placeholder: 'name@example.com',
  readOnly: false,
  removeLabel: 'Remove recipient',
  rowBadge: '',
})

const emit = defineEmits<{
  add: []
  remove: [email: string]
  'update:modelValue': [value: string]
}>()

const recipientCountLabel = computed(() => (
  `${props.recipients.length} recipients`
))

function addRecipient() {
  if (props.disabled || props.readOnly) return
  emit('add')
}

function removeRecipient(email: string) {
  if (props.disabled || props.readOnly) return
  emit('remove', email)
}
</script>

<template>
  <section class="recipient-editor">
    <div class="recipient-editor__header">
      <div class="recipient-editor__title">
        <strong>{{ title }}</strong>
        <span v-if="hint">{{ hint }}</span>
        <span v-else>{{ recipientCountLabel }}</span>
      </div>
      <span v-if="hint" class="recipient-editor__count">{{ recipientCountLabel }}</span>
    </div>

    <div v-if="!readOnly" class="recipient-editor__input-row">
      <AppTextInput
        class="recipient-editor__input"
        :model-value="modelValue"
        type="email"
        autocomplete="email"
        :disabled="disabled"
        :placeholder="placeholder"
        @update:model-value="emit('update:modelValue', $event)"
        @keydown.enter.prevent="addRecipient"
      />
      <AppButton
        class="recipient-editor__add"
        variant="primary"
        :disabled="disabled"
        @click="addRecipient"
      >
        Add
      </AppButton>
    </div>

    <div v-if="recipients.length === 0" class="recipient-editor__empty">
      {{ emptyLabel }}
    </div>

    <div v-else class="recipient-editor__list">
      <article v-for="email in recipients" :key="email" class="recipient-editor__row">
        <span>{{ email }}</span>
        <span v-if="rowBadge" class="recipient-editor__badge">{{ rowBadge }}</span>
        <AppIconButton
          v-else-if="!readOnly"
          class="recipient-editor__remove"
          :label="removeLabel"
          variant="danger"
          :disabled="disabled"
          :title="removeLabel"
          @click="removeRecipient(email)"
        >
          X
        </AppIconButton>
      </article>
    </div>
  </section>
</template>

<style scoped>
.recipient-editor {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.recipient-editor__header,
.recipient-editor__title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.85rem;
  min-width: 0;
}

.recipient-editor__title {
  flex: 1 1 auto;
  color: var(--text-muted);
}

.recipient-editor__title strong {
  color: var(--text);
  font-size: 1rem;
}

.recipient-editor__title span,
.recipient-editor__count {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.86rem;
  white-space: nowrap;
}

.recipient-editor__input-row {
  display: flex;
  align-items: stretch;
  gap: 0.6rem;
  width: min(100%, 28rem);
  max-width: 28rem;
  min-width: 0;
}

.recipient-editor__input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  --app-text-input-min-height: 2.25rem;
  --app-text-input-padding-x: 0.8rem;
  --app-text-input-radius: 9px;
  font-size: 0.92rem;
}

.recipient-editor__add {
  flex: 0 0 auto;
  min-width: 4.25rem;
  min-height: 2.25rem;
  padding: 0 0.95rem;
  border-radius: 9px;
  white-space: nowrap;
}

.recipient-editor__empty {
  display: grid;
  place-content: center;
  min-height: 5rem;
  max-width: 100%;
  min-width: 0;
  padding: 0.9rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
  text-align: center;
}

.recipient-editor__list {
  display: grid;
  gap: 0.55rem;
  width: min(100%, 42rem);
  max-width: 100%;
  min-width: 0;
}

.recipient-editor__row {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
}

.recipient-editor__row span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

.recipient-editor__badge {
  color: var(--text-muted);
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .recipient-editor__input-row {
    flex-direction: column;
    max-width: none;
  }

  .recipient-editor__title,
  .recipient-editor__header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
}
</style>
