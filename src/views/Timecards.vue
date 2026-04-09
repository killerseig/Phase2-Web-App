<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import TimecardAccountsSummaryCard from '@/components/timecards/TimecardAccountsSummaryCard.vue'
import TimecardEmployeeList from '@/components/timecards/TimecardEmployeeList.vue'
import TimecardWeekToolbar from '@/components/timecards/TimecardWeekToolbar.vue'
import TimecardWeekWorkspaceLayout from '@/components/timecards/TimecardWeekWorkspaceLayout.vue'
import TimecardWorkspaceCard from '@/components/timecards/TimecardWorkspaceCard.vue'
import { useTimecardWeekPage } from '@/composables/timecards/useTimecardWeekPage'
import type { DiffField, WorkbookFooterField } from '@/types/timecards'

const props = defineProps<{ jobId?: string }>()

const jobId = computed(() => String(props.jobId ?? ''))

const {
  accountsSummary,
  changeWeek,
  cleanup,
  employeeCount,
  err,
  flatpickrConfig,
  handleNotesInput,
  init,
  isAdmin,
  jobEditing,
  jobName,
  loading,
  searchTerm,
  selectEmployee,
  selectedDate,
  selectedEmployeeId,
  selectedTimecard,
  submitWeek,
  submittingAll,
  submittedCount,
  updateFooterField,
  weekEndingDate,
  weekRange,
  workspaceEmployeeItems,
  draftCount,
} = useTimecardWeekPage(jobId)

const hasWorkspaceItems = computed(() => workspaceEmployeeItems.value.length > 0)
const selectedCardLocked = computed(() => (
  selectedTimecard.value?.status === 'submitted' && !isAdmin.value
))
const selectedWorkspaceItem = computed(() => (
  workspaceEmployeeItems.value.find((item) => item.employeeId === selectedEmployeeId.value) ?? null
))

function withSelectedTimecard(run: (timecard: NonNullable<typeof selectedTimecard.value>) => void) {
  const timecard = selectedTimecard.value
  if (!timecard) return
  run(timecard)
}

function handleUpdateJobNumber(payload: { jobIndex: number; value: string }) {
  withSelectedTimecard((timecard) => jobEditing.updateJobNumber(timecard, payload.jobIndex, payload.value))
}

function handleUpdateSubsectionArea(payload: { jobIndex: number; value: string }) {
  withSelectedTimecard((timecard) => jobEditing.updateSubsectionArea(timecard, payload.jobIndex, payload.value))
}

function handleUpdateAccount(payload: { jobIndex: number; value: string }) {
  withSelectedTimecard((timecard) => jobEditing.updateAccount(timecard, payload.jobIndex, payload.value))
}

function handleUpdateDiffValue(payload: { jobIndex: number; field: DiffField; value: string }) {
  withSelectedTimecard((timecard) => jobEditing.updateDiffValue(timecard, payload.jobIndex, payload.field, payload.value))
}

function handleUpdateOffValue(payload: { jobIndex: number; field: 'offHours' | 'offProduction' | 'offCost'; value: number }) {
  withSelectedTimecard((timecard) => jobEditing.updateOffValue(timecard, payload.jobIndex, payload.field, payload.value))
}

function handleUpdateHours(payload: { jobIndex: number; dayIndex: number; value: number }) {
  withSelectedTimecard((timecard) => jobEditing.handleHoursInput(timecard, payload.jobIndex, payload.dayIndex, payload.value))
}

function handleUpdateProduction(payload: { jobIndex: number; dayIndex: number; value: number }) {
  withSelectedTimecard((timecard) => jobEditing.handleProductionInput(timecard, payload.jobIndex, payload.dayIndex, payload.value))
}

function handleUpdateUnitCost(payload: { jobIndex: number; dayIndex: number; value: number | null }) {
  withSelectedTimecard((timecard) => jobEditing.handleUnitCostInput(timecard, payload.jobIndex, payload.dayIndex, payload.value))
}

