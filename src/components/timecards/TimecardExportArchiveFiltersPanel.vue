<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import TimecardToolbarPanel from '@/components/timecards/TimecardToolbarPanel.vue'
import type {
  TimecardExportFilterState,
  TimecardExportForemanFilterOption,
  TimecardExportJobOption,
  TimecardExportWeekStatusFilter,
} from '@/features/timecards/exportViewHelpers'

type ArchiveFilterField = 'selectedJobIds' | 'foreman' | 'status'
type ArchiveFilterValue = string | string[]

defineProps<{
  filters: Pick<TimecardExportFilterState, ArchiveFilterField>
  availableJobOptions: TimecardExportJobOption[]
  availableForemanOptions: TimecardExportForemanFilterOption[]
  weekStatusOptions: { label: string; value: TimecardExportWeekStatusFilter }[]
  mobileActive: boolean
}>()

const emit = defineEmits<{
  updateFilter: [field: ArchiveFilterField, value: ArchiveFilterValue]
}>()

function updateSelectFilter(field: ArchiveFilterField, value: unknown) {
  emit('updateFilter', field, value as ArchiveFilterValue)
}
</script>

<template>
  <TimecardToolbarPanel
    panel-id="timecard-export-panel-archive"
    title="Archive Filters"
    labelled-by="timecard-export-tab-archive"
    :mobile-active="mobileActive"
    :modifiers="['filters', 'archive']"
    collapse-at="960"
  >
    <div class="timecards-toolbar__matrix">
      <label class="timecards-toolbar__search timecards-toolbar__search--wide">
        <span>Jobs</span>
        <MultiSelect
          :model-value="filters.selectedJobIds"
          class="timecards-toolbar__multiselect"
          :options="availableJobOptions"
          option-label="label"
          option-value="id"
          overlay-class="timecards-toolbar__multiselect-overlay"
          placeholder="All Jobs"
          filter
          filter-placeholder="Search jobs"
          :filter-fields="['label', 'code', 'name']"
          :max-selected-labels="1"
          selected-items-label="{0} jobs selected"
          :show-toggle-all="false"
          show-clear
          reset-filter-on-clear
          reset-filter-on-hide
          fluid
          empty-filter-message="No jobs match this search."
          empty-message="No jobs available."
          :unstyled="false"
          @update:model-value="updateSelectFilter('selectedJobIds', $event)"
        />
      </label>

      <label class="timecards-toolbar__search">
        <span>Foreman</span>
        <Select
          :model-value="filters.foreman"
          class="timecards-toolbar__select"
          :options="availableForemanOptions"
          option-label="label"
          option-value="value"
          overlay-class="timecards-toolbar__select-overlay"
          :unstyled="false"
          fluid
          @update:model-value="updateSelectFilter('foreman', $event)"
        />
      </label>

      <label class="timecards-toolbar__search">
        <span>Status</span>
        <Select
          :model-value="filters.status"
          class="timecards-toolbar__select"
          :options="weekStatusOptions"
          option-label="label"
          option-value="value"
          overlay-class="timecards-toolbar__select-overlay"
          :unstyled="false"
          fluid
          @update:model-value="updateSelectFilter('status', $event)"
        />
      </label>
    </div>
  </TimecardToolbarPanel>
</template>

<style src="./timecard-toolbar-content.css" scoped></style>
<style src="./timecard-primevue-select.css" scoped></style>

<style scoped>
.timecards-toolbar__search--wide {
  grid-column: 1 / -1;
}

.timecards-toolbar__multiselect {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-width: 0;
  min-height: var(--timecards-toolbar-control-height);
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  box-shadow: none;
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.timecards-toolbar__multiselect:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecards-toolbar__multiselect.p-focus {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-label) {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-height: calc(var(--timecards-toolbar-control-height) - 2px);
  padding: 0 0.75rem;
  font-weight: 500;
  background: transparent;
  color: var(--timecards-toolbar-control-text);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-label.p-placeholder) {
  color: rgba(70, 77, 48, 0.72);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-dropdown) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  background: transparent;
  color: rgba(73, 89, 37, 0.82);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-clear-icon) {
  color: rgba(73, 89, 37, 0.72);
}

.timecards-toolbar__multiselect :deep(.p-multiselect-option.p-multiselect-option-selected) {
  background: var(--timecards-toolbar-control-bg-active);
  color: #24411c;
}

.timecards-toolbar__multiselect :deep(.p-multiselect-option.p-multiselect-option-selected.p-focus) {
  background: rgba(214, 233, 197, 0.98);
}

:deep(.timecards-toolbar__multiselect-overlay) {
  border: 1px solid rgba(205, 214, 189, 0.96);
  border-radius: 0.6rem;
  background: rgba(255, 255, 251, 0.99);
  box-shadow:
    0 14px 30px rgba(50, 58, 34, 0.12),
    0 3px 8px rgba(50, 58, 34, 0.08);
  overflow: hidden;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-header) {
  padding: 0.7rem 0.7rem 0.42rem;
  background: transparent;
  border-bottom: none;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter-container) {
  display: block;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter) {
  min-height: 2.5rem;
  padding: 0 2.35rem 0 0.9rem;
  border: 1px solid rgba(196, 206, 182, 0.95);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: none;
  color: rgba(51, 61, 39, 0.92);
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter::placeholder) {
  color: rgba(85, 96, 64, 0.68);
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter:focus) {
  outline: none;
  border-color: rgba(157, 190, 134, 0.96);
  box-shadow: 0 0 0 1px rgba(197, 228, 186, 0.72);
}

:deep(.timecards-toolbar__multiselect-overlay .p-inputicon) {
  color: rgba(120, 134, 97, 0.86);
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-list-container) {
  padding: 0 0.35rem 0.4rem;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-list) {
  display: grid;
  gap: 0.08rem;
  padding: 0;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option) {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 2.45rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.35rem;
  background: transparent;
  color: rgba(43, 54, 34, 0.94);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-focus) {
  background: rgba(241, 246, 235, 0.94);
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-multiselect-option-selected) {
  background: rgba(198, 238, 207, 0.82);
  color: rgba(35, 80, 44, 0.96);
  box-shadow: inset 0 0 0 1px rgba(164, 211, 174, 0.88);
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-multiselect-option-selected.p-focus) {
  background: rgba(188, 233, 199, 0.92);
}

:deep(.timecards-toolbar__multiselect-overlay .p-checkbox) {
  flex: 0 0 auto;
}

:deep(.timecards-toolbar__multiselect-overlay .p-checkbox-box) {
  width: 1.1rem;
  height: 1.1rem;
  border: 1px solid rgba(190, 202, 173, 0.95);
  border-radius: 0.24rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: none;
}

:deep(.timecards-toolbar__multiselect-overlay .p-checkbox.p-checkbox-checked .p-checkbox-box) {
  border-color: rgba(68, 182, 108, 0.98);
  background: rgba(68, 182, 108, 0.98);
  color: #fff;
}

:deep(.timecards-toolbar__multiselect-overlay .p-checkbox-icon) {
  width: 0.72rem;
  height: 0.72rem;
}

:deep(.timecards-toolbar__multiselect-overlay .p-multiselect-empty-message) {
  padding: 0.7rem 0.8rem 0.8rem;
  color: rgba(85, 96, 64, 0.82);
}
</style>
