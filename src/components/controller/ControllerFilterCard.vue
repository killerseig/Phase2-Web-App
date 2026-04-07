<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import BaseCheckboxField from '@/components/common/BaseCheckboxField.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppToolbarMeta from '@/components/common/AppToolbarMeta.vue'
import AppToolbarSummary from '@/components/common/AppToolbarSummary.vue'
import DatePickerField from '@/components/common/DatePickerField.vue'
import SearchSelectField from '@/components/common/SearchSelectField.vue'
import type {
  ControllerSubcontractedFilter,
  ControllerTimecardStatusFilter,
} from '@/services/Email'

defineOptions({
  name: 'ControllerFilterCard',
})

type JobOption = {
  id: string
  label: string
}

interface Props {
  embedded?: boolean
  useWeekRange: boolean
  selectedSingleDate: string
  selectedRangeStartDate: string
  selectedRangeEndDate: string
  weekPickerConfig: Record<string, unknown>
  selectedJobId: string
  jobOptions: JobOption[]
  tradeFilter: string
  firstNameFilter: string
  lastNameFilter: string
  subcontractedFilter: ControllerSubcontractedFilter
  statusFilter: ControllerTimecardStatusFilter
  currentWeekLabel: string
  currentFilterSummary: string
  pendingFilterChanges: boolean
  refreshingTimecards: boolean
  downloadingPdf: boolean
  downloadingCsv: boolean
  isDownloading: boolean
  loadingTimecards: boolean
  filterValidationError: string
}

defineProps<Props>()

const emit = defineEmits<{
  'update:useWeekRange': [value: boolean]
  'update:selectedSingleDate': [value: string]
  'update:selectedRangeStartDate': [value: string]
  'update:selectedRangeEndDate': [value: string]
  'update:selectedJobId': [value: string]
  'update:tradeFilter': [value: string]
  'update:firstNameFilter': [value: string]
  'update:lastNameFilter': [value: string]
  'update:subcontractedFilter': [value: ControllerSubcontractedFilter]
  'update:statusFilter': [value: ControllerTimecardStatusFilter]
  download: [format: 'csv' | 'pdf']
  reset: []
}>()

const subcontractedOptions = [
  { value: 'all', label: 'All' },
  { value: 'subcontracted', label: 'Sub only' },
  { value: 'direct', label: 'Non-sub only' },
] as const

const statusOptions = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'draft', label: 'Draft' },
] as const
</script>

<template>
  <AppToolbarCard
    :class="['controller-card controller-filter-card', embedded ? 'controller-filter-card--embedded' : '']"
    :header-class="embedded ? '' : 'd-flex flex-wrap justify-content-between align-items-center gap-2'"
    body-class="controller-filter-card__body"
  >
    <template v-if="!embedded" #header>
      <AppToolbarMeta
        eyebrow="Search Filters"
        title="Find & Export Timecards"
        title-tag="h3"
        title-class="mb-0 controller-filter-card__title"
        subtitle="Downloads use the active search filters."
      />
    </template>

    <div class="controller-filter-stack">
      <div class="controller-filter-stack__section">
        <BaseCheckboxField
          id="tc-use-range"
          :model-value="useWeekRange"
          label="Use week range"
          variant="switch"
          wrapper-class="controller-filter-switch"
          @update:model-value="emit('update:useWeekRange', $event)"
        />

        <div v-if="!useWeekRange">
          <DatePickerField
            :model-value="selectedSingleDate"
            :config="weekPickerConfig"
            label="Select Any Date In Week"
            label-class="form-label small text-muted mb-1 controller-filter-label"
            prepend-icon="bi bi-calendar-date"
            size="sm"
            input-aria-label="Select week for controller search"
            @update:model-value="emit('update:selectedSingleDate', $event)"
          />
        </div>

        <div v-else class="controller-filter-stack__range-grid">
          <div>
            <DatePickerField
              :model-value="selectedRangeStartDate"
              :config="weekPickerConfig"
              label="Start Week"
              label-class="form-label small text-muted mb-1 controller-filter-label"
              prepend-icon="bi bi-calendar-range"
              size="sm"
              input-aria-label="Select start week"
              @update:model-value="emit('update:selectedRangeStartDate', $event)"
            />
          </div>

          <div>
            <DatePickerField
              :model-value="selectedRangeEndDate"
              :config="weekPickerConfig"
              label="End Week"
              label-class="form-label small text-muted mb-1 controller-filter-label"
              prepend-icon="bi bi-calendar-range"
              size="sm"
              input-aria-label="Select end week"
              @update:model-value="emit('update:selectedRangeEndDate', $event)"
            />
          </div>
        </div>
      </div>

      <div class="controller-filter-stack__section">
        <SearchSelectField
          :model-value="selectedJobId"
          :options="jobOptions"
          label="Job"
          label-class="form-label small text-muted mb-1 controller-filter-label"
          placeholder="Search jobs..."
          prepend-icon="bi bi-building"
          clear-label="All jobs"
          clear-aria-label="Clear job filter"
          empty-message-prefix="No jobs match"
          @update:model-value="emit('update:selectedJobId', $event)"
        />
      </div>

      <div class="controller-filter-grid-compact">
        <BaseInputField
          :model-value="tradeFilter"
          label="Trade"
          label-class="form-label small text-muted mb-1 controller-filter-label"
          input-class="form-control form-control-sm"
          wrapper-class="mb-0"
          placeholder="e.g. Carpenter"
          @update:model-value="emit('update:tradeFilter', $event)"
        />

        <BaseInputField
          :model-value="firstNameFilter"
          label="First Name"
          label-class="form-label small text-muted mb-1 controller-filter-label"
          input-class="form-control form-control-sm"
          wrapper-class="mb-0"
          placeholder="First name"
          @update:model-value="emit('update:firstNameFilter', $event)"
        />

        <BaseInputField
          :model-value="lastNameFilter"
          label="Last Name"
          label-class="form-label small text-muted mb-1 controller-filter-label"
          input-class="form-control form-control-sm"
          wrapper-class="mb-0"
          placeholder="Last name"
          @update:model-value="emit('update:lastNameFilter', $event)"
        />

        <BaseSelectField
          :model-value="subcontractedFilter"
          :options="subcontractedOptions"
          label="Subcontracted"
          label-class="form-label small text-muted mb-1 controller-filter-label"
          select-class="form-select form-select-sm"
          wrapper-class="mb-0"
          @update:model-value="emit('update:subcontractedFilter', $event as ControllerSubcontractedFilter)"
        />

        <BaseSelectField
          :model-value="statusFilter"
          :options="statusOptions"
          label="Status"
          label-class="form-label small text-muted mb-1 controller-filter-label"
          select-class="form-select form-select-sm"
          wrapper-class="mb-0 controller-filter-grid-compact__span-2"
          @update:model-value="emit('update:statusFilter', $event as ControllerTimecardStatusFilter)"
        />
      </div>

      <div class="controller-filter-footer">
        <AppToolbarSummary compact>
          <div class="app-toolbar-summary__line">
            <span class="app-toolbar-summary__kicker">Weeks</span>
            <span class="fw-semibold">{{ currentWeekLabel }}</span>
          </div>
          <div class="app-toolbar-summary__line text-muted">
            <span>{{ currentFilterSummary }}</span>
            <span v-if="pendingFilterChanges" class="text-warning">Updating results...</span>
            <span v-else-if="refreshingTimecards">Refreshing current results...</span>
          </div>
        </AppToolbarSummary>

        <div class="controller-filter-actions">
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            :disabled="isDownloading || !!filterValidationError"
            @click="emit('download', 'pdf')"
          >
            <span v-if="downloadingPdf" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-file-earmark-pdf me-2"></i>
            Download PDF
          </button>

          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            :disabled="isDownloading || !!filterValidationError"
            @click="emit('download', 'csv')"
          >
            <span v-if="downloadingCsv" class="spinner-border spinner-border-sm me-2"></span>
            <i v-else class="bi bi-filetype-csv me-2"></i>
            Download CSV
          </button>

          <button
            type="button"
            class="btn btn-outline-secondary btn-sm controller-filter-actions__full"
            :disabled="loadingTimecards || isDownloading"
            @click="emit('reset')"
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>

    <AppAlert
      v-if="filterValidationError"
      variant="warning"
      class="mt-3 mb-0"
      :message="filterValidationError"
    />
  </AppToolbarCard>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.controller-card {
  background: $surface-2;
  border: 1px solid $border-color;
  color: $body-color;
}

