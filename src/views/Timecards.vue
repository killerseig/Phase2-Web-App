<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import TimecardCreateModal from '@/components/timecards/TimecardCreateModal.vue'
import TimecardEditorCard from '@/components/timecards/TimecardEditorCard.vue'
import TimecardSummaryModal from '@/components/timecards/TimecardSummaryModal.vue'
import TimecardsToolbar from '@/components/timecards/TimecardsToolbar.vue'
import {
  createEmptyTimecardCreateForm,
  type TimecardCreateForm,
  type TimecardSummaryRow,
} from '@/components/timecards/timecardPageModels'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { usePermissions } from '@/composables/usePermissions'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'
import { createDatePickerConfig, getTodayDateInputValue } from '@/utils/dateInputs'
import { formatWeekRange, getSaturdayFromSunday, snapToSunday } from '@/utils/modelValidation'
import { validateRequired } from '@/utils/validation'
import { ROLES, ROUTE_NAMES } from '@/constants/app'
import {
  createEmptyTimecardEmployeeEditorForm,
  makeDaysArray,
  parseSubcontractedEmployee,
  parseWage,
  recalcTotalsForTimecard,
  type TimecardEmployeeEditorForm,
  type TimecardModel,
} from './timecards/timecardUtils'
import { useTimecardEmployeeEditing } from './timecards/useTimecardEmployeeEditing'
import { useTimecardJobEditing } from './timecards/useTimecardJobEditing'
import { useTimecardWorkflow } from './timecards/useTimecardWorkflow'

const props = defineProps<{ jobId?: string }>()

const router = useRouter()
const auth = useAuthStore()
const jobsStore = useJobsStore()
const permissions = usePermissions()
const { confirm } = useConfirmDialog()
const isAdmin = computed(() => auth.role === ROLES.ADMIN)

const toast = useToast()

const jobId = computed(() => String(props.jobId ?? ''))
const jobName = computed(() => jobsStore.currentJob?.name ?? 'Timecards')
const selectedDate = ref<string>(getTodayDateInputValue())
const weekStartDate = computed(() => snapToSunday(selectedDate.value || getTodayDateInputValue()))
const weekEndingDate = computed(() => getSaturdayFromSunday(weekStartDate.value))
const weekRange = computed(() => formatWeekRange(weekStartDate.value, weekEndingDate.value))

const showSummaryModal = ref(false)

const editingTimecardId = ref<string | null>(null)
const expandedId = ref<string | null>(null)
const editForm = ref<TimecardEmployeeEditorForm>(createEmptyTimecardEmployeeEditorForm())

const showCreateForm = ref(false)
const newTimecardForm = ref<TimecardCreateForm>(createEmptyTimecardCreateForm())

const flatpickrConfig = ref(createDatePickerConfig())
const subscriptions = useSubscriptionRegistry()

const {
  autoGenerating,
  autoSave,
  cleanupWorkflow,
  draftTimecards,
  err,
  generateFromPreviousWeek,
  handleDeleteTimecard,
  init,
  loading,
  refreshWeek,
  submittingAll,
  submitAllTimecards,
  timecards,
} = useTimecardWorkflow({
  jobId,
  selectedDate,
  weekStartDate,
  weekEndingDate,
  weekRange,
  editingTimecardId,
  expandedId,
  showCreateForm,
  canAccessJob: permissions.canAccessJob,
  authReady: () => auth.ready,
  initAuth: () => auth.init(),
  subscribeJob: (nextJobId) => jobsStore.subscribeJob(nextJobId),
  stopCurrentJobSubscription: () => jobsStore.stopCurrentJobSubscription(),
  navigateUnauthorized: () => router.push({ name: ROUTE_NAMES.UNAUTHORIZED }),
  subscriptions,
  toast,
  confirm,
  recalcTotals,
})

const allTimecards = computed(() => {
  const drafts = Array.from(draftTimecards.value.values())
  return [...timecards.value, ...drafts].sort((a, b) => a.employeeName.localeCompare(b.employeeName))
})

const summaryRows = computed<TimecardSummaryRow[]>(() => allTimecards.value.map(tc => ({
  id: tc.id,
  employeeName: tc.employeeName,
  employeeNumber: tc.employeeNumber,
  status: tc.status,
  hours: tc.totals?.hoursTotal ?? 0,
  production: tc.totals?.productionTotal ?? 0,
  lineTotal: tc.totals?.lineTotal ?? 0,
})))

