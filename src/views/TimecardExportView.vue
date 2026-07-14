<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import TimecardExportCanvasPanel from '@/components/timecards/TimecardExportCanvasPanel.vue'
import TimecardExportCreateTray from '@/components/timecards/TimecardExportCreateTray.vue'
import TimecardPageMessage from '@/components/timecards/TimecardPageMessage.vue'
import TimecardExportToolbar from '@/components/timecards/TimecardExportToolbar.vue'
import TimecardSummaryPanel from '@/components/timecards/TimecardSummaryPanel.vue'
import { useMeasuredCardScale } from '@/composables/useMeasuredCardScale'
import { usePageMessages } from '@/composables/usePageMessages'
import {
  formatTimecardExportDate,
  formatTimecardExportWeekRowSubtitle,
  type TimecardExportArchiveCardRecord,
  type TimecardExportDateFilterMode,
  type TimecardExportSortMode,
  type TimecardExportWeekStatusFilter,
} from '@/features/timecards/exportViewHelpers'
import { MAX_TIMECARD_CARD_SCALE } from '@/features/timecards/layout'
import { useTimecardCardSelection } from '@/features/timecards/useTimecardCardSelection'
import { useTimecardExportArchiveCards } from '@/features/timecards/useTimecardExportArchiveCards'
import { useTimecardExportCardWorkspaceActions } from '@/features/timecards/useTimecardExportCardWorkspaceActions'
import { useTimecardExportConfirmDialog } from '@/features/timecards/useTimecardExportConfirmDialog'
import { useTimecardExportCreateActions } from '@/features/timecards/useTimecardExportCreateActions'
import { useTimecardExportCreateContext } from '@/features/timecards/useTimecardExportCreateContext'
import { useTimecardExportCreateDefaults } from '@/features/timecards/useTimecardExportCreateDefaults'
import { useTimecardExportCreateTray } from '@/features/timecards/useTimecardExportCreateTray'
import { useTimecardExportDownloadActions } from '@/features/timecards/useTimecardExportDownloadActions'
import { useTimecardExportFilters } from '@/features/timecards/useTimecardExportFilters'
import { useTimecardExportFilteredWeekSync } from '@/features/timecards/useTimecardExportFilteredWeekSync'
import { useTimecardExportLifecycle } from '@/features/timecards/useTimecardExportLifecycle'
import { useTimecardExportMutationActions } from '@/features/timecards/useTimecardExportMutationActions'
import { useTimecardExportSaveQueue } from '@/features/timecards/useTimecardExportSaveQueue'
import { useTimecardExportSideEffects } from '@/features/timecards/useTimecardExportSideEffects'
import { useTimecardExportSummary } from '@/features/timecards/useTimecardExportSummary'
import { useTimecardExportSubscriptions } from '@/features/timecards/useTimecardExportSubscriptions'
import {
  timecardExportMobileToolbarTabs,
  useTimecardExportUiState,
} from '@/features/timecards/useTimecardExportUiState'
import { useTimecardExportVisibleCards } from '@/features/timecards/useTimecardExportVisibleCards'
import {
  DEFAULT_TIMECARD_BURDEN,
  getTodayIsoDate,
  snapToSaturday,
} from '@/features/timecards/workbook'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

type WeekStatusFilter = TimecardExportWeekStatusFilter
type DateFilterMode = TimecardExportDateFilterMode
type WorkbookSortMode = TimecardExportSortMode

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' })
const currentWeekEndDate = snapToSaturday(getTodayIsoDate())
const dateModeOptions = [
  { label: 'Single', value: 'single' as DateFilterMode },
  { label: 'Range', value: 'range' as DateFilterMode },
]
const weekStatusOptions = [
  { label: 'Submitted', value: 'submitted' as WeekStatusFilter },
  { label: 'Draft', value: 'draft' as WeekStatusFilter },
  { label: 'Mixed', value: 'all' as WeekStatusFilter },
]
const mobileToolbarTabs = timecardExportMobileToolbarTabs

