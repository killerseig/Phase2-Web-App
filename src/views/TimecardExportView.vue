<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import { buildTimecardCsvExport, downloadTimecardCsvExport } from '@/features/timecards/csv-export'
import { MAX_TIMECARD_CARD_SCALE } from '@/features/timecards/layout'
import { saveTimecardPdfExportPayload } from '@/features/timecards/pdf-export'
import {
  DEFAULT_TIMECARD_BURDEN,
  buildAccountsSummary,
  buildCardDisplayName,
  getTodayIsoDate,
  getWeekStartFromSaturday,
  recalculateCardTotals,
  snapToSaturday,
  type TimecardEmployeeSeed,
} from '@/features/timecards/workbook'
import AppShell from '@/layouts/AppShell.vue'
import { subscribeEmployees } from '@/services/employees'
import { subscribeUsers } from '@/services/users'
import {
  createTimecardCard,
  deleteTimecardCard,
  ensureTimecardWeek,
  subscribeAllTimecardWeeks,
  subscribeTimecardCards,
  updateTimecardCard,
} from '@/services/timecards'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type { EmployeeRecord, TimecardCardRecord, TimecardWeekRecord, UserProfile } from '@/types/domain'
import { toEffectiveRole } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type WeekStatusFilter = 'submitted' | 'draft' | 'all'
type DateFilterMode = 'single' | 'range'
type WorkbookSortMode = 'name' | 'number'
type MobileToolbarTabKey = 'weeks' | 'archive' | 'sort' | 'actions' | 'saved'
type ArchiveTimecardCardRecord = TimecardCardRecord & {
  archiveWeekId: string
  archiveWeekStartDate: string
  archiveWeekEndDate: string
  archiveWeekStatus: TimecardWeekRecord['status']
  archiveJobId: string
  archiveJobCode: string | null
  archiveJobName: string | null
  archiveForemanName: string | null
  archiveBurden: number
}

interface CustomCardFormState {
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: string
  isContractor: boolean
}

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
const mobileToolbarTabs: Array<{ key: MobileToolbarTabKey; label: string }> = [
  { key: 'weeks', label: 'Weeks' },
  { key: 'archive', label: 'Archive' },
  { key: 'sort', label: 'Sort' },
  { key: 'actions', label: 'Actions' },
  { key: 'saved', label: 'Saved' },
]

const auth = useAuthStore()
const jobsStore = useJobsStore()
const router = useRouter()

const weeks = ref<TimecardWeekRecord[]>([])
const cards = ref<ArchiveTimecardCardRecord[]>([])
const employees = ref<EmployeeRecord[]>([])
const users = ref<UserProfile[]>([])
const selectedCardId = ref<string | null>(null)
const weeksLoading = ref(true)
const cardsLoading = ref(false)
const employeesLoading = ref(true)
const pageError = ref('')
const pageInfo = ref('')
const saveError = ref('')
const lastSavedAt = ref<number | null>(null)
const sortMode = ref<WorkbookSortMode>('number')
const activeMobileToolbarTab = ref<MobileToolbarTabKey>('weeks')
const showCreateTray = ref(false)
const employeeSearchTerm = ref('')
const createCardJobId = ref('')
const createCardForemanId = ref('')
const actionLoading = ref(false)

const filters = reactive({
  dateMode: 'single' as DateFilterMode,
  singleWeekEndDate: currentWeekEndDate,
  rangeStartDate: currentWeekEndDate,
  rangeEndDate: currentWeekEndDate,
  selectedJobIds: [] as string[],
  foreman: 'all',
  status: 'all' as WeekStatusFilter,
  weekSearch: '',
  cardSearch: '',
})

const customCardForm = reactive<CustomCardFormState>({
  firstName: '',
  lastName: '',
  employeeNumber: '',
  occupation: '',
  wageRate: '',
  isContractor: false,
})

const compactCardStates = reactive<Record<string, boolean>>({})
const adminCardEditStates = reactive<Record<string, boolean>>({})
const scheduledSaveIds = reactive<Record<string, boolean>>({})
const savingIds = reactive<Record<string, boolean>>({})
const cardShellWidths = reactive<Record<string, number>>({})
const cardContentSizes = reactive<Record<string, { width: number; height: number }>>({})
const cardsByWeekId = reactive<Record<string, ArchiveTimecardCardRecord[]>>({})
const pendingCardWeekIds = reactive<Record<string, boolean>>({})

let unsubscribeWeeks: (() => void) | null = null
let unsubscribeEmployees: (() => void) | null = null
let unsubscribeUsers: (() => void) | null = null
let filteredWeekSyncToken = 0

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const savePromises = new Map<string, Promise<void>>()
const cardShellObservers = new Map<string, ResizeObserver>()
const cardContentObservers = new Map<string, ResizeObserver>()
const cardSubscriptionStops = new Map<string, () => void>()

const availableJobOptions = computed(() => (
  jobsStore.jobs
    .slice()
    .sort((left, right) => collator.compare(
      left.code ? `${left.code} ${left.name}` : left.name,
      right.code ? `${right.code} ${right.name}` : right.name,
    ))
    .map((job) => ({
      id: job.id,
      code: job.code ?? '',
      name: job.name ?? '',
      label: job.code ? `${job.code} - ${job.name}` : job.name,
    }))
))
const availableForemen = computed(() => (
  Array.from(
    new Set(
      weeks.value
        .map((week) => week.ownerForemanName?.trim())
        .filter((value): value is string => !!value),
    ),
  ).sort((left, right) => collator.compare(left, right))
))
const availableForemanOptions = computed(() => [
  { label: 'All Foremen', value: 'all' },
  ...availableForemen.value.map((foreman) => ({
    label: foreman,
    value: foreman,
  })),
])
const availableUserForemen = computed(() => (
  users.value.filter((user) => user.active && toEffectiveRole(user.role) === 'foreman')
))
const createCardJobOptions = computed(() => availableJobOptions.value)
const createCardJobRecord = computed(() => (
  jobsStore.jobs.find((job) => job.id === createCardJobId.value) ?? null
))
const targetCreateWeek = computed(() => {
  if (filters.dateMode !== 'single' || !createCardJobId.value) return null

  const matchingSavedWeek = weeks.value.find((week) => (
    week.jobId === createCardJobId.value
    && week.weekEndDate === filters.singleWeekEndDate
  ))

  if (matchingSavedWeek) return matchingSavedWeek

  const selectedJob = createCardJobOptions.value.find((job) => job.id === createCardJobId.value)
  if (!selectedJob) return null

  return {
    id: '',
    jobId: selectedJob.id,
    jobCode: selectedJob.code || null,
    jobName: selectedJob.name || null,
    ownerForemanUserId: auth.currentUser?.uid ?? null,
    ownerForemanName: auth.displayName ?? null,
    weekStartDate: getWeekStartFromSaturday(filters.singleWeekEndDate),
    weekEndDate: filters.singleWeekEndDate,
    status: 'draft' as const,
    employeeCardCount: 0,
  }
})
const createCardForemanOptions = computed(() => {
  const targetJob = createCardJobRecord.value
  if (!targetJob) return [] as Array<{ id: string; label: string }>

  const assignedIds = new Set(targetJob.assignedForemanIds)
  const matchedUsers = availableUserForemen.value.filter((user) => (
    assignedIds.has(user.id) || user.assignedJobIds.includes(targetJob.id)
  ))

  const uniqueUsers = Array.from(new Map(matchedUsers.map((user) => [user.id, user])).values())
  return uniqueUsers.map((user) => ({
    id: user.id,
    label: formatUserDisplayName(user),
  }))
})
const activeCreateWeekCards = computed(() => {
  const week = targetCreateWeek.value
  if (!week) return [] as ArchiveTimecardCardRecord[]
  return cardsByWeekId[week.id] ?? []
})
const availableEmployees = computed(() => {
  const usedIds = new Set(activeCreateWeekCards.value.map((card) => card.employeeId).filter((value): value is string => !!value))
  const query = employeeSearchTerm.value.trim().toLowerCase()

  return employees.value
    .filter((employee) => employee.active)
    .filter((employee) => !usedIds.has(employee.id))
    .filter((employee) => {
      if (!query) return true
      const displayName = `${employee.firstName} ${employee.lastName}`.trim().toLowerCase()
      return (
        displayName.includes(query)
        || employee.employeeNumber.toLowerCase().includes(query)
        || employee.occupation.toLowerCase().includes(query)
      )
    })
    .slice(0, 16)
})
const createTrayMessage = computed(() => {
  if (filters.dateMode !== 'single') return 'Switch Date Mode to Single before creating cards.'
  if (!createCardJobOptions.value.length) return 'No jobs are available to create cards for.'
  return ''
})
const activeWeekFilterBounds = computed(() => {
  const startDate = filters.dateMode === 'single' ? filters.singleWeekEndDate : filters.rangeStartDate
  const endDate = filters.dateMode === 'single' ? filters.singleWeekEndDate : filters.rangeEndDate

  if (startDate && endDate && startDate > endDate) {
    return {
      startDate: endDate,
      endDate: startDate,
    }
  }

  return { startDate, endDate }
})
const filteredWeeks = computed(() => {
  const query = filters.weekSearch.trim().toLowerCase()
  const { startDate, endDate } = activeWeekFilterBounds.value

  return weeks.value.filter((week) => {
    if (startDate && week.weekEndDate < startDate) return false
    if (endDate && week.weekEndDate > endDate) return false
    if (filters.selectedJobIds.length && !filters.selectedJobIds.includes(week.jobId)) return false

    const foremanName = week.ownerForemanName?.trim() ?? ''
    if (filters.foreman !== 'all' && foremanName !== filters.foreman) return false
    if (filters.status !== 'all' && week.status !== filters.status) return false
    if (!query) return true

    const haystack = [
      week.weekEndDate,
      week.jobCode ?? '',
      week.jobName ?? '',
      foremanName,
      week.status,
    ].join(' ').toLowerCase()

    return haystack.includes(query)
  })
})
const filteredCards = computed(() => {
  const query = filters.cardSearch.trim().toLowerCase()
  if (!query) return cards.value

  return cards.value.filter((card) => {
    const displayName = buildCardDisplayName(card).toLowerCase()
    return (
      displayName.includes(query)
      || card.employeeNumber.toLowerCase().includes(query)
      || card.occupation.toLowerCase().includes(query)
    )
  })
})
const orderedCards = computed(() => sortCardsForMode(filteredCards.value, sortMode.value))
const accountsSummary = computed(() => buildAccountsSummary(cards.value))
const canEditWeek = computed(() => auth.isAdmin)
const pendingSaveCount = computed(() => Object.keys(scheduledSaveIds).length)
const activeSaveCount = computed(() => Object.keys(savingIds).length)
const totalHours = computed(() => cards.value.reduce((sum, card) => sum + Number(card.totals.hoursTotal ?? 0), 0))
const totalProduction = computed(() => cards.value.reduce((sum, card) => sum + Number(card.totals.productionTotal ?? 0), 0))
const visibleWeekHeading = computed(() => {
  const { startDate, endDate } = activeWeekFilterBounds.value
  if (!startDate && !endDate) return 'Matching Weeks'
  if (!startDate || !endDate || startDate === endDate) {
    return formatWorkbookDate(endDate || startDate || currentWeekEndDate)
  }

  return `${formatWorkbookDate(startDate)} - ${formatWorkbookDate(endDate)}`
})
const matchingPackageCountLabel = computed(() => {
  const count = filteredWeeks.value.length
  if (!count) return 'No saved week packages'
  if (count === 1) return '1 saved week package'
  return `${count} saved week packages`
})
const matchingJobsLabel = computed(() => {
  const uniqueWeeks = filteredWeeks.value
  if (!uniqueWeeks.length) return 'No jobs'

  const uniqueJobIds = Array.from(new Set(uniqueWeeks.map((week) => week.jobId)))
  if (uniqueJobIds.length === 1) {
    const matchingWeek = uniqueWeeks.find((week) => week.jobId === uniqueJobIds[0]) || uniqueWeeks[0]
    if (!matchingWeek) return '1 job'
    if (matchingWeek.jobCode && matchingWeek.jobName) return `${matchingWeek.jobCode} - ${matchingWeek.jobName}`
    return matchingWeek.jobName || matchingWeek.jobCode || '1 job'
  }

  return `${uniqueJobIds.length} jobs`
})
const matchingForemenLabel = computed(() => {
  const foremen = Array.from(
    new Set(
      filteredWeeks.value.map((week) => week.ownerForemanName?.trim() || 'No Foreman'),
    ),
  )

  if (!foremen.length) return 'No foremen'
  if (foremen.length === 1) return foremen[0]
  return `${foremen.length} foremen`
})
const weekStatusLabel = computed(() => {
  if (!filteredWeeks.value.length) return 'No Results'

  const statuses = Array.from(
    new Set(
      filteredWeeks.value.map((week) => (week.status === 'submitted' ? 'Submitted' : 'Draft')),
    ),
  )

  return statuses.length === 1 ? statuses[0] : 'Mixed'
})
const saveStateLabel = computed(() => {
  if (saveError.value) return saveError.value
  if (activeSaveCount.value || pendingSaveCount.value) return 'Saving...'
  if (cardsLoading.value) return 'Loading...'
  if (!filteredWeeks.value.length) return 'No Matching Weeks'
  if (lastSavedAt.value) return 'Saved'
  return 'Idle'
})
const compactWeekStatusLabel = computed(() => {
  if (!filteredWeeks.value.length) return 'None'

  const statuses = Array.from(
    new Set(
      filteredWeeks.value.map((week) => (week.status === 'submitted' ? 'Submitted' : 'Draft')),
    ),
  )

  return statuses.length === 1 ? statuses[0] : 'Mixed'
})
const compactSaveStateLabel = computed(() => {
  if (saveError.value) return 'Error'
  if (activeSaveCount.value || pendingSaveCount.value) return 'Saving'
  if (cardsLoading.value) return 'Loading'
  if (!filteredWeeks.value.length) return 'No Weeks'
  if (lastSavedAt.value) return 'Saved'
  return 'Idle'
})
const statusSignals = computed(() => ([
  {
    key: 'results',
    text: `Status: ${compactWeekStatusLabel.value}`,
    tone: weekStatusLabel.value === 'Submitted' ? 'success' : 'default',
  },
  {
    key: 'autosave',
    text: `Save: ${compactSaveStateLabel.value}`,
    tone: saveError.value ? 'error' : 'default',
  },
  {
    key: 'weeks',
    text: `Weeks: ${filteredWeeks.value.length}`,
    tone: 'default',
  },
  {
    key: 'cards',
    text: `Cards: ${orderedCards.value.length}`,
    tone: 'default',
  },
]))
const statusScrollerRef = ref<HTMLDivElement | null>(null)
const statusSignalItemRefs = ref<HTMLDivElement[]>([])
const activeStatusSignalIndex = ref(0)
const MOBILE_STATUS_VISIBLE_COUNT = 2
const statusScrollerDrag = reactive({
  pointerId: null as number | null,
  startX: 0,
  startScrollLeft: 0,
  dragging: false,
})
const emptyCanvasMessage = computed(() => {
  if (!filteredWeeks.value.length) return 'No saved weeks match the current filters.'
  if (cards.value.length && !filteredCards.value.length) return 'No cards match this employee search.'
  if (!cards.value.length) return 'No timecards were saved for the current week results.'
  return 'No timecards available.'
})
const canScrollStatusBackward = computed(() => activeStatusSignalIndex.value > 0)
const canScrollStatusForward = computed(() => activeStatusSignalIndex.value < getMaxStatusSignalStartIndex())

