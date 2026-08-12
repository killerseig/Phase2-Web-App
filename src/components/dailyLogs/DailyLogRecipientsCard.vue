<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import RecipientEditor from '@/components/RecipientEditor.vue'

defineProps<{
  adminRecipients: readonly string[]
  additionalRecipients: readonly string[]
  canEdit: boolean
  modelValue: string
  saving: boolean
}>()

const emit = defineEmits<{
  add: []
  remove: [email: string]
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <AppCard class="daily-log-recipients-card daily-logs-card">
    <AppSectionHeader
      class="daily-log-recipients-card__header"
      eyebrow="Recipients"
      title="Email List"
      title-tag="h2"
    />

    <div class="daily-log-recipients-card__groups">
      <RecipientEditor
        title="Admin Defaults"
        hint="Read only"
        :recipients="adminRecipients"
        read-only
        row-badge="Default"
        empty-label="No default recipients yet."
      />

      <RecipientEditor
        :model-value="modelValue"
        title="Additional Recipients"
        hint="Added for this log only"
        :disabled="!canEdit || saving"
        :recipients="additionalRecipients"
        empty-label="No extra recipients yet."
        @update:model-value="emit('update:modelValue', $event)"
        @add="emit('add')"
        @remove="emit('remove', $event)"
      />
    </div>
  </AppCard>
</template>

<style scoped>
.daily-log-recipients-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: 0.68rem;
  --app-section-header-eyebrow-letter-spacing: 0.12em;
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: 1.05rem;
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

.daily-log-recipients-card__groups {
  display: grid;
  gap: 0.9rem;
}

@media (max-width: 920px) {
  .daily-log-recipients-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