const auth = useAuthStore()
const jobsStore = useJobsStore()
const router = useRouter()

const {
  pageError,
  pageInfo,
  resetMessages,
  setPageError,
  setPageErrorMessage,
  setPageInfo,
} = usePageMessages()
const {
  employees,
  employeesLoading,
  stopEmployeesSubscription,
  subscribeEmployeesForExport,
  stopUsersSubscription,
  subscribeUsersForExport,
  stopWeeksSubscription,
  subscribeWeeksForArchive,
  users,
  weeks,
  weeksLoading,
} = useTimecardExportSubscriptions({
  getIsAdmin: () => auth.isAdmin,
  setPageError,
})
const sortMode = ref<WorkbookSortMode>('number')
const actionLoading = ref(false)
const {
  handleTimecardExportConfirmOpenUpdate,
  timecardExportConfirmAction,
  timecardExportConfirmLabel,
  timecardExportConfirmMessage,
  timecardExportConfirmTitle,
} = useTimecardExportConfirmDialog(actionLoading)

const {
  activeWeekFilterBounds,
  filteredWeeks,
  filters,
  updateToolbarFilter,
} = useTimecardExportFilters({
  currentWeekEndDate,
  weeks,
})

const {
  closeCreateTray,
  createCardForemanId,
  createCardJobId,
  customCardForm,
  employeeSearchTerm,
  resetCustomCardForm,
  showCreateTray,
  toggleCreateTray,
} = useTimecardExportCreateTray()
const canEditWeek = computed(() => auth.isAdmin)
const {
  activeMobileToolbarTab,
  isCardEditable,
  isCardReadOnly,
  pruneCardEditStates,
  resetCardEditStates,
  selectMobileToolbarTab,
  setCardEditMode,
  toggleCardEditMode,
} = useTimecardExportUiState(canEditWeek)

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
} = useTimecardCardSelection<TimecardExportArchiveCardRecord>({
  getCards: () => cards.value,
})

const {
  availableForemanOptions,
  availableJobOptions,
  createCardForemanOptions,
  createCardJobOptions,
  createCardJobRecord,
  createTrayMessage,
  targetCreateWeek,
  availableEmployees,
} = useTimecardExportCreateContext({
  collator,
  createCardJobId,
  employeeSearchTerm,
  employees,
  filters,
  getCurrentUserId: () => auth.currentUser?.uid ?? null,
  getDisplayName: () => auth.displayName ?? null,
  getJobs: () => jobsStore.jobs,
  users,
  weeks,
})
useTimecardExportCreateDefaults({
  createCardForemanId,
  createCardForemanOptions,
  createCardJobId,
  createCardJobOptions,
  selectedForemanFilter: computed(() => filters.foreman),
  targetCreateWeek,
})
let syncCardUiStateHandler: (nextCards: TimecardExportArchiveCardRecord[]) => void = () => {}
const {
  cards,
  cardsByWeekId,
  cardsLoading,
  deleteWeekCache,
  getNextSortIndexForWeek,
  rebuildArchiveCards,
  redecorateLoadedCards,
  stopCardsSubscription,
  syncCardsForFilteredWeeks,
} = useTimecardExportArchiveCards({
  defaultBurden: DEFAULT_TIMECARD_BURDEN,
  filteredWeeks,
  getJobs: () => jobsStore.jobs,
  getPendingStateMaps: () => [scheduledSaveIds, savingIds, queuedSaveIds],
  onCardsChanged: (nextCards) => syncCardUiStateHandler(nextCards),
  onError: (error, week) => {
    setPageError(error, `Failed to load timecards for ${formatTimecardExportWeekRowSubtitle(week)}.`)
  },
})
const {
  activeCreateWeekCards,
  filteredCards,
  orderedCards,
} = useTimecardExportVisibleCards({
  cards,
  cardsByWeekId,
  collator,
  filters,
  sortMode,
  targetCreateWeek,
})
const {
  activeSaveCount,
  disposeSaveQueue,
  flushPendingSaves,
  hasQueuedWork,
  lastSavedAt,
  pendingSaveCount,
  pruneSaveQueueToIds,
  queuedSaveIds,
  resetSaveQueueState,
  saveError,
  savingIds,
  scheduleCardSave,
  scheduledSaveIds,
} = useTimecardExportSaveQueue({
  canEditWeek,
  cards,
})
const {
  accountsSummary,
  buildCsvExportFilename,
  buildPdfExportSubtitle,
  emptyCanvasMessage,
  matchingForemenLabel,
  matchingJobsLabel,
  matchingPackageCountLabel,
  statusSignals,
  totalHours,
  totalProduction,
  visibleWeekHeading,
} = useTimecardExportSummary({
  activeSaveCount,
  activeWeekFilterBounds,
  cards,
  cardsLoading,
  currentWeekEndDate,
  filteredCards,
  filteredWeeks,
  lastSavedAt,
  orderedCards,
  pendingSaveCount,
  saveError,
})

