<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import ImageUploadPicker from '@/components/ImageUploadPicker.vue'
import type { DailyLogAttachmentRecord } from '@/types/domain'

defineProps<{
  attachments: DailyLogAttachmentRecord[]
  busy: boolean
  chooseLabel: string
  descriptionLabel: string
  disabled: boolean
  emptyLabel: string
  helperText: string
  title: string
  uploadHandler: (entries: Array<{ file: File; description: string }>) => Promise<void>
}>()

const emit = defineEmits<{
  'update-description': [payload: { path: string; description: string }]
  'commit-description': []
  remove: [path: string]
}>()
</script>

<template>
  <AppCard class="daily-log-attachment-card daily-logs-card">
    <AppSectionHeader
      class="daily-log-attachment-card__header"
      eyebrow="Attachments"
      :title="title"
      title-tag="h2"
    />

    <ImageUploadPicker
      :choose-label="chooseLabel"
      :description-label="descriptionLabel"
      :empty-label="emptyLabel"
      :helper-text="helperText"
      :attachments="attachments"
      :disabled="disabled"
      :busy="busy"
      :upload-handler="uploadHandler"
      @update-description="emit('update-description', $event)"
      @commit-description="emit('commit-description')"
      @remove="emit('remove', $event)"
    />
  </AppCard>
</template>

<style scoped>
.daily-log-attachment-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: 0.68rem;
  --app-section-header-eyebrow-letter-spacing: 0.12em;
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: 1.05rem;
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

@media (max-width: 920px) {
  .daily-log-attachment-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
