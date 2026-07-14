<script setup lang="ts">
import RecipientEditor from '@/components/RecipientEditor.vue'
import type { NotificationModuleKey, NotificationRecipients } from '@/types/domain'

defineProps<{
  description: string
  modules: ReadonlyArray<{ key: NotificationModuleKey; label: string }>
  recipients: NotificationRecipients
  inputs: Record<NotificationModuleKey, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  updateInput: [moduleKey: NotificationModuleKey, value: string]
  addRecipient: [moduleKey: NotificationModuleKey]
  removeRecipient: [moduleKey: NotificationModuleKey, email: string]
}>()
</script>

<template>
  <section class="jobs-notifications-panel">
    <div class="jobs-notifications-panel__header">
      <strong>Email Recipients</strong>
      <span>{{ description }}</span>
    </div>

    <RecipientEditor
      v-for="module in modules"
      :key="module.key"
      class="jobs-recipient-section"
      :model-value="inputs[module.key]"
      :disabled="disabled"
      :title="module.label"
      :recipients="recipients[module.key]"
      empty-label="No recipients yet."
      @update:model-value="emit('updateInput', module.key, $event)"
      @add="emit('addRecipient', module.key)"
      @remove="emit('removeRecipient', module.key, $event)"
    />
  </section>
</template>

<style scoped>
.jobs-notifications-panel {
  display: grid;
  gap: 0.85rem;
  align-content: start;
  min-width: 0;
  min-height: 0;
  max-height: 100%;
  padding: 1rem;
  overflow: auto;
  scrollbar-gutter: stable;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.jobs-notifications-panel__header {
  display: grid;
  gap: 0.2rem;
}

.jobs-notifications-panel__header strong {
  color: var(--text);
  font-size: 1rem;
}

.jobs-notifications-panel__header span {
  color: var(--text-muted);
  font-size: 0.92rem;
  line-height: 1.4;
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
