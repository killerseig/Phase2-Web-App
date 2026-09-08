<script setup lang="ts">
import AppCard from '@/components/common/AppCard.vue'
import AppIconButton from '@/components/common/AppIconButton.vue'
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { DailyLogManpowerFieldKey, DailyLogRepeaterColumnSchema } from '@/features/dailyLogs/schema'
import type { DailyLogManpowerLineRecord } from '@/types/domain'

defineProps<{
  columns: readonly DailyLogRepeaterColumnSchema<DailyLogManpowerFieldKey>[]
  disabled: boolean
  lines: DailyLogManpowerLineRecord[]
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
  'update-field': [payload: { index: number; field: DailyLogManpowerFieldKey; value: string | number }]
}>()

function updateTextField(index: number, field: DailyLogManpowerFieldKey, value: string) {
  emit('update-field', { index, field, value })
}

function updateCountField(index: number, value: string) {
  emit('update-field', {
    index,
    field: 'count',
    value: value === '' ? value : Number(value),
  })
}
</script>

<template>
  <AppCard class="daily-log-manpower-card daily-logs-card">
    <AppSectionHeader
      class="daily-log-manpower-card__header"
      eyebrow="Manpower"
      title="Crew On Site"
      title-tag="h2"
    />

    <div class="daily-log-manpower-card__table-wrapper">
      <table class="daily-log-manpower-card__table">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key">{{ column.label }}</th>
            <th class="daily-log-manpower-card__actions">
              <AppIconButton
                class="daily-log-manpower-card__add"
                label="Add manpower row"
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
            v-for="(line, index) in lines"
            :key="`manpower-${index}`"
          >
            <td>
              <AppTextInput
                :model-value="line.trade"
                type="text"
                :disabled="disabled"
                :placeholder="columns[0]?.placeholder || ''"
                @update:model-value="updateTextField(index, 'trade', $event)"
              />
            </td>
            <td class="daily-log-manpower-card__count">
              <AppTextInput
                :model-value="line.count"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                :disabled="disabled"
                :placeholder="columns[1]?.placeholder || ''"
                @update:model-value="updateCountField(index, $event)"
              />
            </td>
            <td>
              <AppTextInput
                :model-value="line.areas"
                type="text"
                :disabled="disabled"
                :placeholder="columns[2]?.placeholder || ''"
                @update:model-value="updateTextField(index, 'areas', $event)"
              />
            </td>
            <td class="daily-log-manpower-card__actions">
              <AppIconButton
                class="daily-log-manpower-card__remove"
                :label="`Remove manpower row ${index + 1}`"
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
.daily-log-manpower-card {
  --app-section-header-copy-gap: 0.2rem;
  --app-section-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-section-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-section-header-title-color: var(--text);
  --app-section-header-title-font-size: var(--font-size-section-title);
  --app-section-header-title-font-weight: 700;
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

.daily-log-manpower-card__table-wrapper {
  overflow: auto;
}

.daily-log-manpower-card__table {
  --app-text-input-min-height: 2.55rem;
  --app-text-input-padding-x: 0.85rem;
  --app-text-input-border: var(--border);
  --app-text-input-radius: var(--control-radius);
  --app-text-input-background: var(--control-background);
  width: 100%;
  border-collapse: collapse;
}

.daily-log-manpower-card__table th,
.daily-log-manpower-card__table td {
  padding: 0.45rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-align: left;
}

.daily-log-manpower-card__table th {
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-log-manpower-card__count {
  width: 8rem;
}

.daily-log-manpower-card__actions {
  width: 3.5rem;
  text-align: right;
}

@media (max-width: 920px) {
  .daily-log-manpower-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