function setStatusScrollerRef(element: Element | ComponentPublicInstance | null) {
  statusScrollerRef.value = element instanceof HTMLDivElement ? element : null
}

function setStatusSignalItemRef(index: number, element: Element | ComponentPublicInstance | null) {
  if (!(element instanceof HTMLDivElement)) {
    delete statusSignalItemRefs.value[index]
    return
  }

  statusSignalItemRefs.value[index] = element
}

function getMaxStatusSignalStartIndex() {
  return Math.max(0, statusSignals.value.length - MOBILE_STATUS_VISIBLE_COUNT)
}

function getNearestStatusSignalIndex() {
  const scroller = statusScrollerRef.value
  const items = statusSignalItemRefs.value
  if (!scroller || !items.length) return 0

  const currentLeft = scroller.scrollLeft
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  items.forEach((item, index) => {
    if (!item) return
    const distance = Math.abs(item.offsetLeft - currentLeft)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })

  return nearestIndex
}

function syncStatusSignalIndex() {
  activeStatusSignalIndex.value = Math.min(getNearestStatusSignalIndex(), getMaxStatusSignalStartIndex())
}

function scrollStatusSignalTo(index: number, behavior: ScrollBehavior = 'smooth') {
  const scroller = statusScrollerRef.value
  const clampedIndex = Math.max(0, Math.min(getMaxStatusSignalStartIndex(), index))
  const item = statusSignalItemRefs.value[clampedIndex]
  if (!scroller || !item) return

  scroller.scrollTo({
    left: item.offsetLeft,
    behavior,
  })
  activeStatusSignalIndex.value = clampedIndex
}

function scrollStatusSignals(direction: -1 | 1) {
  const nextIndex = Math.max(0, Math.min(getMaxStatusSignalStartIndex(), activeStatusSignalIndex.value + direction))
  scrollStatusSignalTo(nextIndex)
}

function beginStatusScrollerDrag(event: PointerEvent) {
  if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  const scroller = statusScrollerRef.value
  if (!scroller) return

  statusScrollerDrag.pointerId = event.pointerId
  statusScrollerDrag.startX = event.clientX
  statusScrollerDrag.startScrollLeft = scroller.scrollLeft
  statusScrollerDrag.dragging = false

  try {
    scroller.setPointerCapture(event.pointerId)
  } catch {
    // Ignore pointer capture failures.
  }
}

function handleStatusScrollerDrag(event: PointerEvent) {
  if (statusScrollerDrag.pointerId !== event.pointerId) return

  const scroller = statusScrollerRef.value
  if (!scroller) return

  const deltaX = event.clientX - statusScrollerDrag.startX
  if (!statusScrollerDrag.dragging && Math.abs(deltaX) > 3) {
    statusScrollerDrag.dragging = true
  }

  if (!statusScrollerDrag.dragging) return

  if (event.cancelable) {
    event.preventDefault()
  }

  scroller.scrollLeft = statusScrollerDrag.startScrollLeft - deltaX
  syncStatusSignalIndex()
}

function endStatusScrollerDrag(event: PointerEvent) {
  if (statusScrollerDrag.pointerId !== event.pointerId) return

  const scroller = statusScrollerRef.value
  if (scroller) {
    try {
      if (scroller.hasPointerCapture(event.pointerId)) {
        scroller.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Ignore pointer capture release failures.
    }
  }

  const shouldSnap = statusScrollerDrag.dragging
  statusScrollerDrag.pointerId = null
  statusScrollerDrag.dragging = false

  if (shouldSnap) {
    scrollStatusSignalTo(getNearestStatusSignalIndex())
  }
}

function formatWorkbookDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}

function formatWeekRowSubtitle(week: TimecardWeekRecord) {
  const jobLabel = week.jobCode || week.jobName || 'Unknown Job'
  const foremanLabel = week.ownerForemanName || 'No Foreman'
  return `${jobLabel} • ${foremanLabel}`
}

function sortCardsForMode<T extends TimecardCardRecord>(nextCards: T[], mode: WorkbookSortMode): T[] {
  return nextCards.slice().sort((left, right) => {
    if (mode === 'number') {
      return (
        collator.compare(left.employeeNumber, right.employeeNumber)
        || collator.compare(buildCardDisplayName(left), buildCardDisplayName(right))
        || left.id.localeCompare(right.id)
      )
    }

    return (
      collator.compare(buildCardDisplayName(left), buildCardDisplayName(right))
      || collator.compare(left.employeeNumber, right.employeeNumber)
      || left.id.localeCompare(right.id)
    )
  })
}

function clearStateMap(stateMap: Record<string, boolean>) {
  Object.keys(stateMap).forEach((key) => {
    delete stateMap[key]
  })
}

function clearRecordMap<T>(stateMap: Record<string, T>) {
  Object.keys(stateMap).forEach((key) => {
    delete stateMap[key]
  })
}

function resetCardWorkspaceState() {
  saveTimers.forEach((timer) => {
    clearTimeout(timer)
  })
  saveTimers.clear()
  savePromises.clear()
  clearStateMap(compactCardStates)
  clearStateMap(adminCardEditStates)
  clearStateMap(scheduledSaveIds)
  clearStateMap(savingIds)
  clearRecordMap(cardShellWidths)
  clearRecordMap(cardContentSizes)
  selectedCardId.value = null
  lastSavedAt.value = null
  saveError.value = ''
}

function setPageError(error: unknown, fallback: string) {
  pageError.value = normalizeError(error, fallback)
  pageInfo.value = ''
}

function setPageInfo(message: string) {
  pageInfo.value = message
  pageError.value = ''
}

function resetMessages() {
  pageError.value = ''
  pageInfo.value = ''
  saveError.value = ''
}

function resetCustomCardForm() {
  customCardForm.firstName = ''
  customCardForm.lastName = ''
  customCardForm.employeeNumber = ''
  customCardForm.occupation = ''
  customCardForm.wageRate = ''
  customCardForm.isContractor = false
}

function stopWeeksSubscription() {
  unsubscribeWeeks?.()
  unsubscribeWeeks = null
}

function stopEmployeesSubscription() {
  unsubscribeEmployees?.()
  unsubscribeEmployees = null
}

function stopUsersSubscription() {
  unsubscribeUsers?.()
  unsubscribeUsers = null
}