const formatWorkbookDate = formatTimecardExportDate

const cardWorkspaceActions = useTimecardExportCardWorkspaceActions({
  clearCardMeasurements,
  collator,
  isCardReadOnly,
  pruneCardEditStates,
  pruneCardMeasurements,
  pruneSaveQueueToIds,
  resetCardEditStates,
  resetCardSelectionState,
  resetMessages,
  resetSaveQueueState,
  saveError,
  scheduleCardSave,
  selectCard,
  sortMode,
  syncCardSelectionState,
})
syncCardUiStateHandler = cardWorkspaceActions.syncCardUiState
const {
  handleWorkbookChanged,
  isEmployeeHeaderLocked,
  resetCardWorkspaceState,
  resetPageAndSaveMessages,
  scrollCardIntoView,
} = cardWorkspaceActions

useTimecardExportFilteredWeekSync({
  cards,
  filteredWeeks,
  flushPendingSaves,
  hasQueuedWork,
  resetCardWorkspaceState,
  resetPageAndSaveMessages,
  syncCardsForFilteredWeeks,
})

const {
  handleAddCustomCard,
  handleAddEmployee,
} = useTimecardExportCreateActions({
  actionLoading,
  canEditWeek,
  closeCreateTray,
  createCardForemanId,
  createCardForemanOptions,
  createCardJobId,
  createCardJobOptions,
  customCardForm,
  employeeSearchTerm,
  expandAndSelectCard,
  filters,
  getIsAdmin: () => auth.isAdmin,
  getNextSortIndexForWeek,
  resetCustomCardForm,
  resetPageAndSaveMessages,
  scrollCardIntoView,
  setCardEditMode,
  setPageError,
  setPageErrorMessage,
  targetCreateWeek,
})

const {
  confirmTimecardExportAction,
  handleDeleteWeek,
  handleRemoveCard,
} = useTimecardExportMutationActions({
  actionLoading,
  canEditWeek,
  deleteWeekCache,
  flushPendingSaves,
  getIsAdmin: () => auth.isAdmin,
  resetPageAndSaveMessages,
  selectCard,
  setPageError,
  setPageInfo,
  timecardExportConfirmAction,
})

const {
  handleCsvExport,
  handlePdfExport,
} = useTimecardExportDownloadActions({
  buildCsvExportFilename,
  buildPdfExportSubtitle,
  flushPendingSaves,
  orderedCards,
  resetPageAndSaveMessages,
  resolvePrintHref: (exportId) => router.resolve({
    name: 'timecard-export-print',
    query: {
      exportId,
    },
  }).href,
  setPageError,
  setPageErrorMessage,
  setPageInfo,
})

useTimecardExportSideEffects({
  getJobs: () => jobsStore.jobs,
  orderedCards,
  redecorateLoadedCards,
  syncSelectedCardFromVisibleCards,
})