.controller-filter-card :deep(.panel-header) {
  padding: 0.7rem 0.85rem 0.65rem;
}

.controller-filter-card :deep(.controller-filter-card__body) {
  padding: 0.75rem 0.85rem 0.85rem;
}

.controller-filter-card.controller-filter-card--embedded :deep(.controller-filter-card__body) {
  padding-top: 0.95rem;
}

.controller-filter-card__title {
  font-size: clamp(1.15rem, 1.55vw, 1.45rem);
  line-height: 1.1;
}

.controller-filter-stack {
  display: grid;
  gap: 0.7rem;
}

.controller-filter-stack__section {
  display: grid;
  gap: 0.45rem;
}

.controller-filter-stack__range-grid {
  display: grid;
  gap: 0.5rem;
}

.controller-filter-label {
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.controller-filter-switch {
  margin-bottom: 0.2rem;
  min-height: 1.25rem;
}

.controller-filter-grid-compact {
  display: grid;
  gap: 0.55rem 0.6rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.controller-filter-grid-compact__span-2 {
  grid-column: 1 / -1;
}

.controller-filter-footer {
  display: grid;
  gap: 0.6rem;
}

.controller-filter-actions {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.controller-filter-actions__full {
  grid-column: 1 / -1;
}

.controller-filter-card :deep(.app-toolbar-meta__eyebrow) {
  margin-bottom: 0.2rem;
}

.controller-filter-card :deep(.app-toolbar-meta__subtitle) {
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.controller-filter-card :deep(.app-toolbar-summary) {
  padding: 0.7rem 0.8rem;
}

.controller-filter-card :deep(.app-toolbar-summary__kicker) {
  font-size: 0.62rem;
}

.controller-filter-card :deep(.app-toolbar-summary__line) {
  gap: 0.45rem;
}

.controller-filter-card :deep(.btn.btn-sm) {
  min-height: calc(1.5em + 0.45rem + 2px);
  padding-block: 0.35rem;
}

.controller-filter-card :deep(.input-group-text) {
  padding: 0.32rem 0.5rem;
}

.controller-filter-card :deep(.form-control),
.controller-filter-card :deep(.form-select) {
  min-height: calc(1.5em + 0.45rem + 2px);
}

@media (max-width: 575px) {
  .controller-filter-grid-compact,
  .controller-filter-actions {
    grid-template-columns: 1fr;
  }

  .controller-filter-actions__full {
    grid-column: auto;
  }

  .controller-filter-card :deep(.panel-header),
  .controller-filter-card :deep(.controller-filter-card__body) {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }
}
</style>
