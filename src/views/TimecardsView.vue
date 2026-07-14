<script setup lang="ts">
import { ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import JobTimecardCanvasPanel from '@/components/timecards/JobTimecardCanvasPanel.vue'
import JobTimecardCreateTray from '@/components/timecards/JobTimecardCreateTray.vue'
import JobTimecardToolbar from '@/components/timecards/JobTimecardToolbar.vue'
import TimecardPageMessage from '@/components/timecards/TimecardPageMessage.vue'
import TimecardSummaryPanel from '@/components/timecards/TimecardSummaryPanel.vue'
import { useMeasuredCardScale } from '@/composables/useMeasuredCardScale'
import { usePageMessages } from '@/composables/usePageMessages'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import {
  mergeJobTimecardRemoteCardsWithLocalState,
  type JobTimecardSortMode,
} from '@/features/timecards/jobViewHelpers'
import { MAX_TIMECARD_CARD_SCALE } from '@/features/timecards/layout'
import { useJobTimecardCardActions } from '@/features/timecards/useJobTimecardCardActions'
import { useJobTimecardCardWorkspaceActions } from '@/features/timecards/useJobTimecardCardWorkspaceActions'
import { useJobTimecardCreateActions } from '@/features/timecards/useJobTimecardCreateActions'
import { useJobTimecardConfirmDialog } from '@/features/timecards/useJobTimecardConfirmDialog'
import { useJobTimecardCreateTray } from '@/features/timecards/useJobTimecardCreateTray'
import { useJobTimecardRecords } from '@/features/timecards/useJobTimecardRecords'
import { useJobTimecardSaveQueue } from '@/features/timecards/useJobTimecardSaveQueue'
import { useJobTimecardSubscriptionLifecycle } from '@/features/timecards/useJobTimecardSubscriptionLifecycle'
import { useJobTimecardSummary } from '@/features/timecards/useJobTimecardSummary'
import { useJobTimecardWeekActions } from '@/features/timecards/useJobTimecardWeekActions'
import { useJobTimecardWeekSelectionActions } from '@/features/timecards/useJobTimecardWeekSelectionActions'
import { useJobTimecardWorkspaceState } from '@/features/timecards/useJobTimecardWorkspaceState'
import { useJobTimecardWorkspaceSync } from '@/features/timecards/useJobTimecardWorkspaceSync'
import { useTimecardCardSelection } from '@/features/timecards/useTimecardCardSelection'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import type { TimecardCardRecord } from '@/types/domain'

type WorkbookSortMode = JobTimecardSortMode
type MobileToolbarTabKey = 'week' | 'search' | 'actions' | 'sort' | 'history'

const auth = useAuthStore()
const {
  job,
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
} = useRouteJobContext()

const cardSearchTerm = ref('')
const selectedWeekEndDate = ref('')
const selectedWeekId = ref<string | null>(null)
const {
  pageError,
  pageInfo,
  resetMessages,
  setPageError,
  setPageErrorMessage,
  setPageInfo,
} = usePageMessages()
const {
  cards,
  cardsLoading,
  employees,
  employeesLoading,
  startCardsRecordsSubscription,
  startEmployeesSubscription,
  startWeeksRecordsSubscription,
  stopCardsRecordsSubscription,
  stopEmployeesSubscription,
  stopWeeksRecordsSubscription,
  weeks,
  weeksLoading,
} = useJobTimecardRecords({
  getBurdenValue: () => burdenValue.value,
  getCurrentUserId: () => auth.currentUser?.uid ?? null,
  getIsAdmin: () => auth.isAdmin,
  getSelectedWeek: () => selectedWeek.value,
  jobId,
  mergeRemoteCardsWithLocalState,
  onCardsUpdate: (nextCards) => {
    syncCardUiState(nextCards)
  },
  onRecordsError: setPageError,
  onWeeksUpdate: () => {
    void maybeBackfillSelectedDraftWeek()
  },
})
const ensuringWeek = ref(false)
const actionLoading = ref(false)
const sortMode = ref<WorkbookSortMode>('name')
const activeMobileToolbarTab = ref<MobileToolbarTabKey>('week')
const {
  closeTimecardConfirm,
  handleTimecardConfirmOpenUpdate,
  timecardConfirmAction,
  timecardConfirmDestructive,
  timecardConfirmLabel,
  timecardConfirmMessage,
  timecardConfirmTitle,
} = useJobTimecardConfirmDialog(actionLoading)

const {
  closeCreateTray,
  customCardForm,
  employeeSearchTerm,
  resetCustomCardForm,
  showCreateTray,
  toggleCreateTray,
} = useJobTimecardCreateTray()

const {
  clearCardMeasurements,
  disconnectCardMeasurements,
  getCardScaleStyle,
  getCardShellStyle,
  pruneCardMeasurements,
  setCardContentElement,
  setCardShellElement,
} = useMeasuredCardScale(MAX_TIMECARD_CARD_SCALE)
const {
  expandAndSelectCard,
  isCardCompact,
  resetCardSelectionState,
  selectCard,
  selectedCardId,
  setAllCardsCompact,
  syncCardSelectionState,
  syncSelectedCardFromVisibleCards,
  toggleCardCompact,
} = useTimecardCardSelection<TimecardCardRecord>({
  getCards: () => cards.value,
})

const {
  availableEmployees,
  burdenValue,
  canCreateSelectedWeek,
  canEditWeek,
  filteredCards,
  recentWeeks,
  selectedWeek,
  selectedWeekStartDate,
  weeksForSelectedDate,
} = useJobTimecardWorkspaceState({
  cardSearchTerm,
  cards,
  employeeSearchTerm,
  employees,
  ensuringWeek,
  getIsAdmin: () => auth.isAdmin,
  job,
  jobId,
  selectedWeekEndDate,
  selectedWeekId,
  weeks,
  weeksLoading,
})
const {
  activeSaveCount,
  disposeSaveQueue,
  flushPendingSaves,
  lastSavedAt,
  pendingSaveCount,
  pruneSaveQueueToIds,
  queuedSaveIds,
  resetSaveQueueState,
  saveError,
  savingIds,
  scheduleCardSave,
  scheduledSaveIds,
} = useJobTimecardSaveQueue({
  burdenValue,
  canEditWeek,
  cards,
  selectedWeek,
  selectedWeekStartDate,
})
const {
  handleWorkbookChanged,
  isCardReadOnly,
  resetCardWorkspaceState,
  resetPageAndSaveMessages,
  scrollCardIntoView,
  syncCardUiState,
} = useJobTimecardCardWorkspaceActions({
  burdenValue,
  canEditWeek,
  clearCardMeasurements,
  pruneCardMeasurements,
  pruneSaveQueueToIds,
  resetCardSelectionState,
  resetMessages,
  resetSaveQueueState,
  saveError,
  scheduleCardSave,
  selectCard,
  selectedWeekStartDate,
  syncCardSelectionState,
})
const {
  accountsSummary,
  displayJobCode,
  displayJobName,
  emptyCanvasMessage,
  linkedJobNumber,
  saveStateLabel,
  totalHours,
  totalProduction,
  weekRangeLabel,
  weekStatusLabel,
} = useJobTimecardSummary({
  activeSaveCount,
  canEditWeek,
  cards,
  ensuringWeek,
  job,
  lastSavedAt,
  pendingSaveCount,
  saveError,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekStartDate,
})

const {
  handleCreateWeek,
  maybeBackfillSelectedDraftWeek,
} = useJobTimecardWeekActions({
  cards,
  closeCreateTray,
  ensuringWeek,
  flushPendingSaves,
  getCurrentUserId: () => auth.currentUser?.uid ?? null,
  getDisplayName: () => auth.displayName ?? null,
  job,
  jobId,
  resetPageAndSaveMessages,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekId,
  setPageError,
  setPageInfo,
  weeksLoading,
})

function mergeRemoteCardsWithLocalState(nextCards: TimecardCardRecord[]) {
  return mergeJobTimecardRemoteCardsWithLocalState(
    nextCards,
    cards.value,
    [scheduledSaveIds, savingIds, queuedSaveIds],
  )
}

const {
  subscribeCardsForWeek,
  subscribeJob,
  subscribeWeeksForJob,
} = useJobTimecardSubscriptionLifecycle({
  cards,
  cardsLoading,
  disconnectCardMeasurements,
  disposeSaveQueue,
  jobId,
  selectedWeek,
  startCardsRecordsSubscription,
  startEmployeesSubscription,
  startWeeksRecordsSubscription,
  stopCardsRecordsSubscription,
  stopEmployeesSubscription,
  stopRouteJobSubscription,
  stopWeeksRecordsSubscription,
  subscribeRouteJob,
})

const {
  handleAddCustomCard,
  handleAddEmployee,
} = useJobTimecardCreateActions({
  actionLoading,
  canEditWeek,
  cards,
  closeCreateTray,
  customCardForm,
  employeeSearchTerm,
  expandAndSelectCard,
  getIsAdmin: () => auth.isAdmin,
  linkedJobNumber,
  resetCustomCardForm,
  resetPageAndSaveMessages,
  scrollCardIntoView,
  selectedWeek,
  selectedWeekStartDate,
  setPageError,
  setPageErrorMessage,
})

const {
  confirmTimecardAction,
  handleRemoveCard,
  handleSortCards,
  handleSubmitWeek,
} = useJobTimecardCardActions({
  actionLoading,
  burdenValue,
  canEditWeek,
  cards,
  closeTimecardConfirm,
  flushPendingSaves,
  getSubmitActor: () => ({
    userId: auth.currentUser?.uid ?? null,
    displayName: auth.displayName ?? null,
  }),
  resetPageAndSaveMessages,
  selectCard,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekStartDate,
  setPageError,
  setPageInfo,
  sortMode,
  timecardConfirmAction,
})
const {
  handleSelectWeek,
  handleWeekEndingInput,
  handleWeekEndingPickerOpen,
} = useJobTimecardWeekSelectionActions({
  closeCreateTray,
  flushPendingSaves,
  selectedWeekEndDate,
  selectedWeekId,
})

useJobTimecardWorkspaceSync({
  burdenValue,
  cards,
  filteredCards,
  job,
  jobId,
  maybeBackfillSelectedDraftWeek,
  resetCardWorkspaceState,
  resetPageAndSaveMessages,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekId,
  subscribeCardsForWeek,
  subscribeJob,
  subscribeWeeksForJob,
  syncSelectedCardFromVisibleCards,
  weeks,
})
</script>

<template>
  <AppShell>
    <div class="timecards-page" data-testid="timecards-page">
      <section class="timecards-workbook">
        <JobTimecardToolbar
          :active-mobile-tab="activeMobileToolbarTab"
          :display-job-code="displayJobCode"
          :display-job-name="displayJobName"
          :selected-week-end-date="selectedWeekEndDate"
          :card-search-term="cardSearchTerm"
          :can-create-selected-week="canCreateSelectedWeek"
          :action-loading="actionLoading"
          :ensuring-week="ensuringWeek"
          :can-edit-week="canEditWeek"
          :has-selected-week="!!selectedWeek"
          :card-count="cards.length"
          :show-create-tray="showCreateTray"
          :sort-mode="sortMode"
          :recent-weeks="recentWeeks"
          :active-week-id="selectedWeek?.id ?? null"
          :weeks-loading="weeksLoading"
          :week-range-label="weekRangeLabel"
          :week-status-label="weekStatusLabel"
          :selected-week-submitted="selectedWeek?.status === 'submitted'"
          :save-error="saveError"
          :save-state-label="saveStateLabel"
          @update-active-mobile-tab="activeMobileToolbarTab = $event"
          @update-card-search-term="cardSearchTerm = $event"
          @update-sort-mode="sortMode = $event"
          @week-ending-input="handleWeekEndingInput"
          @week-ending-picker-open="handleWeekEndingPickerOpen"
          @create-week="handleCreateWeek"
          @toggle-create-tray="toggleCreateTray"
          @submit-week="handleSubmitWeek"
          @expand-all="setAllCardsCompact(false)"
          @compact-all="setAllCardsCompact(true)"
          @sort-cards="handleSortCards"
          @select-week="handleSelectWeek"
        />

        <JobTimecardCreateTray
          v-if="showCreateTray"
          :employee-search="employeeSearchTerm"
          :employees="availableEmployees"
          :employees-loading="employeesLoading"
          :action-loading="actionLoading"
          :can-edit-week="canEditWeek"
          :custom-first-name="customCardForm.firstName"
          :custom-last-name="customCardForm.lastName"
          :custom-employee-number="customCardForm.employeeNumber"
          :custom-occupation="customCardForm.occupation"
          :custom-wage-rate="customCardForm.wageRate"
          :custom-is-contractor="customCardForm.isContractor"
          @update-employee-search="employeeSearchTerm = $event"
          @update-custom-first-name="customCardForm.firstName = $event"
          @update-custom-last-name="customCardForm.lastName = $event"
          @update-custom-employee-number="customCardForm.employeeNumber = $event"
          @update-custom-occupation="customCardForm.occupation = $event"
          @update-custom-wage-rate="customCardForm.wageRate = $event"
          @update-custom-is-contractor="customCardForm.isContractor = $event"
          @add-employee="handleAddEmployee"
          @add-custom-card="handleAddCustomCard"
        />

        <TimecardPageMessage v-if="pageError" :message="pageError" tone="error" />
        <TimecardPageMessage v-else-if="pageInfo" :message="pageInfo" />

        <JobTimecardCanvasPanel
          :cards="filteredCards"
          :cards-loading="cardsLoading"
          :ensuring-week="ensuringWeek"
          :selected-week-end-date="selectedWeekEndDate"
          :selected-card-id="selectedCardId"
          :empty-message="emptyCanvasMessage"
          :burden="burdenValue"
          :can-edit-week="canEditWeek"
          :action-loading="actionLoading"
          :is-admin="auth.isAdmin"
          :is-card-compact="isCardCompact"
          :is-card-read-only="isCardReadOnly"
          :get-card-shell-style="getCardShellStyle"
          :get-card-scale-style="getCardScaleStyle"
          @select-card="selectCard"
          @toggle-card-compact="toggleCardCompact"
          @set-shell-element="setCardShellElement"
          @set-content-element="setCardContentElement"
          @workbook-changed="handleWorkbookChanged"
          @remove-card="handleRemoveCard"
        />

        <TimecardSummaryPanel
          :card-count="cards.length"
          :total-hours="totalHours"
          :total-production="totalProduction"
          :accounts-summary="accountsSummary"
        />
      </section>
    </div>

    <ConfirmDialog
      :open="timecardConfirmAction !== null"
      :title="timecardConfirmTitle"
      :message="timecardConfirmMessage"
      :confirm-label="timecardConfirmLabel"
      :destructive="timecardConfirmDestructive"
      :busy="actionLoading"
      @update:open="handleTimecardConfirmOpenUpdate"
      @confirm="confirmTimecardAction"
    />
  </AppShell>
</template>

<style scoped>
.timecards-page {
  display: grid;
  min-width: 0;
}

.timecards-workbook {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(88, 105, 44, 0.55);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(236, 241, 213, 0.98) 0%, rgba(213, 225, 169, 0.96) 100%);
  color: #1a1a12;
  min-width: 0;
  --timecards-toolbar-control-height: 2.3rem;
  --timecards-toolbar-control-radius: 0;
  --timecards-toolbar-control-border: rgba(88, 105, 44, 0.42);
  --timecards-toolbar-control-border-strong: rgba(63, 97, 43, 0.54);
  --timecards-toolbar-control-bg: rgba(251, 252, 246, 0.98);
  --timecards-toolbar-control-bg-muted: rgba(238, 242, 223, 0.96);
  --timecards-toolbar-control-bg-active: rgba(223, 238, 210, 0.98);
  --timecards-toolbar-control-text: #191b13;
  --timecards-toolbar-focus-ring: 0 0 0 3px rgba(102, 138, 77, 0.16);
}

</style>