useTimecardExportLifecycle({
  disconnectCardMeasurements,
  disposeSaveQueue,
  startEmployeesSubscription: subscribeEmployeesForExport,
  startJobsSubscription: () => jobsStore.subscribeVisibleJobs(),
  startUsersSubscription: subscribeUsersForExport,
  startWeeksSubscription: subscribeWeeksForArchive,
  stopCardsSubscription,
  stopEmployeesSubscription,
  stopUsersSubscription,
  stopWeeksSubscription,
})
</script>

<template>
  <AppShell>
    <div class="timecards-page" data-testid="timecard-export-page">
      <section class="timecards-workbook">
        <TimecardExportToolbar
          :tabs="mobileToolbarTabs"
          :active-mobile-toolbar-tab="activeMobileToolbarTab"
          :filters="filters"
          :date-mode-options="dateModeOptions"
          :available-job-options="availableJobOptions"
          :available-foreman-options="availableForemanOptions"
          :week-status-options="weekStatusOptions"
          :sort-mode="sortMode"
          :is-admin="auth.isAdmin"
          :action-loading="actionLoading"
          :show-create-tray="showCreateTray"
          :filtered-weeks="filteredWeeks"
          :weeks-loading="weeksLoading"
          :status-signals="statusSignals"
          :format-date="formatWorkbookDate"
          :format-week-subtitle="formatTimecardExportWeekRowSubtitle"
          @select-mobile-tab="selectMobileToolbarTab"
          @update-filter="updateToolbarFilter"
          @update-sort-mode="sortMode = $event"
          @set-all-cards-compact="setAllCardsCompact"
          @export-pdf="handlePdfExport"
          @export-csv="handleCsvExport"
          @toggle-create-tray="toggleCreateTray"
          @delete-week="handleDeleteWeek"
        />

        <TimecardPageMessage v-if="pageError" :message="pageError" tone="error" />
        <TimecardPageMessage v-else-if="pageInfo" :message="pageInfo" />

        <TimecardExportCreateTray
          v-if="auth.isAdmin && showCreateTray"
          :message="createTrayMessage"
          :job-id="createCardJobId"
          :job-options="createCardJobOptions"
          :foreman-id="createCardForemanId"
          :foreman-options="createCardForemanOptions"
          :target-week-exists="Boolean(targetCreateWeek?.id)"
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
          @update-job-id="createCardJobId = $event"
          @update-foreman-id="createCardForemanId = $event"
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

        <TimecardExportCanvasPanel
          :cards="orderedCards"
          :cards-loading="cardsLoading"
          :weeks-loading="weeksLoading"
          :heading="visibleWeekHeading"
          :package-count-label="matchingPackageCountLabel"
          :jobs-label="matchingJobsLabel"
          :foremen-label="matchingForemenLabel"
          :empty-message="emptyCanvasMessage"
          :selected-card-id="selectedCardId"
          :can-edit-week="canEditWeek"
          :action-loading="actionLoading"
          :show-employee-wage="auth.isAdmin"
          :show-cost-values="auth.isAdmin"
          :is-card-compact="isCardCompact"
          :is-card-editable="isCardEditable"
          :is-card-read-only="isCardReadOnly"
          :is-employee-header-locked="isEmployeeHeaderLocked"
          :get-card-shell-style="getCardShellStyle"
          :get-card-scale-style="getCardScaleStyle"
          :set-card-shell-element="setCardShellElement"
          :set-card-content-element="setCardContentElement"
          @select-card="selectCard"
          @toggle-card-compact="toggleCardCompact"
          @toggle-card-edit-mode="toggleCardEditMode"
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
      :open="timecardExportConfirmAction !== null"
      :title="timecardExportConfirmTitle"
      :message="timecardExportConfirmMessage"
      :confirm-label="timecardExportConfirmLabel"
      destructive
      :busy="actionLoading"
      @update:open="handleTimecardExportConfirmOpenUpdate"
      @confirm="confirmTimecardExportAction"
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