const draftCount = computed(() => allTimecards.value.filter(tc => tc.status === 'draft').length)
const submittedCount = computed(() => allTimecards.value.filter(tc => tc.status === 'submitted').length)

type TimecardIdentityInput = {
  firstName: string
  lastName: string
  employeeNumber: string
}

function validateTimecardIdentity(input: TimecardIdentityInput): string | null {
  const errors = [
    ...validateRequired(input.firstName, 'First name'),
    ...validateRequired(input.lastName, 'Last name'),
    ...validateRequired(input.employeeNumber, 'Employee number'),
  ]
  return errors[0]?.message ?? null
}

function createDraft(): TimecardModel {
  const days = makeDaysArray(weekStartDate.value)
  const firstName = newTimecardForm.value.firstName.trim()
  const lastName = newTimecardForm.value.lastName.trim()
  return {
    id: `temp-${Date.now()}`,
    jobId: jobId.value,
    weekStartDate: weekStartDate.value,
    weekEndingDate: weekEndingDate.value,
    status: 'draft',
    createdByUid: auth.user?.uid ?? '',
    submittedAt: undefined,
    employeeRosterId: '',
    employeeNumber: newTimecardForm.value.employeeNumber,
    employeeName: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    employeeWage: parseWage(newTimecardForm.value.employeeWage),
    subcontractedEmployee: parseSubcontractedEmployee(newTimecardForm.value.subcontractedEmployee),
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    mileage: null,
    occupation: newTimecardForm.value.occupation,
    jobs: [
      {
        jobNumber: '',
        subsectionArea: '',
        area: '',
        account: '',
        acct: '',
        difH: '',
        difP: '',
        difC: '',
        days: makeDaysArray(weekStartDate.value),
      },
    ],
    days,
    totals: {
      hours: Array(7).fill(0),
      production: Array(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
    notes: '',
    archived: false,
    archivedAt: undefined,
  }
}

function recalcTotals(timecard: TimecardModel) {
  recalcTotalsForTimecard(timecard, weekStartDate.value)
}

function handleWeekPickerChange(dateStr: string) {
  void refreshWeek(dateStr)
}

function startCreateTimecard() {
  newTimecardForm.value = createEmptyTimecardCreateForm()
  showCreateForm.value = true
}

function cancelCreateTimecard() {
  showCreateForm.value = false
}

function confirmCreateTimecard() {
  const validationMessage = validateTimecardIdentity({
    firstName: newTimecardForm.value.firstName,
    lastName: newTimecardForm.value.lastName,
    employeeNumber: newTimecardForm.value.employeeNumber,
  })
  if (validationMessage) {
    toast.show(validationMessage, 'error')
    return
  }
  newTimecardForm.value.firstName = newTimecardForm.value.firstName.trim()
  newTimecardForm.value.lastName = newTimecardForm.value.lastName.trim()
  newTimecardForm.value.employeeNumber = newTimecardForm.value.employeeNumber.trim()
  newTimecardForm.value.occupation = newTimecardForm.value.occupation.trim()
  const draft = createDraft()
  draftTimecards.value.set(draft.id, draft)
  editingTimecardId.value = null
  editForm.value = createEmptyTimecardEmployeeEditorForm()
  expandedId.value = draft.id
  showCreateForm.value = false
}

function openSummary() {
  showSummaryModal.value = true
}

function closeSummary() {
  showSummaryModal.value = false
}

const {
  handleTimecardToggle,
  handleNotesInput,
  toggleEditingEmployee,
  updateMileage,
} = useTimecardEmployeeEditing({
  editForm,
  editingTimecardId,
  expandedId,
  toast,
  recalcTotals,
  autoSave,
  validateTimecardIdentity,
})

const {
  addJobRow,
  removeJobRow,
  updateJobNumber,
  updateSubsectionArea,
  updateAccount,
  updateDiffValue,
  handleHoursInput,
  handleProductionInput,
} = useTimecardJobEditing({
  getWeekStartDate: () => weekStartDate.value,
  recalcTotals,
  autoSave,
})

onMounted(() => {
  void init()
})
watch(
  () => jobId.value,
  (next, prev) => {
    if (!next || next === prev) return
    void init()
  }
)
onUnmounted(() => {
  cleanupWorkflow()
})
</script>

<template>
  <div class="timecards-page">
    

    <div class="app-page">
      <AppPageHeader eyebrow="Job Timecards" :title="jobName">
        <template #meta>
          <span>{{ weekRange }}</span>
          <span>Week ending Saturday: {{ weekEndingDate }}</span>
        </template>
        <template #actions>
          <button
            class="btn btn-outline-secondary btn-sm"
            title="Copy timecards from previous week"
            :disabled="autoGenerating || loading"
            @click="generateFromPreviousWeek"
          >
            <i class="bi bi-arrow-repeat me-1"></i>
            {{ autoGenerating ? 'Generating...' : 'Previous Week' }}
          </button>
        </template>
      </AppPageHeader>

      <AppAlert
        v-if="err"
        variant="danger"
        title="Error:"
        :message="err"
        dismissible
        class="mb-4"
        @close="err = ''"
      />

      <AppLoadingState
        v-if="loading"
        sr-label="Loading timecards"
        message="Loading timecards..."
        spinner-class="mb-3"
      />

      <div v-else>
        <TimecardsToolbar
          v-model:selected-date="selectedDate"
          :week-picker-config="flatpickrConfig"
          :loading="loading"
          :show-create-form="showCreateForm"
          :all-timecard-count="allTimecards.length"
          :draft-count="draftCount"
          :submitted-count="submittedCount"
          :submitting-all="submittingAll"
          @change-week="handleWeekPickerChange"
          @create="startCreateTimecard"
          @open-summary="openSummary"
          @submit-all="submitAllTimecards"
        />

        <AppAlert v-if="allTimecards.length === 0" variant="info" class="text-center">
          <i class="bi bi-inbox me-2"></i>No timecards yet.
        </AppAlert>

        <div v-else class="timecards-accordion">
          <TimecardEditorCard
            v-for="timecard in allTimecards"
            :key="timecard.id"
            v-model:edit-form="editForm"
            :item-key="timecard.id"
            :timecard="timecard"
            :open="expandedId === timecard.id"
            :is-editing="editingTimecardId === timecard.id"
            :is-admin="isAdmin"
            :job-fields-locked="timecard.status === 'submitted'"
            :notes-locked="timecard.status === 'submitted'"
            :edit-disabled="timecard.status === 'submitted' && !isAdmin"
            :delete-disabled="timecard.status === 'submitted'"
            :mileage-disabled="timecard.status === 'submitted' && !isAdmin"
            @update:open="(open) => handleTimecardToggle(timecard.id, open)"
            @toggle-edit="toggleEditingEmployee(timecard)"
            @delete="handleDeleteTimecard(timecard.id, timecard.employeeName)"
            @add-job-row="addJobRow(timecard)"
            @remove-job-row="(jobIndex) => removeJobRow(timecard, jobIndex)"
            @update-job-number="({ jobIndex, value }) => updateJobNumber(timecard, jobIndex, value)"
            @update-subsection-area="({ jobIndex, value }) => updateSubsectionArea(timecard, jobIndex, value)"
            @update-account="({ jobIndex, value }) => updateAccount(timecard, jobIndex, value)"
            @update-diff-value="({ jobIndex, field, value }) => updateDiffValue(timecard, jobIndex, field, value)"
            @update-hours="({ jobIndex, dayIndex, value }) => handleHoursInput(timecard, jobIndex, dayIndex, value)"
            @update-production="({ jobIndex, dayIndex, value }) => handleProductionInput(timecard, jobIndex, dayIndex, value)"
            @update-mileage="(value) => updateMileage(timecard, value)"
            @update-notes="(value) => handleNotesInput(timecard, value)"
          />
        </div>
      </div>
    </div>

    <TimecardCreateModal
      :open="showCreateForm"
      v-model:form="newTimecardForm"
      @close="cancelCreateTimecard"
      @submit="confirmCreateTimecard"
    />
  </div>

  <TimecardSummaryModal
    :open="showSummaryModal"
    :week-ending-date="weekEndingDate"
    :week-range="weekRange"
    :summary-rows="summaryRows"
    @close="closeSummary"
  />
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.timecards-page {
  background: $body-bg;
  min-height: 100%;
}

.timecards-accordion :deep(.timecard-editor-card) {
  margin-bottom: 0 !important;
  border-radius: 0;
}

.timecards-accordion :deep(.timecard-editor-card:first-child) {
  border-top-left-radius: var(--bs-border-radius);
  border-top-right-radius: var(--bs-border-radius);
}

.timecards-accordion :deep(.timecard-editor-card:last-child) {
  border-bottom-left-radius: var(--bs-border-radius);
  border-bottom-right-radius: var(--bs-border-radius);
}

.date-input-group {
  max-width: 210px;
}

@media (max-width: 768px) {
  .timecards-accordion :deep(.timecard-editor-card) {
    border-radius: 0;
  }
}
</style>

