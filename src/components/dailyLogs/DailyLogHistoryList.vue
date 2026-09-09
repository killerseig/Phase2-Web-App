<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppDateInput from '@/components/common/AppDateInput.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppField from '@/components/common/AppField.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import { getDailyLogLabel, getDailyLogStatusLabel, getDailyLogTimestampLabel } from '@/features/dailyLogs/format'
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
  <AppCard class="daily-log-history-card">
    <AppSectionHeader
      class="daily-log-history-card__header"
      eyebrow="History"
      :title="`Logs for ${selectedDate}`"
      title-tag="h2"
    />

    <div class="daily-log-history-tools">
      <AppField class="daily-log-history-field" label="Calendar Search">
        <AppDateInput
          :model-value="selectedDate"
          data-testid="dailylog-date-search"
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
        <AppBadge class="daily-log-history-badge" tone="accent">
          {{ getDailyLogStatusLabel(log) }}
        </AppBadge>
      </button>
    </div>
  </AppCard>
</template>

<style scoped>
.daily-log-history-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-section-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: var(--font-weight-heading);
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
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
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  text-align: center;
}

.daily-log-history-list {
  display: grid;
  gap: var(--list-gap);
  max-height: 22rem;
  overflow: auto;
  padding-right: 0.2rem;
  align-content: start;
}

.daily-log-history-row {
  display: grid;
  gap: var(--field-gap);
  width: 100%;
  padding: 0.8rem;
  border: 1px solid transparent;
  border-bottom-color: var(--border-soft);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease;
}

.daily-log-history-row:hover {
  border-color: var(--border);
  background: var(--field-hover);
}

.daily-log-history-row--active,
.daily-log-history-row--active:hover {
  border-color: var(--border-strong);
  background: var(--bg-accent);
}

.daily-log-history-row:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.daily-log-history-row__main {
  display: grid;
  gap: 0.25rem;
}

.daily-log-history-row__main strong {
  font-weight: var(--font-weight-heading);
}

.daily-log-history-row__main span {
  color: var(--text-muted);
}

.daily-log-history-badge {
  --app-badge-width: max-content;
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
