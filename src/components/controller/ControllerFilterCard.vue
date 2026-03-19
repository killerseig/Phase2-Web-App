<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
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

function updateCheckbox(event: Event) {
  emit('update:useWeekRange', Boolean((event.target as HTMLInputElement)?.checked))
}

function updateTradeFilter(event: Event) {
  emit('update:tradeFilter', String((event.target as HTMLInputElement)?.value || ''))
}

function updateFirstNameFilter(event: Event) {
  emit('update:firstNameFilter', String((event.target as HTMLInputElement)?.value || ''))
}

function updateLastNameFilter(event: Event) {
  emit('update:lastNameFilter', String((event.target as HTMLInputElement)?.value || ''))
}

function updateSubcontractedFilter(event: Event) {
  emit('update:subcontractedFilter', String((event.target as HTMLSelectElement)?.value || 'all') as ControllerSubcontractedFilter)
}

function updateStatusFilter(event: Event) {
  emit('update:statusFilter', String((event.target as HTMLSelectElement)?.value || 'all') as ControllerTimecardStatusFilter)
}
</script>

<template>
  <AppToolbarCard
    class="controller-card controller-filter-card mb-4"
    header-class="d-flex flex-wrap justify-content-between align-items-center gap-2"
    body-class="controller-filter-card__body"
  >
    <template #header>
      <div>
        <div class="text-muted small mb-1">Search Filters</div>
        <h3 class="h5 mb-0">Find Timecards And Export The Same Results</h3>
      </div>

      <div class="small text-muted">
        Downloads use the active search filters.
      </div>
    </template>

    <div class="row g-2 align-items-end controller-filter-grid">
      <div class="col-xl-3 col-lg-4">
        <div class="form-check form-switch controller-filter-switch">
          <input
            id="tc-use-range"
            class="form-check-input"
            type="checkbox"
            :checked="useWeekRange"
            @change="updateCheckbox"
          />
          <label class="form-check-label" for="tc-use-range">Use week range</label>
        </div>

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

        <div v-else class="row g-2">
          <div class="col-12">
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

          <div class="col-12">
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

      <div class="col-xl-3 col-lg-4">
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

      <div class="col-xl-2 col-md-4">
        <label class="form-label small text-muted mb-1 controller-filter-label">Trade</label>
        <input
          type="text"
          class="form-control form-control-sm"
          placeholder="e.g. Carpenter"
          :value="tradeFilter"
          @input="updateTradeFilter"
        />
      </div>

      <div class="col-xl-2 col-md-4">
        <label class="form-label small text-muted mb-1 controller-filter-label">First Name</label>
        <input
          type="text"
          class="form-control form-control-sm"
          placeholder="First name"
          :value="firstNameFilter"
          @input="updateFirstNameFilter"
        />
      </div>

      <div class="col-xl-2 col-md-4">
        <label class="form-label small text-muted mb-1 controller-filter-label">Last Name</label>
        <input
          type="text"
          class="form-control form-control-sm"
          placeholder="Last name"
          :value="lastNameFilter"
          @input="updateLastNameFilter"
        />
      </div>

      <div class="col-xl-2 col-md-4">
        <label class="form-label small text-muted mb-1 controller-filter-label">Subcontracted</label>
        <select
          class="form-select form-select-sm"
          :value="subcontractedFilter"
          @change="updateSubcontractedFilter"
        >
          <option value="all">All</option>
          <option value="subcontracted">Sub only</option>
          <option value="direct">Non-sub only</option>
        </select>
      </div>

      <div class="col-xl-2 col-md-4">
        <label class="form-label small text-muted mb-1 controller-filter-label">Status</label>
        <select
          class="form-select form-select-sm"
          :value="statusFilter"
          @change="updateStatusFilter"
        >
          <option value="all">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div class="col-12">
        <div class="controller-filter-footer">
          <div class="controller-search-summary controller-search-summary--compact">
            <div class="controller-search-summary__line">
              <span class="controller-search-summary__kicker">Weeks</span>
              <span class="fw-semibold">{{ currentWeekLabel }}</span>
            </div>
            <div class="controller-search-summary__line text-muted">
              <span>{{ currentFilterSummary }}</span>
              <span v-if="pendingFilterChanges" class="text-warning">Updating results...</span>
              <span v-else-if="refreshingTimecards">Refreshing current results...</span>
            </div>
          </div>

          <div class="controller-actions-grid">
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
              class="btn btn-outline-secondary btn-sm controller-actions-grid__full"
              :disabled="loadingTimecards || isDownloading"
              @click="emit('reset')"
            >
              Reset Filters
            </button>
          </div>
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
  padding: 0.8rem 1rem 0.75rem;
}

.controller-filter-card :deep(.controller-filter-card__body) {
  padding: 0.9rem 1rem 1rem;
}

.controller-filter-grid {
  --bs-gutter-x: 0.75rem;
  --bs-gutter-y: 0.7rem;
}

.controller-filter-label {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.controller-filter-switch {
  margin-bottom: 0.45rem;
  min-height: 1.25rem;
}

.controller-search-summary {
  background: rgba($primary, 0.07);
  border: 1px solid rgba($primary, 0.14);
  border-radius: 0.75rem;
  min-height: 100%;
  padding: 0.85rem 1rem;
}

.controller-search-summary--compact {
  min-height: auto;
  padding: 0.6rem 0.8rem;
}

.controller-search-summary__line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
}

.controller-search-summary__line + .controller-search-summary__line {
  margin-top: 0.2rem;
}

.controller-search-summary__kicker {
  color: rgba($body-color, 0.7);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.controller-filter-footer {
  align-items: stretch;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 0.15rem;
}

.controller-actions-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.controller-actions-grid__full {
  grid-column: 1 / -1;
}

.controller-filter-card :deep(.input-group-text) {
  padding: 0.35rem 0.55rem;
}

.controller-filter-card :deep(.form-control),
.controller-filter-card :deep(.form-select) {
  min-height: calc(1.5em + 0.55rem + 2px);
}

@media (max-width: 1199px) {
  .controller-filter-footer {
    grid-template-columns: 1fr;
  }

  .controller-actions-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 575px) {
  .controller-filter-card :deep(.panel-header),
  .controller-filter-card :deep(.controller-filter-card__body) {
    padding-left: 0.8rem;
    padding-right: 0.8rem;
  }

  .controller-actions-grid {
    grid-template-columns: 1fr;
  }

  .controller-actions-grid__full {
    grid-column: auto;
  }
}
</style>
