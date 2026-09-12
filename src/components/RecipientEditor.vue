<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppIconButton from '@/components/common/AppIconButton.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
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
  `${props.recipients.length} ${props.recipients.length === 1 ? 'recipient' : 'recipients'}`
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
    <AppSectionHeader
      class="recipient-editor__header"
      :title="title"
      title-tag="strong"
      :description="hint || undefined"
    >
      <template #actions>
        <span class="recipient-editor__count">{{ recipientCountLabel }}</span>
      </template>
    </AppSectionHeader>

    <div v-if="!readOnly" class="recipient-editor__input-row">
      <AppTextInput
        class="recipient-editor__input"
        :model-value="modelValue"
        :aria-label="`${title} email address`"
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
        <AppBadge v-if="rowBadge" class="recipient-editor__badge">{{ rowBadge }}</AppBadge>
        <AppIconButton
          v-else-if="!readOnly"
          class="recipient-editor__remove"
          :label="removeLabel"
          variant="danger"
          :disabled="disabled"
          :title="removeLabel"
          @click="removeRecipient(email)"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </AppIconButton>
      </article>
    </div>
  </section>
</template>

<style scoped>
.recipient-editor {
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: var(--font-weight-heading);
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
  --app-section-header-description-font-size: 0.86rem;
  --app-section-header-description-line-height: 1.25;
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.recipient-editor__count {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: var(--font-size-help);
  white-space: nowrap;
}

.recipient-editor__input-row {
  display: flex;
  align-items: stretch;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
}

.recipient-editor__input {
  flex: 1 1 auto;
  min-width: 0;
  width: auto;
  --app-text-input-min-height: var(--control-height-form);
  --app-text-input-padding-x: var(--control-padding-x);
  --app-text-input-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}

.recipient-editor__add {
  flex: 0 0 auto;
  min-width: 4.25rem;
  min-height: var(--control-height-form);
  padding: 0 0.95rem;
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.recipient-editor__empty {
  display: grid;
  place-content: center start;
  min-height: 2.5rem;
  max-width: 100%;
  min-width: 0;
  padding: 0.5rem 0;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  text-align: left;
}

.recipient-editor__list {
  display: grid;
  gap: var(--list-gap);
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.recipient-editor__row {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-muted);
}

.recipient-editor__row span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .recipient-editor__header {
    --app-section-header-flex-direction: column;
    --app-section-header-align-items: flex-start;
    --app-section-header-gap: 0.15rem;
  }
}
</style>
