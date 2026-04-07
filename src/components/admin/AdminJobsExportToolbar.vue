<script setup lang="ts">
import DatePickerField from '@/components/common/DatePickerField.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'
import AppToolbarSummary from '@/components/common/AppToolbarSummary.vue'

defineProps<{
  exportDateInWeek: string
  exportDateConfig: Record<string, unknown>
  exportWeekLabel: string
  exportWeekEnding: string
}>()

const emit = defineEmits<{
  'update:exportDateInWeek': [value: string]
  export: []
}>()
</script>

<template>
  <AppToolbarCard class="mb-4">
    <template #header>
      <div class="app-toolbar-split app-toolbar-split--center w-100">
        <AppToolbarMeta
          eyebrow="Office Export"
          title="Export Submitted Timecards"
          subtitle="Select any date in the week to export submitted timecards across all jobs."
          title-tag="h3"
          title-class="h5 mb-0"
        />
      </div>
    </template>

    <div class="app-toolbar-split app-toolbar-split--center">
      <div class="app-toolbar-controls">
        <div class="app-toolbar-controls__field">
          <DatePickerField
            :model-value="exportDateInWeek"
            :config="exportDateConfig"
            label="Select date in week"
            label-class="small text-muted mb-1"
            wrapper-class="mb-0"
            size="sm"
            placeholder="Select any date"
            input-aria-label="Week ending date"
            @update:model-value="(value) => emit('update:exportDateInWeek', value)"
          />
        </div>
      </div>

      <div class="app-toolbar-actions app-toolbar-actions--end">
        <AppToolbarSummary compact>
          <div class="app-toolbar-summary__line">
            <span class="app-toolbar-summary__kicker">Week range</span>
            <span class="fw-semibold">{{ exportWeekLabel }}</span>
          </div>
          <div class="app-toolbar-summary__line text-muted">
            <span>Week ending Saturday: {{ exportWeekEnding }}</span>
          </div>
        </AppToolbarSummary>

        <button
          type="button"
          class="btn btn-outline-success btn-sm"
          @click="emit('export')"
        >
          <i class="bi bi-download me-1"></i>Export Submitted (all jobs)
        </button>
      </div>
    </div>
  </AppToolbarCard>
</template>
