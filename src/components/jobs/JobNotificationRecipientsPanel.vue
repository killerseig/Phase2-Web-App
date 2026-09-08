<script setup lang="ts">
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import RecipientEditor from '@/components/RecipientEditor.vue'
import type { GlobalNotificationModuleKey } from '@/types/domain'

const props = defineProps<{
  description: string
  modules: ReadonlyArray<{ key: GlobalNotificationModuleKey; label: string }>
  recipients: Partial<Record<GlobalNotificationModuleKey, string[]>>
  inputs: Partial<Record<GlobalNotificationModuleKey, string>>
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateInput: [moduleKey: GlobalNotificationModuleKey, value: string]
  addRecipient: [moduleKey: GlobalNotificationModuleKey]
  removeRecipient: [moduleKey: GlobalNotificationModuleKey, email: string]
}>()

function getInput(moduleKey: GlobalNotificationModuleKey) {
  return props.inputs[moduleKey] ?? ''
}

function getRecipients(moduleKey: GlobalNotificationModuleKey) {
  return props.recipients[moduleKey] ?? []
}
</script>

<template>
  <section class="jobs-notifications-panel">
    <AppSectionHeader
      class="jobs-notifications-panel__header"
      title="Email Recipients"
      title-tag="strong"
      :description="description"
    />

    <RecipientEditor
      v-for="module in modules"
      :key="module.key"
      class="jobs-recipient-section"
      :model-value="getInput(module.key)"
      :disabled="disabled"
      :title="module.label"
      :recipients="getRecipients(module.key)"
      empty-label="No recipients yet."
      @update:model-value="emit('updateInput', module.key, $event)"
      @add="emit('addRecipient', module.key)"
      @remove="emit('removeRecipient', module.key, $event)"
    />
  </section>
</template>

<style scoped>
.jobs-notifications-panel {
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
  --app-section-header-description-font-size: 0.92rem;
  display: grid;
  gap: var(--form-gap);
  align-content: start;
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  padding: 1rem;
  overflow: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--field);
}

.jobs-recipient-section {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.jobs-recipient-section:first-of-type {
  padding-top: 0;
  border-top: 0;
}
</style>
