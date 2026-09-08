<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import { getDailyLogLabel, getDailyLogStatusLabel, getDailyLogTimestampLabel } from '@/features/dailyLogs/format'
import type { DailyLogRecord } from '@/types/domain'

defineProps<{
  canDelete: boolean
  deleting: boolean
  selectedLog: DailyLogRecord | null
}>()

const emit = defineEmits<{
  delete: []
}>()
</script>

<template>
  <AppCard class="daily-log-selected-card">
    <AppSectionHeader
      class="daily-log-selected-card__header"
      eyebrow="Selected Log"
      :title="getDailyLogLabel(selectedLog)"
      title-tag="h2"
    >
      <template #actions>
        <div class="daily-log-selected-card__actions">
          <AppLoadingButton
            v-if="canDelete"
            label="Delete Draft"
            loading-label="Deleting..."
            variant="danger"
            :loading="deleting"
            @click="emit('delete')"
          />
        </div>
      </template>
    </AppSectionHeader>

    <div v-if="selectedLog" class="daily-log-selected-card__summary">
      <span>Status: {{ getDailyLogStatusLabel(selectedLog) }}</span>
      <span>Sequence: #{{ selectedLog.sequenceNumber }}</span>
      <span>Owner: {{ selectedLog.foremanName || 'Unknown foreman' }}</span>
      <span>{{ getDailyLogTimestampLabel(selectedLog) }}</span>
    </div>

    <AppEmptyState
      v-else
      class="daily-log-selected-card__empty"
      message="No daily log is selected for this date."
    />
  </AppCard>
</template>

<style scoped>
.daily-log-selected-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-section-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

.daily-log-selected-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--action-gap);
  justify-content: flex-end;
}

.daily-log-selected-card__summary {
  display: grid;
  gap: 0.25rem;
}

.daily-log-selected-card__summary span {
  color: var(--text-muted);
}

.daily-log-selected-card__empty {
  display: grid;
  place-content: center;
  min-height: 8rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  text-align: center;
}

@media (max-width: 920px) {
  .daily-log-selected-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
