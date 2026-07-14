<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import { getDailyLogLabel, getDailyLogTimestampLabel } from '@/features/dailyLogs/format'
import type { DailyLogRecord } from '@/types/domain'

defineProps<{
  canEdit: boolean
  deleting: boolean
  selectedLog: DailyLogRecord | null
}>()

const emit = defineEmits<{
  delete: []
}>()
</script>

<template>
  <article class="daily-log-selected-card">
    <header class="daily-log-selected-card__header">
      <div>
        <span class="daily-log-selected-card__eyebrow">Selected Log</span>
        <h2 class="daily-log-selected-card__title">{{ getDailyLogLabel(selectedLog) }}</h2>
      </div>

      <div class="daily-log-selected-card__actions">
        <AppButton
          v-if="canEdit"
          variant="danger"
          :disabled="deleting"
          @click="emit('delete')"
        >
          {{ deleting ? 'Deleting...' : 'Delete Draft' }}
        </AppButton>
      </div>
    </header>

    <div v-if="selectedLog" class="daily-log-selected-card__summary">
      <span>Status: {{ selectedLog.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
      <span>Sequence: #{{ selectedLog.sequenceNumber }}</span>
      <span>Owner: {{ selectedLog.foremanName || 'Unknown foreman' }}</span>
      <span>{{ getDailyLogTimestampLabel(selectedLog) }}</span>
    </div>

    <div v-else class="daily-log-selected-card__empty">
      No daily log is selected for this date.
    </div>
  </article>
</template>

<style scoped>
.daily-log-selected-card {
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

.daily-log-selected-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-log-selected-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-selected-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.daily-log-selected-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: flex-end;
}

.daily-log-selected-card__summary {
  display: grid;
  gap: 0.25rem;
}

.daily-log-selected-card__summary span,
.daily-log-selected-card__empty {
  color: var(--text-muted);
}

.daily-log-selected-card__empty {
  display: grid;
  place-content: center;
  min-height: 8rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

@media (max-width: 920px) {
  .daily-log-selected-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