function handleSelectedNotesUpdate(value: string) {
  withSelectedTimecard((timecard) => handleNotesInput(timecard, value))
}

function handleUpdateFooterField(payload: { field: WorkbookFooterField; value: string }) {
  withSelectedTimecard((timecard) => updateFooterField(timecard, payload.field, payload.value))
}

onMounted(() => {
  void init()
})

watch(
  () => jobId.value,
  (next, prev) => {
    if (!next || next === prev) return
    void init()
  },
)

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="timecards-page">
    <div class="app-page app-page--wide timecards-page__workspace">
      <AppPageHeader
        eyebrow="Job Timecards"
        :title="jobName"
        subtitle="Review the weekly roster, open one employee workbook, and submit draft timecards."
        compact
      >
        <template #meta>
          <span>{{ weekRange }}</span>
          <span>Week ending Saturday: {{ weekEndingDate }}</span>
        </template>
      </AppPageHeader>

      <AppAlert
        v-if="err"
        variant="danger"
        title="Error:"
        :message="err"
        class="mb-4"
      />

      <AppLoadingState
        v-if="loading"
        sr-label="Loading timecards"
        message="Loading workbook-style timecards..."
        spinner-class="mb-3"
      />

      <div v-else>
        <TimecardWeekWorkspaceLayout>
          <template #browser>
            <div class="d-grid gap-2">
              <TimecardEmployeeList
                v-model:search-term="searchTerm"
                :items="workspaceEmployeeItems"
                :loading="loading"
                :selected-employee-id="selectedEmployeeId"
                :selected-item="selectedWorkspaceItem"
                @select="selectEmployee"
              />
            </div>
          </template>

          <template #controls>
            <div class="d-grid gap-2">
              <TimecardWeekToolbar
                v-model:selected-date="selectedDate"
                :week-picker-config="flatpickrConfig"
                :loading="loading"
                :employee-count="employeeCount"
                :draft-count="draftCount"
                :submitted-count="submittedCount"
                :submitting-all="submittingAll"
                @change-week="changeWeek"
                @submit-all="submitWeek"
              />

              <TimecardAccountsSummaryCard
                :employee-count="employeeCount"
                :draft-count="draftCount"
                :submitted-count="submittedCount"
                :accounts="accountsSummary"
              />
            </div>
          </template>

          <AppEmptyState
            v-if="employeeCount === 0"
            icon="bi bi-people"
            icon-class="fs-2"
            title="No active roster employees"
            message="Add active employees to this job roster before entering weekly timecards."
          />

          <AppEmptyState
            v-else-if="!hasWorkspaceItems"
            icon="bi bi-search"
            icon-class="fs-2"
            title="No matching employees"
            message="Try a different employee search."
          />

          <AppEmptyState
            v-else-if="!selectedTimecard"
            icon="bi bi-person-badge"
            icon-class="fs-2"
            title="Select an employee"
            message="Choose an employee from the roster list to open that week's timecard."
          />

          <TimecardWorkspaceCard
            v-else
            :item-key="selectedTimecard.id"
            :timecard="selectedTimecard"
            :job-fields-locked="selectedCardLocked"
            :notes-locked="selectedCardLocked"
            @update-job-number="handleUpdateJobNumber"
            @update-subsection-area="handleUpdateSubsectionArea"
            @update-account="handleUpdateAccount"
            @update-diff-value="handleUpdateDiffValue"
            @update-off-value="handleUpdateOffValue"
            @update-hours="handleUpdateHours"
            @update-production="handleUpdateProduction"
            @update-unit-cost="handleUpdateUnitCost"
            @update-footer-field="handleUpdateFooterField"
            @update-notes="handleSelectedNotesUpdate"
          />
        </TimecardWeekWorkspaceLayout>
      </div>
    </div>
  </div>
</template>
