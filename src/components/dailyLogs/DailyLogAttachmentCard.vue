<script setup lang="ts">
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
  <article class="daily-log-attachment-card daily-logs-card">
    <header class="daily-log-attachment-card__header">
      <div>
        <span class="daily-log-attachment-card__eyebrow">Attachments</span>
        <h2 class="daily-log-attachment-card__title">{{ title }}</h2>
      </div>
    </header>

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
  </article>
</template>

<style scoped>
.daily-log-attachment-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.daily-log-attachment-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-log-attachment-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-attachment-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

@media (max-width: 920px) {
  .daily-log-attachment-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
