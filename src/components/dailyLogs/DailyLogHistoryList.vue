<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppField from '@/components/common/AppField.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import { getDailyLogLabel, getDailyLogTimestampLabel } from '@/features/dailyLogs/format'
import type { DailyLogRecord } from '@/types/domain'

defineProps<{
  loading: boolean
  logs: DailyLogRecord[]
  selectedDate: string
  selectedDateIsToday: boolean
  selectedLogId: string | null
}>()

const emit = defineEmits<{
  select: [logId: string]
  today: []
  'update:selectedDate': [value: string]
}>()
</script>

<template>
  <article class="daily-log-history-card">
    <header class="daily-log-history-card__header">
      <div>
        <span class="daily-log-history-card__eyebrow">History</span>
        <h2 class="daily-log-history-card__title">Logs for {{ selectedDate }}</h2>
      </div>
    </header>

    <div class="daily-log-history-tools">
      <AppField class="daily-log-history-field" label="Calendar Search">
        <AppTextInput
          :model-value="selectedDate"
          data-testid="dailylog-date-search"
          type="date"
          @update:model-value="emit('update:selectedDate', $event)"
        />
      </AppField>

      <AppButton
        :disabled="selectedDateIsToday"
        @click="emit('today')"
      >
        Today
      </AppButton>
    </div>

    <AppEmptyState
      v-if="loading"
      class="daily-log-history-empty"
      message="Loading daily logs..."
    />

    <AppEmptyState
      v-else-if="logs.length === 0"
      class="daily-log-history-empty"
      message="No daily logs exist for this date yet."
    />

    <div v-else class="daily-log-history-list">
      <button
        v-for="log in logs"
        :key="log.id"
        type="button"
        class="daily-log-history-row"
        :class="{ 'daily-log-history-row--active': selectedLogId === log.id }"
        :data-testid="`dailylog-history-${log.id}`"
        @click="emit('select', log.id)"
      >
        <div class="daily-log-history-row__main">
          <strong>{{ getDailyLogLabel(log) }}</strong>
          <span>{{ log.foremanName || 'Unknown foreman' }}</span>
          <span>{{ getDailyLogTimestampLabel(log) }}</span>
        </div>
        <span class="daily-log-history-badge">{{ log.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
      </button>
    </div>
  </article>
</template>

<style scoped>
.daily-log-history-card {
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

.daily-log-history-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
}

.daily-log-history-card__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-log-history-card__title {
  margin: 0.2rem 0 0;
  font-size: 1.05rem;
}

.daily-log-history-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: end;
}

.daily-log-history-field .app-text-input {
  --app-text-input-min-height: 2.55rem;
  --app-text-input-padding-x: 0.85rem;
}

.daily-log-history-empty {
  display: grid;
  place-content: center;
  min-height: 8rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
  text-align: center;
}

.daily-log-history-list {
  display: grid;
  gap: 0.65rem;
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.2rem;
  align-content: start;
}

.daily-log-history-row {
  display: grid;
  gap: 0.45rem;
  width: 100%;
  padding: 0.8rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.daily-log-history-row:hover,
.daily-log-history-row--active {
  border-color: rgba(88, 186, 233, 0.24);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.daily-log-history-row__main {
  display: grid;
  gap: 0.25rem;
}

.daily-log-history-row__main span {
  color: var(--text-muted);
}

.daily-log-history-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  width: max-content;
  padding: 0 0.7rem;
  border: 1px solid rgba(88, 186, 233, 0.22);
  border-radius: 999px;
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 920px) {
  .daily-log-history-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .daily-log-history-tools {
    grid-template-columns: 1fr;
  }
}
</style>
