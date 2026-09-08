<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import TimecardConfirmDialog from '@/components/timecards/TimecardConfirmDialog.vue'
import TimecardExportCanvasPanel from '@/components/timecards/TimecardExportCanvasPanel.vue'
import TimecardExportCreateTray from '@/components/timecards/TimecardExportCreateTray.vue'
import TimecardPageShell from '@/components/timecards/TimecardPageShell.vue'
import TimecardPageMessages from '@/components/timecards/TimecardPageMessages.vue'
import TimecardExportToolbar from '@/components/timecards/TimecardExportToolbar.vue'
import TimecardSummaryPanel from '@/components/timecards/TimecardSummaryPanel.vue'
import { useMeasuredCardScale } from '@/composables/useMeasuredCardScale'
import { usePageMessages } from '@/composables/usePageMessages'
import { collectTimecardPendingStateMaps } from '@/features/timecards/stateMapHelpers'
import {
  formatTimecardExportDate,
  formatTimecardExportWeekRowSubtitle,
  timecardExportCollator,
  timecardExportDateModeOptions,
  timecardExportWeekStatusOptions,
  type TimecardExportArchiveCardRecord,
  type TimecardExportSortMode,
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
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'

type WorkbookSortMode = TimecardExportSortMode

const currentWeekEndDate = snapToSaturday(getTodayIsoDate())
const collator = timecardExportCollator
const dateModeOptions = timecardExportDateModeOptions
const weekStatusOptions = timecardExportWeekStatusOptions
const mobileToolbarTabs = timecardExportMobileToolbarTabs

const auth = useAuthStore()
const jobsStore = useJobsStore()
const router = useRouter()
const canReopenSubmittedWeeks = computed(() => auth.rawRole === 'admin')

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
  getCanUseTimecardExport: () => auth.canUseTimecardExport,
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
const canEditWeek = computed(() => auth.canUseTimecardExport)
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
const {
  cards,
  cardsByWeekId,
  cardsLoading,
  deleteWeekCache,
  getNextSortIndexForWeek,
  rebuildArchiveCards,
  redecorateLoadedCards,
  setCardsChangedHandler,
  stopCardsSubscription,
  syncCardsForFilteredWeeks,
} = useTimecardExportArchiveCards({
  defaultBurden: DEFAULT_TIMECARD_BURDEN,
  filteredWeeks,
  getJobs: () => jobsStore.jobs,
  getPendingStateMaps: () => collectTimecardPendingStateMaps(scheduledSaveIds, savingIds, queuedSaveIds),
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
setCardsChangedHandler(cardWorkspaceActions.syncCardUiState)
const {
  handleWorkbookChanged,
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
  getCanUseTimecardExport: () => auth.canUseTimecardExport,
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
  handleReopenWeek,
  handleSubmitWeek,
} = useTimecardExportMutationActions({
  actionLoading,
  canEditWeek,
  cards,
  deleteWeekCache,
  flushPendingSaves,
  getCanReopenSubmittedWeeks: () => canReopenSubmittedWeeks.value,
  getCanUseTimecardExport: () => auth.canUseTimecardExport,
  resetPageAndSaveMessages,
  revealCard: (cardId) => {
    filters.cardSearch = ''
    expandAndSelectCard(cardId)
    scrollCardIntoView(cardId)
  },
  selectCard,
  setPageError,
  setPageErrorMessage,
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
  <TimecardPageShell test-id="timecard-export-page">
    <template #workspace>
      <TimecardExportToolbar
        :tabs="mobileToolbarTabs"
        :active-mobile-toolbar-tab="activeMobileToolbarTab"
        :filters="filters"
        :date-mode-options="dateModeOptions"
        :available-job-options="availableJobOptions"
        :available-foreman-options="availableForemanOptions"
        :week-status-options="weekStatusOptions"
        :sort-mode="sortMode"
        :can-use-timecard-export="auth.canUseTimecardExport"
        :can-reopen-submitted-weeks="canReopenSubmittedWeeks"
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
        @reopen-week="handleReopenWeek"
        @submit-week="handleSubmitWeek"
      />

      <TimecardPageMessages :error="pageError" :info="pageInfo" />

      <TimecardExportCreateTray
        v-if="auth.canUseTimecardExport && showCreateTray"
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
        :show-employee-wage="auth.canUseTimecardExport"
        :show-cost-values="auth.canUseTimecardExport"
        :is-card-compact="isCardCompact"
        :is-card-editable="isCardEditable"
        :is-card-read-only="isCardReadOnly"
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
    </template>

    <TimecardConfirmDialog
      :open="timecardExportConfirmAction !== null"
      :title="timecardExportConfirmTitle"
      :message="timecardExportConfirmMessage"
      :confirm-label="timecardExportConfirmLabel"
      destructive
      :busy="actionLoading"
      @update-open="handleTimecardExportConfirmOpenUpdate"
      @confirm="confirmTimecardExportAction"
    />
  </TimecardPageShell>
</template>
