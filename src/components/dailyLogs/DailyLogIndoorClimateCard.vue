<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppIconButton from '@/components/common/AppIconButton.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { DailyLogIndoorClimateFieldKey, DailyLogRepeaterColumnSchema } from '@/features/dailyLogs/schema'
import type { DailyLogIndoorClimateReadingRecord } from '@/types/domain'

defineProps<{
  columns: readonly DailyLogRepeaterColumnSchema<DailyLogIndoorClimateFieldKey>[]
  disabled: boolean
  readings: DailyLogIndoorClimateReadingRecord[]
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
  'update-field': [payload: { index: number; field: DailyLogIndoorClimateFieldKey; value: string }]
}>()

function updateField(index: number, field: DailyLogIndoorClimateFieldKey, value: string) {
  emit('update-field', {
    index,
    field,
    value,
  })
}
</script>

<template>
  <AppCard class="daily-log-climate-card daily-logs-card">
    <AppSectionHeader
      class="daily-log-climate-card__header"
      eyebrow="Indoor Climate"
      title="Indoor Temperature Readings"
      title-tag="h2"
    />

    <div class="daily-log-climate-card__table-wrapper">
      <table class="daily-log-climate-card__table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
            <th class="daily-log-climate-card__actions">
              <AppIconButton
                class="daily-log-climate-card__add"
                label="Add indoor climate row"
                variant="success"
                :disabled="disabled"
                @click="emit('add')"
              >
                <span aria-hidden="true">+</span>
              </AppIconButton>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(reading, index) in readings"
            :key="`climate-${index}`"
          >
            <td v-for="column in columns" :key="column.key">
              <AppTextInput
                :model-value="reading[column.key]"
                type="text"
                :disabled="disabled"
                :placeholder="column.placeholder"
                @update:model-value="updateField(index, column.key, $event)"
              />
            </td>
            <td class="daily-log-climate-card__actions">
              <AppIconButton
                class="daily-log-climate-card__remove"
                :label="`Remove indoor climate row ${index + 1}`"
                variant="danger"
                :disabled="disabled"
                @click="emit('remove', index)"
              >
                <i class="pi pi-times" aria-hidden="true"></i>
              </AppIconButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppCard>
</template>

<style scoped>
.daily-log-climate-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-section-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

.daily-log-climate-card__table-wrapper {
  overflow: auto;
}

.daily-log-climate-card__table {
  --app-text-input-min-height: 2.55rem;
  --app-text-input-padding-x: 0.85rem;
  --app-text-input-border: var(--border);
  --app-text-input-radius: var(--control-radius);
  --app-text-input-background: var(--control-background);
  width: 100%;
  border-collapse: collapse;
}

.daily-log-climate-card__table th,
.daily-log-climate-card__table td {
  padding: 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-align: left;
}

.daily-log-climate-card__table th {
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-log-climate-card__actions {
  width: 3.5rem;
  text-align: right;
}

@media (max-width: 920px) {
  .daily-log-climate-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