function stopCardsSubscription(weekId?: string) {
  if (weekId) {
    cardSubscriptionStops.get(weekId)?.()
    cardSubscriptionStops.delete(weekId)
    delete cardsByWeekId[weekId]
    delete pendingCardWeekIds[weekId]
    return
  }

  cardSubscriptionStops.forEach((stop) => stop())
  cardSubscriptionStops.clear()
  clearRecordMap(cardsByWeekId)
  clearRecordMap(pendingCardWeekIds)
}

function subscribeEmployeesForExport() {
  if (!auth.isAdmin) {
    employees.value = []
    employeesLoading.value = false
    return
  }

  employeesLoading.value = true
  stopEmployeesSubscription()

  unsubscribeEmployees = subscribeEmployees(
    (nextEmployees) => {
      employees.value = nextEmployees
      employeesLoading.value = false
    },
    (error) => {
      employeesLoading.value = false
      setPageError(error, 'Failed to load employees.')
    },
  )
}

function subscribeUsersForExport() {
  if (!auth.isAdmin) {
    users.value = []
    return
  }

  stopUsersSubscription()
  unsubscribeUsers = subscribeUsers(
    (nextUsers) => {
      users.value = nextUsers
    },
    (error) => {
      setPageError(error, 'Failed to load foremen.')
    },
  )
}

function subscribeWeeksForArchive() {
  weeksLoading.value = true
  stopWeeksSubscription()

  unsubscribeWeeks = subscribeAllTimecardWeeks(
    (nextWeeks) => {
      weeks.value = nextWeeks
      weeksLoading.value = false
    },
    (error) => {
      weeksLoading.value = false
      setPageError(error, 'Failed to load saved timecard weeks.')
    },
  )
}

function syncCardUiState(nextCards: TimecardCardRecord[]) {
  const validIds = new Set(nextCards.map((card) => card.id))
  const sortedCards = sortCardsForMode(nextCards, sortMode.value)

  saveTimers.forEach((timer, cardId) => {
    if (validIds.has(cardId)) return
    clearTimeout(timer)
    saveTimers.delete(cardId)
  })

  Object.keys(scheduledSaveIds).forEach((cardId) => {
    if (!validIds.has(cardId)) delete scheduledSaveIds[cardId]
  })

  Object.keys(savingIds).forEach((cardId) => {
    if (!validIds.has(cardId)) delete savingIds[cardId]
  })

  Object.keys(compactCardStates).forEach((cardId) => {
    if (!validIds.has(cardId)) delete compactCardStates[cardId]
  })

  Object.keys(adminCardEditStates).forEach((cardId) => {
    if (!validIds.has(cardId)) delete adminCardEditStates[cardId]
  })

  Object.keys(cardShellWidths).forEach((cardId) => {
    if (!validIds.has(cardId)) delete cardShellWidths[cardId]
  })

  Object.keys(cardContentSizes).forEach((cardId) => {
    if (!validIds.has(cardId)) delete cardContentSizes[cardId]
  })

  Array.from(cardShellObservers.keys()).forEach((cardId) => {
    if (!validIds.has(cardId)) {
      cardShellObservers.get(cardId)?.disconnect()
      cardShellObservers.delete(cardId)
    }
  })

  Array.from(cardContentObservers.keys()).forEach((cardId) => {
    if (!validIds.has(cardId)) {
      cardContentObservers.get(cardId)?.disconnect()
      cardContentObservers.delete(cardId)
    }
  })

  const nextSelectedCardId = selectedCardId.value && validIds.has(selectedCardId.value)
    ? selectedCardId.value
    : sortedCards[0]?.id ?? null

  nextCards.forEach((card) => {
    if (!Object.prototype.hasOwnProperty.call(compactCardStates, card.id)) {
      compactCardStates[card.id] = nextCards.length > 1 && card.id !== nextSelectedCardId
    }
  })

  selectedCardId.value = nextSelectedCardId
}

function getWeekBurden(week: TimecardWeekRecord) {
  const matchingJob = jobsStore.jobs.find((job) => job.id === week.jobId)
  return matchingJob?.productionBurden ?? DEFAULT_TIMECARD_BURDEN
}

function decorateArchiveCards(
  week: TimecardWeekRecord,
  nextCards: TimecardCardRecord[],
): ArchiveTimecardCardRecord[] {
  const burden = getWeekBurden(week)

  return nextCards.map((card) => {
    const archiveCard: ArchiveTimecardCardRecord = {
      ...card,
      archiveWeekId: week.id,
      archiveWeekStartDate: week.weekStartDate,
      archiveWeekEndDate: week.weekEndDate,
      archiveWeekStatus: week.status,
      archiveJobId: week.jobId,
      archiveJobCode: week.jobCode,
      archiveJobName: week.jobName,
      archiveForemanName: week.ownerForemanName,
      archiveBurden: burden,
    }

    recalculateCardTotals(archiveCard, week.weekStartDate, burden)
    return archiveCard
  })
}

function rebuildArchiveCards() {
  cards.value = filteredWeeks.value.flatMap((week) => cardsByWeekId[week.id] ?? [])
  syncCardUiState(cards.value)
}

function syncCardsLoadingState() {
  cardsLoading.value = Object.keys(pendingCardWeekIds).length > 0
}

function syncCardsForFilteredWeeks() {
  const targetWeeks = filteredWeeks.value
  const targetWeekIds = new Set(targetWeeks.map((week) => week.id))

  Array.from(cardSubscriptionStops.keys()).forEach((weekId) => {
    if (!targetWeekIds.has(weekId)) {
      stopCardsSubscription(weekId)
    }
  })

  if (!targetWeeks.length) {
    cards.value = []
    syncCardUiState([])
    syncCardsLoadingState()
    return
  }

  targetWeeks.forEach((week) => {
    if (cardSubscriptionStops.has(week.id)) {
      const currentCards = cardsByWeekId[week.id]
      if (currentCards) {
        cardsByWeekId[week.id] = decorateArchiveCards(week, currentCards)
      }
      return
    }

    pendingCardWeekIds[week.id] = true
    const stop = subscribeTimecardCards(
      week.id,
      week.weekStartDate,
      getWeekBurden(week),
      (nextCards) => {
        cardsByWeekId[week.id] = decorateArchiveCards(week, nextCards)
        delete pendingCardWeekIds[week.id]
        rebuildArchiveCards()
        syncCardsLoadingState()
      },
      (error) => {
        delete pendingCardWeekIds[week.id]
        syncCardsLoadingState()
        setPageError(error, `Failed to load timecards for ${formatWeekRowSubtitle(week)}.`)
      },
    )

    cardSubscriptionStops.set(week.id, stop)
  })

  rebuildArchiveCards()
  syncCardsLoadingState()
}

function clearSaveTimer(cardId: string) {
  const timer = saveTimers.get(cardId)
  if (timer) clearTimeout(timer)
  saveTimers.delete(cardId)
  delete scheduledSaveIds[cardId]
}

async function persistCard(card: ArchiveTimecardCardRecord) {
  if (!canEditWeek.value) return

  const existingSave = savePromises.get(card.id)
  if (existingSave) {
    await existingSave
    return
  }

  clearSaveTimer(card.id)
  savingIds[card.id] = true
  saveError.value = ''

  const savePromise = (async () => {
    try {
      await updateTimecardCard(
        card.archiveWeekId,
        card.id,
        card.archiveWeekStartDate,
        card,
        card.archiveBurden,
      )
      lastSavedAt.value = Date.now()
    } catch (error) {
      saveError.value = normalizeError(error, 'Save failed.')
      throw error
    } finally {
      delete savingIds[card.id]
    }
  })()

  savePromises.set(card.id, savePromise)
  try {
    await savePromise
  } finally {
    if (savePromises.get(card.id) === savePromise) {
      savePromises.delete(card.id)
    }
  }
}

function scheduleCardSave(card: ArchiveTimecardCardRecord) {
  if (!canEditWeek.value) return

  clearSaveTimer(card.id)
  scheduledSaveIds[card.id] = true
  saveError.value = ''
  saveTimers.set(card.id, setTimeout(() => {
    void persistCard(card)
  }, 450))
}

async function flushPendingSaves() {
  const pendingCards = cards.value.filter((card) => saveTimers.has(card.id))
  for (const card of pendingCards) {
    await persistCard(card)
  }

  if (savePromises.size) {
    await Promise.allSettled(Array.from(savePromises.values()))
  }
}

function handleWorkbookChanged(card: ArchiveTimecardCardRecord) {
  selectCard(card.id)
  scheduleCardSave(card)
}

function selectCard(cardId: string) {
  selectedCardId.value = cardId
}

function isCardCompact(cardId: string) {
  return compactCardStates[cardId] === true
}

function toggleCardCompact(cardId: string) {
  compactCardStates[cardId] = !compactCardStates[cardId]
}

function setAllCardsCompact(compact: boolean) {
  cards.value.forEach((card) => {
    compactCardStates[card.id] = compact
  })
}

