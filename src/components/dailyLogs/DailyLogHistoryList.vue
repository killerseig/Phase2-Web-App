<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppDateInput from '@/components/common/AppDateInput.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppField from '@/components/common/AppField.vue'
import AppListButton from '@/components/common/AppListButton.vue'
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
      panel
      class="daily-log-history-empty"
      message="Loading daily logs..."
    />

    <AppEmptyState
      v-else-if="logs.length === 0"
      panel
      class="daily-log-history-empty"
      message="No daily logs exist for this date yet."
    />

    <div v-else class="app-history-list daily-log-history-list">
      <AppListButton
        v-for="log in logs"
        :key="log.id"
        class="app-history-row daily-log-history-row"
        :active="selectedLogId === log.id"
        :aria-pressed="selectedLogId === log.id"
        :data-testid="`dailylog-history-${log.id}`"
        @click="emit('select', log.id)"
      >
        <div class="app-history-row__main">
          <strong>{{ getDailyLogLabel(log) }}</strong>
          <div class="app-history-row__meta">
            <span>{{ log.foremanName || 'Unknown foreman' }}</span>
            <span>{{ getDailyLogTimestampLabel(log) }}</span>
          </div>
        </div>
        <AppBadge class="app-history-row__badge" tone="accent">
          {{ getDailyLogStatusLabel(log) }}
        </AppBadge>
      </AppListButton>
    </div>
  </AppCard>
</template>

<style src="../common/history-list.css"></style>

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
  --app-text-input-min-height: var(--control-height-form);
  --app-text-input-padding-x: var(--control-padding-x);
}

.daily-log-history-list {
  max-height: 22rem;
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
