<script setup lang="ts">
import './dailyLogRepeater.css'
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
      <table class="daily-log-manpower-card__table daily-log-repeater">
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
            <td :data-label="columns[0]?.label">
              <AppTextInput
                :model-value="line.trade"
                :aria-label="columns[0]?.label"
                type="text"
                :disabled="disabled"
                :placeholder="columns[0]?.placeholder || ''"
                @update:model-value="updateTextField(index, 'trade', $event)"
              />
            </td>
            <td class="daily-log-manpower-card__count" :data-label="columns[1]?.label">
              <AppTextInput
                :model-value="line.count"
                :aria-label="columns[1]?.label"
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                :disabled="disabled"
                :placeholder="columns[1]?.placeholder || ''"
                @update:model-value="updateCountField(index, $event)"
              />
            </td>
            <td :data-label="columns[2]?.label">
              <AppTextInput
                :model-value="line.areas"
                :aria-label="columns[2]?.label"
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
  --app-section-header-title-font-weight: var(--font-weight-heading);
  --app-section-header-title-letter-spacing: normal;
  --app-section-header-title-text-transform: none;
}

.daily-log-manpower-card__table-wrapper {
  overflow: auto;
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

@media (max-width: 640px) {
  .daily-log-manpower-card__table tbody tr {
    grid-template-columns: minmax(0, 1fr) 5.5rem;
  }

  .daily-log-manpower-card__count {
    width: auto;
  }
}
</style>