function scrollCardIntoView(cardId: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(`timecard-export-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function getNextSortIndexForWeek(weekId: string) {
  return (cardsByWeekId[weekId] ?? []).reduce((maxValue, card) => Math.max(maxValue, Number(card.sortIndex ?? 0)), -1) + 1
}

function makeEmployeeSeed(employee: EmployeeRecord): TimecardEmployeeSeed {
  return {
    employeeId: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeNumber: employee.employeeNumber,
    occupation: employee.occupation,
    wageRate: employee.wageRate,
    isContractor: employee.isContractor,
  }
}

function isEmployeeHeaderLocked(card: TimecardCardRecord) {
  return card.sourceType !== 'custom' || isCardReadOnly(card.id)
}

function isCardEditable(cardId: string) {
  if (!canEditWeek.value) return false
  return adminCardEditStates[cardId] === true
}

function isCardReadOnly(cardId: string) {
  return !isCardEditable(cardId)
}

function toggleCardEditMode(cardId: string) {
  if (!canEditWeek.value) return
  adminCardEditStates[cardId] = !adminCardEditStates[cardId]
}

function setCardShellElement(cardId: string, element: Element | null) {
  cardShellObservers.get(cardId)?.disconnect()
  cardShellObservers.delete(cardId)

  if (!(element instanceof HTMLElement)) {
    delete cardShellWidths[cardId]
    return
  }

  cardShellWidths[cardId] = element.clientWidth
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const nextWidth = entry.contentRect.width
    if (cardShellWidths[cardId] === nextWidth) return
    cardShellWidths[cardId] = nextWidth
  })
  observer.observe(element)
  cardShellObservers.set(cardId, observer)
}

function setCardContentElement(cardId: string, element: Element | null) {
  cardContentObservers.get(cardId)?.disconnect()
  cardContentObservers.delete(cardId)

  if (!(element instanceof HTMLElement)) {
    delete cardContentSizes[cardId]
    return
  }

  const updateSize = () => {
    const width = element.offsetWidth
    const height = element.offsetHeight
    const current = cardContentSizes[cardId]
    if (current?.width === width && current.height === height) return
    cardContentSizes[cardId] = { width, height }
  }

  updateSize()
  const observer = new ResizeObserver(() => {
    updateSize()
  })
  observer.observe(element)
  cardContentObservers.set(cardId, observer)
}

function asObservedElement(
  element: Element | ComponentPublicInstance | null,
): Element | null {
  return element instanceof Element ? element : null
}

function getCardScale(cardId: string) {
  const shellWidth = cardShellWidths[cardId] ?? 0
  const contentWidth = cardContentSizes[cardId]?.width ?? 0
  if (!shellWidth || !contentWidth) return 1
  return Math.min(MAX_TIMECARD_CARD_SCALE, shellWidth / contentWidth)
}

function getCardShellStyle(cardId: string) {
  const scale = getCardScale(cardId)
  const contentHeight = cardContentSizes[cardId]?.height ?? 0
  if (!contentHeight) return undefined
  return {
    height: `${contentHeight * scale}px`,
  }
}

function getCardScaleStyle(cardId: string) {
  const scale = getCardScale(cardId)
  return {
    transform: `scale(${scale})`,
  }
}

function formatUserDisplayName(user: UserProfile) {
  const first = user.firstName?.trim() ?? ''
  const last = user.lastName?.trim() ?? ''
  const fullName = `${first} ${last}`.trim()
  return fullName || user.email || 'Unnamed Foreman'
}

function resolveCreateCardJobNumber() {
  const selectedJob = createCardJobOptions.value.find((job) => job.id === createCardJobId.value)
  if (!selectedJob) return ''
  return selectedJob.code.trim() || selectedJob.name.trim()
}

function resolveCreateCardForeman() {
  return createCardForemanOptions.value.find((foreman) => foreman.id === createCardForemanId.value) ?? null
}

function resolveCreateWeekTarget() {
  return targetCreateWeek.value
}

function syncExportFiltersToCreateTarget(week: Pick<TimecardWeekRecord, 'jobId' | 'weekEndDate' | 'ownerForemanName'>) {
  filters.dateMode = 'single'
  filters.singleWeekEndDate = week.weekEndDate
  filters.rangeStartDate = week.weekEndDate
  filters.rangeEndDate = week.weekEndDate
  filters.selectedJobIds = [week.jobId]
  filters.foreman = week.ownerForemanName?.trim() || 'all'
  filters.status = 'all'
}

async function ensureCreateTargetWeek() {
  const targetWeek = resolveCreateWeekTarget()
  if (!targetWeek || filters.dateMode !== 'single') return null
  if (targetWeek.id) return targetWeek
  const selectedForeman = resolveCreateCardForeman()
  if (!selectedForeman) return null

  const weekId = await ensureTimecardWeek({
    jobId: targetWeek.jobId,
    jobCode: targetWeek.jobCode,
    jobName: targetWeek.jobName,
    ownerForemanUserId: selectedForeman.id,
    ownerForemanName: selectedForeman.label,
    weekEndDate: targetWeek.weekEndDate,
  })

  return {
    ...targetWeek,
    id: weekId,
    ownerForemanUserId: selectedForeman.id,
    ownerForemanName: selectedForeman.label,
  }
}

function validateCustomCardForm() {
  if (!createCardJobId.value) return 'Select the linked job.'
  if (!resolveCreateCardJobNumber()) return 'Select a linked job with a job number.'
  if (!targetCreateWeek.value?.id && !createCardForemanId.value) return 'Select the foreman owner.'
  if (!customCardForm.firstName.trim()) return 'Enter the first name.'
  if (!customCardForm.lastName.trim()) return 'Enter the last name.'
  if (!customCardForm.employeeNumber.trim()) return 'Enter the employee number.'
  if (!customCardForm.occupation.trim()) return 'Enter the occupation.'
  if (!auth.isAdmin) return ''
  const wage = Number(customCardForm.wageRate.trim())
  if (!Number.isFinite(wage) || Number.isNaN(wage) || wage < 0) return 'Enter a wage amount.'
  return ''
}

async function handleAddEmployee(employee: EmployeeRecord) {
  if (!canEditWeek.value) return
  const linkedJobNumber = resolveCreateCardJobNumber()
  if (!createCardJobId.value || !linkedJobNumber) {
    pageError.value = !createCardJobId.value ? 'Select the linked job.' : 'Select a linked job with a job number.'
    pageInfo.value = ''
    return
  }

  actionLoading.value = true
  resetMessages()
  try {
    const week = await ensureCreateTargetWeek()
    if (!week) {
      pageError.value = 'Switch Date Mode to Single before creating cards.'
      return
    }

    const cardId = await createTimecardCard(
      week.id,
      week.weekStartDate,
      makeEmployeeSeed(employee),
      getNextSortIndexForWeek(week.id),
      linkedJobNumber,
    )
    compactCardStates[cardId] = false
    adminCardEditStates[cardId] = true
    selectedCardId.value = cardId
    syncExportFiltersToCreateTarget(week)
    employeeSearchTerm.value = ''
    showCreateTray.value = false
    scrollCardIntoView(cardId)
  } catch (error) {
    setPageError(error, 'Failed to add the employee card.')
  } finally {
    actionLoading.value = false
  }
}

async function handleAddCustomCard() {
  if (!canEditWeek.value) return

  resetMessages()
  const validationMessage = validateCustomCardForm()
  if (validationMessage) {
    pageError.value = validationMessage
    return
  }

  actionLoading.value = true
  try {
    const week = await ensureCreateTargetWeek()
    if (!week) {
      pageError.value = 'Switch Date Mode to Single before creating cards.'
      return
    }

    const cardId = await createTimecardCard(
      week.id,
      week.weekStartDate,
      {
        firstName: customCardForm.firstName.trim(),
        lastName: customCardForm.lastName.trim(),
        employeeNumber: customCardForm.employeeNumber.trim(),
        occupation: customCardForm.occupation.trim(),
        wageRate: auth.isAdmin ? Number(customCardForm.wageRate.trim()) : null,
        isContractor: customCardForm.isContractor,
      },
      getNextSortIndexForWeek(week.id),
      resolveCreateCardJobNumber(),
    )
    compactCardStates[cardId] = false
    adminCardEditStates[cardId] = true
    selectedCardId.value = cardId
    syncExportFiltersToCreateTarget(week)
    resetCustomCardForm()
    showCreateTray.value = false
    scrollCardIntoView(cardId)
  } catch (error) {
    setPageError(error, 'Failed to add the custom timecard.')
  } finally {
    actionLoading.value = false
  }
}

async function handleRemoveCard(card: ArchiveTimecardCardRecord) {
  if (!canEditWeek.value) return

  const confirmed = window.confirm(`Remove ${buildCardDisplayName(card)} from the saved week ending ${formatWorkbookDate(card.archiveWeekEndDate)}?`)
  if (!confirmed) return

  actionLoading.value = true
  resetMessages()
  try {
    selectCard(card.id)
    await flushPendingSaves()
    await deleteTimecardCard(card.archiveWeekId, card.id)
    setPageInfo('Removed the timecard.')
  } catch (error) {
    setPageError(error, 'Failed to remove the timecard.')
  } finally {
    actionLoading.value = false
  }
}

function buildPdfExportSubtitle() {
  return [
    visibleWeekHeading.value,
    matchingPackageCountLabel.value,
    `${orderedCards.value.length} cards`,
  ].filter(Boolean).join(' · ')
}

function buildCsvExportFilename() {
  const { startDate, endDate } = activeWeekFilterBounds.value
  if (!startDate && !endDate) return 'timecard-export.csv'
  if (!startDate || !endDate || startDate === endDate) {
    return `timecard-export-${endDate || startDate || currentWeekEndDate}.csv`
  }

  return `timecard-export-${startDate}_to_${endDate}.csv`
}

async function handlePdfExport() {
  if (!orderedCards.value.length) {
    setPageInfo('No timecards match the current filters.')
    return
  }

  resetMessages()

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    pageError.value = 'Allow popups to export the PDF.'
    return
  }

  printWindow.document.title = 'Preparing Timecard PDF...'
  printWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 24px;">Preparing timecard PDF...</p>'

  try {
    await flushPendingSaves()

    const exportId = saveTimecardPdfExportPayload({
      title: 'Timecard Export',
      subtitle: buildPdfExportSubtitle(),
      generatedAt: Date.now(),
      cards: orderedCards.value.map((card) => ({
        ...card,
        exportWeekId: card.archiveWeekId,
        exportWeekStartDate: card.archiveWeekStartDate,
        exportWeekEndDate: card.archiveWeekEndDate,
        exportWeekStatus: card.archiveWeekStatus,
        exportJobId: card.archiveJobId,
        exportJobCode: card.archiveJobCode,
        exportJobName: card.archiveJobName,
        exportForemanName: card.archiveForemanName,
        exportBurden: card.archiveBurden,
      })),
    })

    const targetRoute = router.resolve({
      name: 'timecard-export-print',
      query: {
        exportId,
      },
    })

    printWindow.location.href = targetRoute.href
    setPageInfo(`Opened ${orderedCards.value.length} timecard${orderedCards.value.length === 1 ? '' : 's'} for PDF export.`)
  } catch (error) {
    printWindow.close()
    setPageError(error, 'Failed to prepare the PDF export.')
  }
}

async function handleCsvExport() {
  if (!orderedCards.value.length) {
    setPageInfo('No timecards match the current filters.')
    return
  }

  resetMessages()

  try {
    await flushPendingSaves()

    const exportResult = buildTimecardCsvExport(orderedCards.value)
    if (!exportResult.detailRowCount) {
      setPageInfo('No CSV detail rows were found in the current timecards.')
      return
    }

    downloadTimecardCsvExport(buildCsvExportFilename(), exportResult.csvText)
    setPageInfo(
      `Downloaded CSV with ${exportResult.detailRowCount} detail row${exportResult.detailRowCount === 1 ? '' : 's'} from ${orderedCards.value.length} timecard${orderedCards.value.length === 1 ? '' : 's'}.`,
    )
  } catch (error) {
    setPageError(error, 'Failed to prepare the CSV export.')
  }
}

function handleWeekFilterDateInput(
  key: 'singleWeekEndDate' | 'rangeStartDate' | 'rangeEndDate',
  event: Event,
) {
  const input = event.target as HTMLInputElement
  filters[key] = snapToSaturday(input.value || currentWeekEndDate)
}

function handleDatePickerOpen(event: Event) {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
  if (typeof input.showPicker !== 'function') return

  try {
    input.showPicker()
  } catch {
    // Ignore browsers that block programmatic picker opening.
  }
}

watch(
  () => filteredWeeks.value.map((week) => `${week.id}:${week.weekStartDate}:${week.weekEndDate}:${week.jobId}:${week.status}`).join('|'),
  async () => {
    const syncToken = ++filteredWeekSyncToken
    if (cards.value.length || saveTimers.size || savePromises.size) {
      await flushPendingSaves()
      if (syncToken !== filteredWeekSyncToken) return
    }

    resetMessages()
    resetCardWorkspaceState()
    syncCardsForFilteredWeeks()
  },
  { immediate: true },
)

watch(
  () => jobsStore.jobs.map((job) => `${job.id}:${job.productionBurden ?? ''}`).join('|'),
  () => {
    Object.keys(cardsByWeekId).forEach((weekId) => {
      const week = weeks.value.find((entry) => entry.id === weekId)
      const currentCards = cardsByWeekId[weekId]
      if (!week || !currentCards) return
      cardsByWeekId[weekId] = decorateArchiveCards(week, currentCards)
    })

    rebuildArchiveCards()
  },
)

watch(
  () => createCardJobOptions.value.map((job) => job.id).join('|'),
  () => {
    if (!createCardJobOptions.value.length) {
      createCardJobId.value = ''
      return
    }

    if (createCardJobOptions.value.some((job) => job.id === createCardJobId.value)) {
      return
    }

    const currentWeekJobId = targetCreateWeek.value?.jobId
    if (currentWeekJobId && createCardJobOptions.value.some((job) => job.id === currentWeekJobId)) {
      createCardJobId.value = currentWeekJobId
      return
    }

    if (createCardJobOptions.value.length === 1) {
      createCardJobId.value = createCardJobOptions.value[0]?.id ?? ''
      return
    }

    createCardJobId.value = ''
  },
  { immediate: true },
)

watch(
  () => createCardForemanOptions.value.map((foreman) => foreman.id).join('|'),
  () => {
    if (!createCardForemanOptions.value.length) {
      createCardForemanId.value = ''
      return
    }

    if (createCardForemanOptions.value.some((foreman) => foreman.id === createCardForemanId.value)) {
      return
    }

    if (targetCreateWeek.value?.id && createCardForemanOptions.value.length === 1) {
      createCardForemanId.value = createCardForemanOptions.value[0]?.id ?? ''
      return
    }

    if (filters.foreman !== 'all') {
      const matchingForeman = createCardForemanOptions.value.find((foreman) => foreman.label === filters.foreman)
      if (matchingForeman) {
        createCardForemanId.value = matchingForeman.id
        return
      }
    }

    if (createCardForemanOptions.value.length === 1) {
      createCardForemanId.value = createCardForemanOptions.value[0]?.id ?? ''
      return
    }

    createCardForemanId.value = ''
  },
  { immediate: true },
)

watch(
  () => orderedCards.value.map((card) => card.id).join('|'),
  () => {
    if (!orderedCards.value.length) {
      selectedCardId.value = null
      return
    }

    if (!selectedCardId.value || !orderedCards.value.some((card) => card.id === selectedCardId.value)) {
      selectedCardId.value = orderedCards.value[0]?.id ?? null
    }
  },
)

watch(
  () => statusSignals.value.map((signal) => signal.text).join('|'),
  async () => {
    await nextTick()
    syncStatusSignalIndex()
  },
  { immediate: true },
)

onMounted(() => {
  jobsStore.subscribeVisibleJobs()
  subscribeWeeksForArchive()
  subscribeEmployeesForExport()
  subscribeUsersForExport()
  void nextTick().then(() => {
    syncStatusSignalIndex()
  })
})

onBeforeUnmount(() => {
  saveTimers.forEach((timer) => clearTimeout(timer))
  cardShellObservers.forEach((observer) => observer.disconnect())
  cardContentObservers.forEach((observer) => observer.disconnect())
  stopWeeksSubscription()
  stopCardsSubscription()
  stopEmployeesSubscription()
  stopUsersSubscription()
})
</script>

<template>
  <AppShell>
    <div class="timecards-page">
      <section class="timecards-workbook">
        <section class="timecards-toolbar">
          <div class="timecards-toolbar__tabs" role="tablist" aria-label="Timecard export tools">
            <button
              v-for="tab in mobileToolbarTabs"
              :id="`timecard-export-tab-${tab.key}`"
              :key="tab.key"
              class="timecards-toolbar__tab"
              :class="{ 'timecards-toolbar__tab--active': activeMobileToolbarTab === tab.key }"
              type="button"
              role="tab"
              :aria-selected="activeMobileToolbarTab === tab.key"
              :aria-controls="`timecard-export-panel-${tab.key}`"
              @click="activeMobileToolbarTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <fieldset
            id="timecard-export-panel-weeks"
            class="timecards-toolbar__group timecards-toolbar__group--filters timecards-toolbar__group--weeks"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'weeks' }"
            role="tabpanel"
            :aria-labelledby="'timecard-export-tab-weeks'"
          >
            <legend class="timecards-toolbar__legend">Week Filters</legend>
            <label class="timecards-toolbar__search">
              <span>Search Weeks</span>
              <input
                v-model="filters.weekSearch"
                type="search"
                placeholder="Job, foreman, or date"
              />
            </label>

            <div class="timecards-toolbar__stack timecards-toolbar__stack--date-filters">
              <label class="timecards-toolbar__search">
                <span>Date Mode</span>
                <Select
                  v-model="filters.dateMode"
                  class="timecards-toolbar__select"
                  :options="dateModeOptions"
                  option-label="label"
                  option-value="value"
                  overlay-class="timecards-toolbar__select-overlay"
                  :unstyled="false"
                  fluid
                />
              </label>

              <div
                class="timecards-toolbar__date-row"
                :class="{ 'timecards-toolbar__date-row--range': filters.dateMode === 'range' }"
              >
                <label v-if="filters.dateMode === 'single'" class="timecards-toolbar__search">
                  <span>Week Ending</span>
                  <input
                    :value="filters.singleWeekEndDate"
                    type="date"
                    @change="handleWeekFilterDateInput('singleWeekEndDate', $event)"
                    @click="handleDatePickerOpen"
                  />
                </label>

                <template v-else>
                  <label class="timecards-toolbar__search">
                    <span>Start Date</span>
                    <input
                      :value="filters.rangeStartDate"
                      type="date"
                      @change="handleWeekFilterDateInput('rangeStartDate', $event)"
                      @click="handleDatePickerOpen"
                    />
                  </label>

                  <label class="timecards-toolbar__search">
                    <span>End Date</span>
                    <input
                      :value="filters.rangeEndDate"
                      type="date"
                      @change="handleWeekFilterDateInput('rangeEndDate', $event)"
                      @click="handleDatePickerOpen"
                    />
                  </label>
                </template>
              </div>
            </div>
          </fieldset>

          <fieldset
            id="timecard-export-panel-archive"
            class="timecards-toolbar__group timecards-toolbar__group--filters timecards-toolbar__group--archive"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'archive' }"
            role="tabpanel"
            :aria-labelledby="'timecard-export-tab-archive'"
          >
            <legend class="timecards-toolbar__legend">Archive Filters</legend>
            <div class="timecards-toolbar__matrix">
              <label class="timecards-toolbar__search timecards-toolbar__search--wide">
                <span>Jobs</span>
                <MultiSelect
                  v-model="filters.selectedJobIds"
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
                />
              </label>

              <label class="timecards-toolbar__search">
                <span>Foreman</span>
                <Select
                  v-model="filters.foreman"
                  class="timecards-toolbar__select"
                  :options="availableForemanOptions"
                  option-label="label"
                  option-value="value"
                  overlay-class="timecards-toolbar__select-overlay"
                  :unstyled="false"
                  fluid
                />
              </label>

              <label class="timecards-toolbar__search">
                <span>Status</span>
                <Select
                  v-model="filters.status"
                  class="timecards-toolbar__select"
                  :options="weekStatusOptions"
                  option-label="label"
                  option-value="value"
                  overlay-class="timecards-toolbar__select-overlay"
                  :unstyled="false"
                  fluid
                />
              </label>
            </div>
          </fieldset>

          <fieldset
            id="timecard-export-panel-sort"
            class="timecards-toolbar__group timecards-toolbar__group--sort"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'sort' }"
            role="tabpanel"
            :aria-labelledby="'timecard-export-tab-sort'"
          >
            <legend class="timecards-toolbar__legend">Sort Cards</legend>
            <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
            <div class="timecards-toolbar__sort-stack">
              <div class="timecards-toolbar__sort">
                <label class="timecards-toolbar__radio">
                  <input v-model="sortMode" type="radio" value="number" />
                  <span>Employee#</span>
                </label>
                <label class="timecards-toolbar__radio">
                  <input v-model="sortMode" type="radio" value="name" />
                  <span>Name</span>
                </label>
              </div>

              <label class="timecards-toolbar__search">
                <span>Employee Search</span>
                <input
                  v-model="filters.cardSearch"
                  type="search"
                  placeholder="Search all matching cards"
                />
              </label>
            </div>
          </fieldset>

          <fieldset
            id="timecard-export-panel-actions"
            class="timecards-toolbar__group timecards-toolbar__group--actions"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'actions' }"
            role="tabpanel"
            :aria-labelledby="'timecard-export-tab-actions'"
          >
            <legend class="timecards-toolbar__legend">Workspace Actions</legend>
            <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
            <div class="timecards-toolbar__controls">
              <div class="timecards-toolbar__matrix">
                <button class="timecards-button" type="button" @click="setAllCardsCompact(false)">
                  Expand All
                </button>
                <button class="timecards-button" type="button" @click="setAllCardsCompact(true)">
                  Compact All
                </button>
                <button class="timecards-button timecards-button--primary" type="button" @click="handlePdfExport">
                  Export PDF
                </button>
                <button class="timecards-button timecards-button--primary" type="button" @click="handleCsvExport">
                  Export CSV
                </button>
                <button
                  v-if="auth.isAdmin"
                  class="timecards-button"
                  type="button"
                  :disabled="actionLoading"
                  @click="showCreateTray = !showCreateTray"
                >
                  {{ showCreateTray ? 'Close Create' : 'Create Card' }}
                </button>
              </div>
            </div>
          </fieldset>

          <fieldset
            id="timecard-export-panel-saved"
            class="timecards-toolbar__group timecards-toolbar__group--history"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'saved' }"
            role="tabpanel"
            :aria-labelledby="'timecard-export-tab-saved'"
          >
            <legend class="timecards-toolbar__legend">Saved Weeks</legend>
            <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
            <div class="timecards-toolbar__history">
              <div
                v-for="week in filteredWeeks"
                :key="week.id"
                class="timecards-sidebar__history-row"
              >
                <strong>{{ formatWorkbookDate(week.weekEndDate) }}</strong>
                <span>{{ formatWeekRowSubtitle(week) }}</span>
                <span>{{ week.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
              </div>

              <div v-if="!filteredWeeks.length && !weeksLoading" class="timecards-sidebar__empty">
                No saved weeks match the current filters.
              </div>
            </div>
          </fieldset>

          <fieldset class="timecards-toolbar__group timecards-toolbar__group--status-bar">
            <legend class="timecards-toolbar__legend">Status</legend>
            <div class="timecards-toolbar__status-strip timecards-toolbar__status-strip--desktop">
              <span
                v-for="signal in statusSignals"
                :key="signal.key"
                class="timecards-signal"
                :class="{
                  'timecards-signal--success': signal.tone === 'success',
                  'timecards-signal--error': signal.tone === 'error',
                }"
              >
                {{ signal.text }}
              </span>
            </div>
            <div class="timecards-toolbar__status-scroll">
              <button
                type="button"
                class="timecards-toolbar__status-scroll-button"
                :disabled="!canScrollStatusBackward"
                @click="scrollStatusSignals(-1)"
              >
                <span class="timecards-toolbar__status-carousel-glyph" aria-hidden="true">&lt;</span>
              </button>

              <div
                :ref="setStatusScrollerRef"
                class="timecards-toolbar__status-scroller"
                :class="{ 'timecards-toolbar__status-scroller--dragging': statusScrollerDrag.dragging }"
                @scroll.passive="syncStatusSignalIndex"
                @pointerdown="beginStatusScrollerDrag"
                @pointermove="handleStatusScrollerDrag"
                @pointerup="endStatusScrollerDrag"
                @pointercancel="endStatusScrollerDrag"
              >
                <div
                  v-for="(signal, index) in statusSignals"
                  :key="signal.key"
                  :ref="(element) => setStatusSignalItemRef(index, element)"
                  class="timecards-toolbar__status-carousel-item"
                >
                  <span
                    class="timecards-signal"
                    :class="{
                      'timecards-signal--success': signal.tone === 'success',
                      'timecards-signal--error': signal.tone === 'error',
                    }"
                  >
                    {{ signal.text }}
                  </span>
                </div>
              </div>

              <button
                type="button"
                class="timecards-toolbar__status-scroll-button"
                :disabled="!canScrollStatusForward"
                @click="scrollStatusSignals(1)"
              >
                <span class="timecards-toolbar__status-carousel-glyph" aria-hidden="true">&gt;</span>
              </button>
            </div>
          </fieldset>
        </section>

        <div v-if="pageError" class="timecards-message timecards-message--error">
          {{ pageError }}
        </div>

        <div v-else-if="pageInfo" class="timecards-message">
          {{ pageInfo }}
        </div>

        <section v-if="auth.isAdmin && showCreateTray" class="timecards-create">
          <div v-if="createTrayMessage" class="timecards-empty timecards-create__notice">
            {{ createTrayMessage }}
          </div>

          <template v-else>
            <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--job">
              <legend class="timecards-toolbar__legend">Week Target</legend>
              <h2 class="timecards-create__title">Pick The Job And Foreman</h2>

              <div class="timecards-create__target-grid">
                <label class="timecards-toolbar__search timecards-create__target-field">
                  <span>Linked Job</span>
                  <Select
                    v-model="createCardJobId"
                    class="timecards-toolbar__select timecards-create__control"
                    :options="createCardJobOptions"
                    option-label="label"
                    option-value="id"
                    overlay-class="timecards-toolbar__select-overlay"
                    placeholder="Select linked job"
                    :unstyled="false"
                    fluid
                  />
                </label>

                <label class="timecards-toolbar__search timecards-create__target-field">
                  <span>Foreman Owner</span>
                  <Select
                    v-model="createCardForemanId"
                    class="timecards-toolbar__select timecards-create__control"
                    :options="createCardForemanOptions"
                    option-label="label"
                    option-value="id"
                    overlay-class="timecards-toolbar__select-overlay"
                    placeholder="Select foreman"
                    :disabled="!createCardJobId || !createCardForemanOptions.length"
                    :unstyled="false"
                    fluid
                  />
                </label>
              </div>

              <p
                v-if="createCardJobId && !targetCreateWeek?.id && !createCardForemanOptions.length"
                class="timecards-create__warning"
              >
                No foremen are assigned to this job. Assign a foreman before creating a card for it.
              </p>

              <p class="timecards-create__hint">
                New export cards use this job and foreman target. If the saved week does not exist yet, export will open it under that foreman first.
              </p>
            </fieldset>

            <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--directory">
              <legend class="timecards-toolbar__legend">Employee Directory</legend>
              <h2 class="timecards-create__title">Create From Employee</h2>

              <label class="timecards-toolbar__search timecards-create__search-field">
                <span>Employee Search</span>
                <input
                  v-model="employeeSearchTerm"
                  class="timecards-create__search timecards-create__field"
                  type="search"
                  placeholder="Search employees"
                  :disabled="actionLoading || !canEditWeek"
                />
              </label>

              <div class="timecards-create__list">
                <button
                  v-for="employee in availableEmployees"
                  :key="employee.id"
                  class="timecards-create__employee"
                  type="button"
                  :disabled="actionLoading || !canEditWeek || !createCardJobId || (!targetCreateWeek?.id && !createCardForemanId)"
                  @click="handleAddEmployee(employee)"
                >
                  <div class="timecards-create__employee-identity">
                    <strong class="timecards-create__employee-name">{{ employee.firstName }} {{ employee.lastName }}</strong>
                    <span class="timecards-create__employee-number">#{{ employee.employeeNumber }}</span>
                  </div>
                  <span>{{ employee.occupation }}</span>
                </button>

                <div v-if="employeesLoading" class="timecards-empty">
                  Loading employees...
                </div>
                <div v-else-if="!availableEmployees.length" class="timecards-empty">
                  No employees available to add.
                </div>
              </div>
            </fieldset>

            <fieldset class="timecards-toolbar__group timecards-create__panel timecards-create__panel--custom">
              <legend class="timecards-toolbar__legend">Custom Card</legend>
              <h2 class="timecards-create__title">Create One-Off Card</h2>

              <div class="timecards-create__grid">
                <label class="timecards-toolbar__search">
                  <span>First Name</span>
                  <input v-model="customCardForm.firstName" class="timecards-create__field" type="text" :disabled="actionLoading || !canEditWeek" />
                </label>
                <label class="timecards-toolbar__search">
                  <span>Last Name</span>
                  <input v-model="customCardForm.lastName" class="timecards-create__field" type="text" :disabled="actionLoading || !canEditWeek" />
                </label>
                <label class="timecards-toolbar__search">
                  <span>Employee #</span>
                  <input v-model="customCardForm.employeeNumber" class="timecards-create__field" type="text" :disabled="actionLoading || !canEditWeek" />
                </label>
                <label class="timecards-toolbar__search">
                  <span>Occupation</span>
                  <input v-model="customCardForm.occupation" class="timecards-create__field" type="text" :disabled="actionLoading || !canEditWeek" />
                </label>
                <label class="timecards-toolbar__search">
                  <span>Wage</span>
                  <input
                    v-model="customCardForm.wageRate"
                    class="timecards-create__field"
                    type="number"
                    min="0"
                    step="0.01"
                    inputmode="decimal"
                    :disabled="actionLoading || !canEditWeek"
                  />
                </label>
                <div class="timecards-toolbar__search">
                  <span>Type</span>
                  <label class="timecards-create__checkbox">
                    <input v-model="customCardForm.isContractor" type="checkbox" :disabled="actionLoading || !canEditWeek" />
                    <span>Contractor</span>
                  </label>
                </div>
              </div>

              <button
                class="timecards-button timecards-button--primary"
                type="button"
                :disabled="actionLoading || !canEditWeek || !createCardJobId || (!targetCreateWeek?.id && !createCardForemanId)"
                @click="handleAddCustomCard"
              >
                Add Custom Card
              </button>
            </fieldset>
          </template>
        </section>

        <div class="timecards-workspace">
          <section class="timecards-canvas-panel">
            <div class="timecards-canvas-panel__header">
              <div>
                <span class="timecards-canvas-panel__eyebrow">Time Cards</span>
                <h2>{{ visibleWeekHeading }}</h2>
              </div>

              <div class="timecards-canvas-panel__meta">
                <span>{{ matchingPackageCountLabel }}</span>
                <span>{{ matchingJobsLabel }}</span>
                <span>{{ matchingForemenLabel }}</span>
              </div>
            </div>

            <div v-if="cardsLoading || weeksLoading" class="timecards-empty timecards-empty--canvas">
              Loading workbook...
            </div>

            <div v-else-if="!orderedCards.length" class="timecards-empty timecards-empty--canvas">
              {{ emptyCanvasMessage }}
            </div>

            <div v-else class="timecards-canvas">
              <article
                v-for="card in orderedCards"
                :id="`timecard-export-card-${card.id}`"
                :key="card.id"
                class="timecards-canvas__item"
                :class="{
                  'timecards-canvas__item--active': card.id === selectedCardId,
                  'timecards-canvas__item--compact': isCardCompact(card.id),
                }"
                @mousedown.capture="selectCard(card.id)"
                @focusin.capture="selectCard(card.id)"
              >
                <div class="timecards-canvas__item-header">
                  <button
                    class="timecards-canvas__item-header-button timecards-canvas__item-header-button--collapse"
                    type="button"
                    @click="toggleCardCompact(card.id)"
                  >
                    <span class="timecards-canvas__item-header-label">
                      {{ isCardCompact(card.id) ? 'Expand Card' : 'Collapse Card' }}
                    </span>
                  </button>

                  <button
                    v-if="canEditWeek"
                    class="timecards-canvas__item-header-button timecards-canvas__item-header-button--edit"
                    :class="{ 'timecards-canvas__item-header-button--active': isCardEditable(card.id) }"
                    type="button"
                    @click.stop="toggleCardEditMode(card.id)"
                  >
                    {{ isCardEditable(card.id) ? 'Lock Card' : 'Edit Card' }}
                  </button>
                </div>

                <div
                  class="timecards-canvas__item-card-shell"
                  :style="getCardShellStyle(card.id)"
                  :ref="(element) => setCardShellElement(card.id, asObservedElement(element))"
                >
                  <div
                    class="timecards-canvas__item-card-scale"
                    :style="getCardScaleStyle(card.id)"
                    :ref="(element) => setCardContentElement(card.id, asObservedElement(element))"
                  >
                    <TimecardWorkbookCard
                      :card="card"
                      :compact="isCardCompact(card.id)"
                      :week-end-date="card.archiveWeekEndDate"
                      :burden="card.archiveBurden"
                      :read-only="isCardReadOnly(card.id)"
                      :employee-header-locked="isEmployeeHeaderLocked(card)"
                      :show-employee-wage="auth.isAdmin"
                      :show-cost-values="auth.isAdmin"
                      @changed="handleWorkbookChanged(card)"
                    />
                  </div>
                </div>

                <div v-if="canEditWeek && isCardEditable(card.id) && !isCardCompact(card.id)" class="timecards-canvas__item-footer">
                  <button
                    class="timecards-canvas__item-footer-button"
                    type="button"
                    :disabled="actionLoading"
                    @click.stop="handleRemoveCard(card)"
                  >
                    Delete Card
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>

        <section class="timecards-summary-panel timecards-sidebar__panel">
          <div class="timecards-sidebar__header">
            <span class="timecards-sidebar__eyebrow">Current Results</span>
            <h2>Totals</h2>
          </div>

          <div class="timecards-summary__stats">
            <div>
              <span>Cards</span>
              <strong>{{ cards.length }}</strong>
            </div>
            <div>
              <span>Total Hours</span>
              <strong>{{ totalHours.toFixed(1) }}</strong>
            </div>
            <div>
              <span>Production</span>
              <strong>{{ totalProduction.toFixed(1) }}</strong>
            </div>
          </div>

          <div class="timecards-sidebar__table-wrap">
            <table class="timecards-sidebar__table">
              <thead>
                <tr>
                  <th>Job Number</th>
                  <th>Area</th>
                  <th>Account</th>
                  <th>Total Hours</th>
                  <th>Production</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="account in accountsSummary" :key="account.key">
                  <td>{{ account.jobNumber || '-' }}</td>
                  <td>{{ account.subsectionArea || '-' }}</td>
                  <td>{{ account.account || '-' }}</td>
                  <td>{{ account.hoursTotal.toFixed(1) }}</td>
                  <td>{{ account.productionTotal.toFixed(1) }}</td>
                </tr>
                <tr v-if="!accountsSummary.length">
                  <td colspan="5" class="timecards-sidebar__empty">
                    No account totals yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
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

.timecards-toolbar,
.timecards-sidebar__panel,
.timecards-canvas-panel,
.timecards-message {
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecards-toolbar__legend,
.timecards-canvas-panel__eyebrow,
.timecards-sidebar__eyebrow {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecards-canvas-panel__header h2,
.timecards-sidebar__header h2 {
  margin: 0;
}

.timecards-toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.75rem;
  padding: 0.95rem;
  align-items: start;
  --timecards-toolbar-label-height: 1.15rem;
  --timecards-toolbar-label-gap: 0.4rem;
  --timecards-toolbar-group-gap: 0.65rem;
  --timecards-toolbar-lead-overlap: 0.52rem;
}

.timecards-toolbar__tabs {
  display: none;
  min-width: 0;
}

.timecards-toolbar__group {
  display: grid;
  gap: var(--timecards-toolbar-group-gap);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.timecards-toolbar__legend {
  padding: 0;
}

.timecards-toolbar__stack,
.timecards-toolbar__controls {
  display: grid;
  gap: 0.55rem;
}

.timecards-toolbar__lead-spacer {
  display: block;
  height: calc(var(--timecards-toolbar-label-height) + var(--timecards-toolbar-label-gap));
  margin-bottom: calc(-1 * var(--timecards-toolbar-lead-overlap));
}

.timecards-toolbar__group--status-bar {
  grid-column: 1 / -1;
}

.timecards-toolbar__history {
  display: grid;
  gap: 0.4rem;
  max-height: 13.5rem;
  overflow: auto;
  min-height: 0;
  padding-right: 0.2rem;
  overscroll-behavior: contain;
}

.timecards-toolbar__status-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.55rem;
}

.timecards-toolbar__status-scroll {
  display: none;
  width: 100%;
}

.timecards-toolbar__status-carousel-item {
  display: flex;
  justify-content: center;
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  scroll-snap-align: start;
}

.timecards-toolbar__status-carousel-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.timecards-toolbar__status-scroll-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  min-width: 2rem;
  height: var(--timecards-toolbar-control-height);
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  color: rgba(64, 85, 36, 0.82);
  box-shadow: none;
}

.timecards-toolbar__status-scroll-button:hover:not(:disabled) {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(245, 248, 233, 0.98);
}

.timecards-toolbar__status-scroll-button:disabled {
  opacity: 0.4;
}

.timecards-toolbar__status-scroller {
  --timecards-status-gap: 0.45rem;
  display: flex;
  gap: var(--timecards-status-gap);
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
  cursor: grab;
}

.timecards-toolbar__status-scroller::-webkit-scrollbar {
  display: none;
}

.timecards-toolbar__status-scroller--dragging {
  scroll-snap-type: none;
  scroll-behavior: auto;
  cursor: grabbing;
}

.timecards-toolbar__search {
  display: grid;
  gap: var(--timecards-toolbar-label-gap);
  font-weight: 600;
  min-width: 0;
}

.timecards-toolbar__search > span {
  display: flex;
  align-items: end;
  min-height: var(--timecards-toolbar-label-height);
}

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

.timecards-toolbar__select {
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

.timecards-toolbar__select:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecards-toolbar__multiselect.p-focus {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__select.p-focus {
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

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay) {
  border: 1px solid rgba(205, 214, 189, 0.96);
  border-radius: 0.6rem;
  background: rgba(255, 255, 251, 0.99);
  box-shadow:
    0 14px 30px rgba(50, 58, 34, 0.12),
    0 3px 8px rgba(50, 58, 34, 0.08);
  overflow: hidden;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-header) {
  padding: 0.7rem 0.7rem 0.42rem;
  background: transparent;
  border-bottom: none;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter-container) {
  display: block;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter) {
  min-height: 2.5rem;
  padding: 0 2.35rem 0 0.9rem;
  border: 1px solid rgba(196, 206, 182, 0.95);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: none;
  color: rgba(51, 61, 39, 0.92);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter::placeholder) {
  color: rgba(85, 96, 64, 0.68);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-filter:focus) {
  outline: none;
  border-color: rgba(157, 190, 134, 0.96);
  box-shadow: 0 0 0 1px rgba(197, 228, 186, 0.72);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-inputicon) {
  color: rgba(120, 134, 97, 0.86);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-list-container) {
  padding: 0 0.35rem 0.4rem;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-list) {
  display: grid;
  gap: 0.08rem;
  padding: 0;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option) {
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

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-focus) {
  background: rgba(241, 246, 235, 0.94);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-multiselect-option-selected) {
  background: rgba(198, 238, 207, 0.82);
  color: rgba(35, 80, 44, 0.96);
  box-shadow: inset 0 0 0 1px rgba(164, 211, 174, 0.88);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-option.p-multiselect-option-selected.p-focus) {
  background: rgba(188, 233, 199, 0.92);
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox) {
  flex: 0 0 auto;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox-box) {
  width: 1.1rem;
  height: 1.1rem;
  border: 1px solid rgba(190, 202, 173, 0.95);
  border-radius: 0.24rem;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: none;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox.p-checkbox-checked .p-checkbox-box) {
  border-color: rgba(68, 182, 108, 0.98);
  background: rgba(68, 182, 108, 0.98);
  color: #fff;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-checkbox-icon) {
  width: 0.72rem;
  height: 0.72rem;
}

.timecards-toolbar :deep(.timecards-toolbar__multiselect-overlay .p-multiselect-empty-message) {
  padding: 0.7rem 0.8rem 0.8rem;
  color: rgba(85, 96, 64, 0.82);
}

.timecards-toolbar__select :deep(.p-select-label) {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-height: calc(var(--timecards-toolbar-control-height) - 2px);
  padding: 0 0.75rem;
  font-weight: 500;
  background: transparent;
  color: var(--timecards-toolbar-control-text);
}

.timecards-toolbar__select :deep(.p-select-label.p-placeholder) {
  color: rgba(70, 77, 48, 0.72);
}

.timecards-toolbar__select :deep(.p-select-dropdown) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.3rem;
  background: transparent;
  color: rgba(73, 89, 37, 0.82);
}

.timecards-toolbar__search input,
.timecards-toolbar__search select,
.timecards-create__field {
  min-height: var(--timecards-toolbar-control-height);
  min-width: 0;
  padding: 0 0.75rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  box-shadow: none;
  box-sizing: border-box;
  font: inherit;
}

.timecards-toolbar__search input::placeholder,
.timecards-create__field::placeholder {
  color: rgba(70, 77, 48, 0.72);
}

.timecards-toolbar__search input:focus,
.timecards-toolbar__search input:focus-visible,
.timecards-create__field:focus,
.timecards-create__field:focus-visible {
  outline: none;
  border-color: var(--timecards-toolbar-control-border-strong);
  background-color: rgba(248, 250, 240, 0.98);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

:deep(.timecards-toolbar__select-overlay) {
  border: 1px solid rgba(205, 214, 189, 0.96);
  border-radius: 0.45rem;
  background: rgba(255, 255, 251, 0.99);
  box-shadow:
    0 14px 30px rgba(50, 58, 34, 0.12),
    0 3px 8px rgba(50, 58, 34, 0.08);
  overflow: hidden;
}

:deep(.timecards-toolbar__select-overlay .p-select-list-container) {
  padding: 0.3rem;
}

:deep(.timecards-toolbar__select-overlay .p-select-list) {
  display: grid;
  gap: 0.08rem;
  padding: 0;
}

:deep(.timecards-toolbar__select-overlay .p-select-option) {
  min-height: 2.35rem;
  margin: 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.32rem;
  background: transparent;
  color: rgba(43, 54, 34, 0.94);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-focus) {
  background: rgba(241, 246, 235, 0.94);
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-select-option-selected) {
  background: rgba(198, 238, 207, 0.82);
  color: rgba(35, 80, 44, 0.96);
  box-shadow: inset 0 0 0 1px rgba(164, 211, 174, 0.88);
}

:deep(.timecards-toolbar__select-overlay .p-select-option.p-select-option-selected.p-focus) {
  background: rgba(188, 233, 199, 0.92);
}

.timecards-toolbar__matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.timecards-toolbar__stack--date-filters {
  gap: 0.55rem;
}

.timecards-toolbar__date-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
}

.timecards-toolbar__date-row--range {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.timecards-button {
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.95rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  color: var(--timecards-toolbar-control-text);
  font-weight: 600;
  box-shadow: none;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.timecards-button:hover:not(:disabled) {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(245, 248, 233, 0.98);
}

.timecards-button:focus-visible {
  outline: none;
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.timecards-button--primary {
  border-color: rgba(63, 120, 67, 0.46);
  background: var(--timecards-toolbar-control-bg-active);
  color: #24411c;
}

.timecards-toolbar__sort {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.timecards-toolbar__sort-stack {
  display: grid;
  gap: 0.65rem;
}

.timecards-toolbar__radio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  font-weight: 600;
  box-shadow: none;
}

.timecards-toolbar__radio:has(input:checked) {
  border-color: rgba(63, 120, 67, 0.46);
  background: var(--timecards-toolbar-control-bg-active);
}

.timecards-toolbar__radio:has(input:focus-visible) {
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__radio input {
  accent-color: #3d7a43;
}

.timecards-signal {
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  display: inline-flex;
  align-items: center;
  font-size: 0.84rem;
  font-weight: 600;
}

.timecards-signal--success {
  border-color: rgba(46, 109, 61, 0.36);
  color: #1e5c34;
  background: rgba(221, 241, 214, 0.96);
}

.timecards-signal--error {
  border-color: rgba(167, 53, 53, 0.36);
  color: #8a2828;
  background: rgba(248, 224, 220, 0.96);
}

.timecards-create__checkbox {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--timecards-toolbar-control-height);
  box-sizing: border-box;
  font: inherit;
}

.timecards-create__field:disabled,
.timecards-create__control.p-disabled,
.timecards-create__checkbox:has(input:disabled) {
  border-color: rgba(196, 204, 176, 0.92);
  background: rgba(242, 245, 233, 0.94);
  color: rgba(95, 104, 74, 0.82);
  box-shadow: none;
}

.timecards-create__field:disabled {
  cursor: not-allowed;
  -webkit-text-fill-color: rgba(95, 104, 74, 0.82);
  opacity: 1;
}

.timecards-create__search-field {
  max-width: 22rem;
}

.timecards-create__control.p-disabled :deep(.p-select-label),
.timecards-create__control.p-disabled :deep(.p-select-dropdown) {
  background: transparent;
  color: rgba(95, 104, 74, 0.82);
}

.timecards-create {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(20rem, 0.95fr);
  gap: 0.9rem;
  padding: 0.85rem;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecards-create__panel {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.24);
  background: rgba(255, 255, 255, 0.18);
}

.timecards-create__panel--job {
  grid-column: 1 / -1;
  align-content: start;
}

.timecards-create__notice {
  grid-column: 1 / -1;
  min-height: auto;
  text-align: left;
}

.timecards-create__title {
  margin: 0;
  font-size: 1rem;
}

.timecards-create__target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(17rem, 22rem));
  gap: 0.7rem 0.9rem;
  align-items: start;
}

.timecards-create__target-field {
  width: 100%;
  max-width: 22rem;
}

.timecards-create__hint {
  margin: 0;
  max-width: 44rem;
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.84rem;
  line-height: 1.35;
}

.timecards-create__warning {
  margin: -0.1rem 0 0;
  max-width: 34rem;
  color: #8a2828;
  font-size: 0.84rem;
  line-height: 1.35;
}

.timecards-create__list {
  display: grid;
  gap: 0.35rem;
  max-height: 14rem;
  overflow: auto;
  padding-right: 0.2rem;
}

.timecards-create__employee {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.34);
  background: rgba(255, 255, 255, 0.84);
  text-align: left;
}

.timecards-create__employee-identity {
  display: grid;
  gap: 0.08rem;
  min-width: 0;
}

.timecards-create__employee-name {
  font-size: 0.92rem;
  color: #1b2114;
}

.timecards-create__employee-number {
  color: rgba(38, 43, 23, 0.68);
  font-size: 0.82rem;
  white-space: nowrap;
}

.timecards-create__employee span {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.88rem;
}

.timecards-create__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem 0.75rem;
}

.timecards-create__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.75rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: var(--timecards-toolbar-control-text);
  font-weight: 600;
  box-shadow: none;
}

.timecards-create__checkbox:hover {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(248, 250, 240, 0.98);
}

.timecards-create__checkbox:has(input:focus-visible) {
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-create__checkbox input {
  accent-color: #3d7a43;
}

.timecards-create__panel--custom .timecards-button {
  margin-top: 0.15rem;
}

.timecards-message {
  padding: 0.85rem 1rem;
  color: #1b2114;
}

.timecards-message--error {
  border-color: rgba(167, 53, 53, 0.36);
  background: rgba(248, 224, 220, 0.92);
  color: #7c2222;
}

.timecards-workspace {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: start;
  min-width: 0;
}

.timecards-canvas-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  min-width: 0;
}

.timecards-canvas-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: end;
}

.timecards-canvas-panel__meta {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.86rem;
}

.timecards-canvas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
}

.timecards-canvas__item {
  padding: 0.6rem;
  border: 2px solid rgba(62, 78, 36, 0.2);
  background: rgba(234, 239, 216, 0.88);
  align-self: start;
  min-width: 0;
  overflow: hidden;
}

.timecards-canvas__item--active {
  border-color: rgba(48, 121, 68, 0.66);
  box-shadow: 0 0 0 2px rgba(48, 121, 68, 0.16);
}

.timecards-canvas__item-header {
  display: flex;
  gap: 0.45rem;
  margin: 0 0 0.4rem;
}

.timecards-canvas__item-header-button {
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.2);
  background: rgba(255, 255, 255, 0.42);
  color: rgba(29, 33, 22, 0.84);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.timecards-canvas__item-header-button--collapse {
  flex: 1 1 auto;
  width: 100%;
  justify-content: flex-end;
}

.timecards-canvas__item-header-button--edit {
  flex: 0 0 auto;
  min-width: 6.6rem;
  border-color: rgba(63, 120, 67, 0.28);
  background: rgba(245, 250, 238, 0.82);
  color: rgba(36, 65, 28, 0.94);
}

.timecards-canvas__item-header-button--active {
  border-color: rgba(63, 120, 67, 0.46);
  background: rgba(221, 241, 214, 0.96);
}

.timecards-canvas__item-header-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(82, 132, 76, 0.18);
}

.timecards-canvas__item-header-label {
  pointer-events: none;
}

.timecards-canvas__item-footer {
  margin-top: 0.45rem;
}

.timecards-canvas__item-footer-button {
  width: 100%;
  min-height: 2rem;
  padding: 0 0.75rem;
  border: 1px solid rgba(167, 53, 53, 0.24);
  background: rgba(255, 248, 246, 0.78);
  color: #8a2828;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.timecards-canvas__item-footer-button:disabled {
  opacity: 0.48;
  cursor: default;
}

.timecards-canvas__item :deep(.timecard-card) {
  overflow: visible;
}

.timecards-canvas__item-card-shell {
  width: 100%;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: hidden;
}

.timecards-canvas__item-card-scale {
  display: inline-block;
  width: max-content;
  transform-origin: top center;
}

.timecards-sidebar__panel {
  display: grid;
  gap: 0.9rem;
  padding: 0.9rem;
}

.timecards-sidebar__header {
  display: grid;
  gap: 0.15rem;
}

.timecards-sidebar__history-row {
  display: grid;
  gap: 0.08rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
  color: #243018;
  text-align: left;
  line-height: 1.18;
  box-shadow: none;
}

.timecards-sidebar__history-row--active {
  border-color: rgba(63, 120, 67, 0.46);
  background: var(--timecards-toolbar-control-bg-active);
}

.timecards-sidebar__history-row strong {
  color: #243018;
  font-size: 0.92rem;
}

.timecards-sidebar__history-row span,
.timecards-sidebar__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.76rem;
}

.timecards-summary-panel {
  margin-top: 1rem;
}

.timecards-summary__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}

.timecards-summary__stats div {
  display: grid;
  gap: 0.2rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(71, 82, 41, 0.28);
  background: rgba(241, 245, 229, 0.92);
}

.timecards-summary__stats span {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.78rem;
}

.timecards-sidebar__table-wrap {
  overflow: auto;
}

.timecards-sidebar__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.timecards-sidebar__table th,
.timecards-sidebar__table td {
  padding: 0.32rem 0.24rem;
  border: 1px solid rgba(80, 93, 49, 0.38);
  text-align: left;
}

.timecards-sidebar__table th {
  background: rgba(223, 229, 199, 0.92);
  font-weight: 700;
}

.timecards-empty {
  padding: 1rem;
  border: 1px dashed rgba(88, 105, 44, 0.38);
  background: rgba(239, 244, 226, 0.74);
  color: rgba(38, 43, 23, 0.82);
  text-align: center;
}

.timecards-empty--canvas {
  min-height: 18rem;
  display: grid;
  place-items: center;
}

@media (min-width: 961px) {
  .timecards-toolbar {
    align-items: stretch;
  }

  .timecards-toolbar__group {
    align-content: start;
    min-height: 100%;
    padding: 0.72rem 0.82rem 0.82rem;
    border: 1px solid rgba(101, 120, 60, 0.2);
    background:
      linear-gradient(180deg, rgba(255, 255, 251, 0.46) 0%, rgba(244, 247, 232, 0.42) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.44),
      inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  .timecards-toolbar__group--status-bar {
    padding-top: 0.68rem;
  }
}

@media (min-width: 1280px) {
  .timecards-toolbar {
    grid-template-columns:
      minmax(18rem, 1.22fr)
      minmax(18rem, 1.22fr)
      minmax(17rem, 1.04fr)
      minmax(16.5rem, 1.05fr)
      minmax(17rem, 1.1fr);
    grid-template-areas:
      'weeks archive sort actions saved'
      'weeks archive sort actions saved'
      'status status status status status';
  }

  .timecards-toolbar__group--weeks {
    grid-area: weeks;
  }

  .timecards-toolbar__group--archive {
    grid-area: archive;
  }

  .timecards-toolbar__group--sort {
    grid-area: sort;
  }

  .timecards-toolbar__group--actions {
    grid-area: actions;
  }

  .timecards-toolbar__group--history {
    grid-area: saved;
  }

  .timecards-toolbar__group--status-bar {
    grid-area: status;
  }
}

@media (max-width: 960px) {
  .timecards-toolbar,
  .timecards-toolbar__matrix,
  .timecards-create,
  .timecards-canvas,
  .timecards-summary__stats {
    grid-template-columns: 1fr;
  }

  .timecards-toolbar__tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .timecards-toolbar__tab {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.35rem;
    width: 100%;
    padding: 0 0.95rem;
    border: 1px solid rgba(71, 82, 41, 0.48);
    background: linear-gradient(180deg, #ffffff 0%, #e6ead4 100%);
    color: #191b13;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: center;
  }

  .timecards-toolbar__tab--active {
    border-color: rgba(46, 109, 61, 0.48);
    background: linear-gradient(180deg, #f7fff6 0%, #d9efcc 100%);
    color: #1b3f17;
  }

  .timecards-toolbar__legend {
    display: none;
  }

  .timecards-toolbar__group {
    display: none;
  }

  .timecards-toolbar__group--mobile-active,
  .timecards-toolbar__group--status-bar {
    display: grid;
  }

  .timecards-toolbar__lead-spacer {
    display: none;
  }

  .timecards-toolbar__group--mobile-active {
    gap: 0.7rem;
    padding: 0.8rem;
    border: 1px solid rgba(88, 105, 44, 0.24);
    background: rgba(255, 255, 255, 0.32);
  }

  .timecards-toolbar__sort {
    flex-direction: column;
    align-items: stretch;
  }

  .timecards-toolbar__radio {
    width: 100%;
  }

  .timecards-toolbar__status-strip--desktop {
    display: none;
  }

  .timecards-toolbar__status-scroll {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem;
  }

  .timecards-toolbar__status-carousel-item {
    flex: 0 0 calc((100% - var(--timecards-status-gap)) / 2);
    min-width: calc((100% - var(--timecards-status-gap)) / 2);
  }

  .timecards-signal {
    width: 100%;
    justify-content: center;
    white-space: nowrap;
  }

  .timecards-canvas-panel__header {
    align-items: start;
    flex-direction: column;
  }

  .timecards-canvas-panel__meta {
    justify-content: flex-start;
  }

  .timecards-create__target-grid {
    grid-template-columns: 1fr;
  }

  .timecards-create__employee {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .timecards-create__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .timecards-toolbar__tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
