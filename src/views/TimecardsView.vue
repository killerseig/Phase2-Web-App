<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRoute } from 'vue-router'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import { MAX_TIMECARD_CARD_SCALE } from '@/features/timecards/layout'
import {
  DEFAULT_TIMECARD_BURDEN,
  buildAccountsSummary,
  buildCardDisplayName,
  formatWeekRange,
  getTodayIsoDate,
  getWeekStartFromSaturday,
  snapToSaturday,
  type TimecardEmployeeSeed,
} from '@/features/timecards/workbook'
import AppShell from '@/layouts/AppShell.vue'
import { subscribeEmployees } from '@/services/employees'
import {
  createTimecardCard,
  deleteTimecardCard,
  ensureTimecardWeek,
  subscribeTimecardCards,
  subscribeTimecardWeeks,
  submitTimecardWeek,
  updateTimecardCard,
} from '@/services/timecards'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type { EmployeeRecord, JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface CustomCardFormState {
  firstName: string
  lastName: string
  employeeNumber: string
  occupation: string
  wageRate: string
  isContractor: boolean
}

type WorkbookSortMode = 'name' | 'number'
type MobileToolbarTabKey = 'week' | 'search' | 'actions' | 'sort' | 'history'

const mobileToolbarTabs: Array<{ key: MobileToolbarTabKey; label: string }> = [
  { key: 'week', label: 'Week' },
  { key: 'search', label: 'Search' },
  { key: 'actions', label: 'Actions' },
  { key: 'sort', label: 'Sort' },
  { key: 'history', label: 'Saved' },
]

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' })

const route = useRoute()
const auth = useAuthStore()
const jobsStore = useJobsStore()

const weeks = ref<TimecardWeekRecord[]>([])
const cards = ref<TimecardCardRecord[]>([])
const employees = ref<EmployeeRecord[]>([])
const cardSearchTerm = ref('')
const employeeSearchTerm = ref('')
const selectedWeekEndDate = ref(snapToSaturday(getTodayIsoDate()))
const selectedCardId = ref<string | null>(null)
const weeksLoading = ref(true)
const cardsLoading = ref(false)
const employeesLoading = ref(true)
const pageError = ref('')
const pageInfo = ref('')
const ensuringWeek = ref(false)
const actionLoading = ref(false)
const saveError = ref('')
const lastSavedAt = ref<number | null>(null)
const sortMode = ref<WorkbookSortMode>('name')
const showCreateTray = ref(false)
const activeMobileToolbarTab = ref<MobileToolbarTabKey>('week')

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

let unsubscribeWeeks: (() => void) | null = null
let unsubscribeCards: (() => void) | null = null
let unsubscribeEmployees: (() => void) | null = null
let ensureKeyInFlight = ''

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const savePromises = new Map<string, Promise<void>>()
const cardShellObservers = new Map<string, ResizeObserver>()
const cardContentObservers = new Map<string, ResizeObserver>()

const jobId = computed(() => String(route.params.jobId ?? ''))
const job = computed<JobRecord | null>(() => {
  if (jobsStore.currentJob?.id === jobId.value) return jobsStore.currentJob
  return jobsStore.jobs.find((entry) => entry.id === jobId.value) ?? null
})
const selectedWeek = computed(() => (
  weeks.value.find((week) => week.weekEndDate === selectedWeekEndDate.value) ?? null
))
const selectedWeekStartDate = computed(() => selectedWeek.value?.weekStartDate ?? getWeekStartFromSaturday(selectedWeekEndDate.value))
const filteredCards = computed(() => {
  const query = cardSearchTerm.value.trim().toLowerCase()
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
const availableEmployees = computed(() => {
  const usedIds = new Set(cards.value.map((card) => card.employeeId).filter((value): value is string => !!value))
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
const accountsSummary = computed(() => buildAccountsSummary(cards.value))
const canEditWeek = computed(() => {
  if (!selectedWeek.value) return false
  return selectedWeek.value.status !== 'submitted' || auth.isAdmin
})
const pendingSaveCount = computed(() => Object.keys(scheduledSaveIds).length)
const activeSaveCount = computed(() => Object.keys(savingIds).length)
const totalHours = computed(() => cards.value.reduce((sum, card) => sum + Number(card.totals.hoursTotal ?? 0), 0))
const totalProduction = computed(() => cards.value.reduce((sum, card) => sum + Number(card.totals.productionTotal ?? 0), 0))
const weekStatusLabel = computed(() => {
  if (ensuringWeek.value && !selectedWeek.value) return 'Opening Week'
  if (!selectedWeek.value) return 'No Week'
  return selectedWeek.value.status === 'submitted' ? 'Submitted' : 'Draft'
})
const weekRangeLabel = computed(() => formatWeekRange(selectedWeekStartDate.value, selectedWeekEndDate.value))
const burdenValue = computed(() => job.value?.productionBurden ?? DEFAULT_TIMECARD_BURDEN)
const recentWeeks = computed(() => weeks.value.slice(0, 10))
const linkedJobNumber = computed(() => {
  const explicitWeekJobCode = String(selectedWeek.value?.jobCode ?? '').trim()
  if (explicitWeekJobCode) return explicitWeekJobCode
  return String(job.value?.code ?? '').trim()
})
const saveStateLabel = computed(() => {
  if (saveError.value) return saveError.value
  if (activeSaveCount.value || pendingSaveCount.value) return 'Saving...'
  if (!canEditWeek.value) return 'Read Only'
  if (lastSavedAt.value) return 'Saved'
  return 'Ready'
})
const emptyCanvasMessage = computed(() => {
  if (cards.value.length) return 'No cards match this search.'
  if (!canEditWeek.value) return 'No timecards were saved for this week.'
  return 'Create a card to start this week.'
})

function formatWorkbookDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}

function resetCustomCardForm() {
  customCardForm.firstName = ''
  customCardForm.lastName = ''
  customCardForm.employeeNumber = ''
  customCardForm.occupation = ''
  customCardForm.wageRate = ''
  customCardForm.isContractor = false
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

function stopWeeksSubscription() {
  unsubscribeWeeks?.()
  unsubscribeWeeks = null
}

function stopCardsSubscription() {
  unsubscribeCards?.()
  unsubscribeCards = null
}

function stopEmployeesSubscription() {
  unsubscribeEmployees?.()
  unsubscribeEmployees = null
}

function subscribeJob() {
  if (!jobId.value) return
  jobsStore.subscribeJob(jobId.value)
}

function subscribeEmployeesForTimecards() {
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

function subscribeWeeksForJob() {
  if (!jobId.value) return
  weeksLoading.value = true
  stopWeeksSubscription()

  unsubscribeWeeks = subscribeTimecardWeeks(
    jobId.value,
    (nextWeeks) => {
      weeks.value = nextWeeks
      weeksLoading.value = false
      void maybeEnsureSelectedWeek()
    },
    (error) => {
      weeksLoading.value = false
      setPageError(error, 'Failed to load timecard weeks.')
    },
  )
}

function syncCardUiState(nextCards: TimecardCardRecord[]) {
  const validIds = new Set(nextCards.map((card) => card.id))

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
    : nextCards[0]?.id ?? null

  nextCards.forEach((card) => {
    if (!Object.prototype.hasOwnProperty.call(compactCardStates, card.id)) {
      compactCardStates[card.id] = nextCards.length > 1 && card.id !== nextSelectedCardId
    }
  })

  selectedCardId.value = nextSelectedCardId
}

function subscribeCardsForWeek() {
  stopCardsSubscription()

  if (!selectedWeek.value) {
    cards.value = []
    cardsLoading.value = false
    return
  }

  cardsLoading.value = true
  unsubscribeCards = subscribeTimecardCards(
    selectedWeek.value.id,
    selectedWeek.value.weekStartDate,
    burdenValue.value,
    (nextCards) => {
      cards.value = nextCards
      cardsLoading.value = false
      syncCardUiState(nextCards)
    },
    (error) => {
      cardsLoading.value = false
      setPageError(error, 'Failed to load timecard cards.')
    },
  )
}

async function maybeEnsureSelectedWeek() {
  if (!jobId.value || !job.value) return
  if (weeksLoading.value) return
  if (selectedWeek.value) return

  const key = `${jobId.value}|${selectedWeekEndDate.value}`
  if (ensuringWeek.value || ensureKeyInFlight === key) return

  ensuringWeek.value = true
  ensureKeyInFlight = key
  try {
    await ensureTimecardWeek({
      jobId: jobId.value,
      jobCode: job.value.code ?? null,
      jobName: job.value.name ?? null,
      ownerForemanUserId: auth.currentUser?.uid ?? null,
      ownerForemanName: auth.displayName ?? null,
      weekEndDate: selectedWeekEndDate.value,
    })
  } catch (error) {
    setPageError(error, 'Failed to open the timecard week.')
  } finally {
    ensuringWeek.value = false
    ensureKeyInFlight = ''
  }
}

function getNextSortIndex() {
  return cards.value.reduce((maxValue, card) => Math.max(maxValue, Number(card.sortIndex ?? 0)), -1) + 1
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

function clearSaveTimer(cardId: string) {
  const timer = saveTimers.get(cardId)
  if (timer) clearTimeout(timer)
  saveTimers.delete(cardId)
  delete scheduledSaveIds[cardId]
}

async function persistCard(card: TimecardCardRecord) {
  const week = selectedWeek.value
  const weekStartDate = selectedWeekStartDate.value
  const canEdit = canEditWeek.value
  if (!week || !canEdit) return

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
        week.id,
        card.id,
        weekStartDate,
        card,
        burdenValue.value,
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

function scheduleCardSave(card: TimecardCardRecord) {
  if (!selectedWeek.value || !canEditWeek.value) return

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

function selectCard(cardId: string) {
  selectedCardId.value = cardId
}

function isCardCompact(cardId: string) {
  return compactCardStates[cardId] === true
}

function toggleCardCompact(cardId: string) {
  compactCardStates[cardId] = !compactCardStates[cardId]
}

function isCardEditable(cardId: string) {
  if (!canEditWeek.value) return false
  if (!auth.isAdmin) return true
  return adminCardEditStates[cardId] === true
}

function isCardReadOnly(cardId: string) {
  return !isCardEditable(cardId)
}

function toggleCardEditMode(cardId: string) {
  if (!canEditWeek.value || !auth.isAdmin) return
  adminCardEditStates[cardId] = !adminCardEditStates[cardId]
}

function setAllCardsCompact(compact: boolean) {
  cards.value.forEach((card) => {
    compactCardStates[card.id] = compact
  })
}

function scrollCardIntoView(cardId: string) {
  window.requestAnimationFrame(() => {
    document.getElementById(`timecard-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
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

function handleWorkbookChanged(card: TimecardCardRecord) {
  selectCard(card.id)
  scheduleCardSave(card)
}

async function handleAddEmployee(employee: EmployeeRecord) {
  if (!selectedWeek.value || !canEditWeek.value) return

  actionLoading.value = true
  resetMessages()
  try {
    const cardId = await createTimecardCard(
      selectedWeek.value.id,
      selectedWeekStartDate.value,
      makeEmployeeSeed(employee),
      getNextSortIndex(),
      linkedJobNumber.value,
    )
    compactCardStates[cardId] = false
    selectedCardId.value = cardId
    employeeSearchTerm.value = ''
    showCreateTray.value = false
    scrollCardIntoView(cardId)
  } catch (error) {
    setPageError(error, 'Failed to add the employee card.')
  } finally {
    actionLoading.value = false
  }
}

function validateCustomCardForm() {
  if (!customCardForm.firstName.trim()) return 'Enter the first name.'
  if (!customCardForm.lastName.trim()) return 'Enter the last name.'
  if (!customCardForm.employeeNumber.trim()) return 'Enter the employee number.'
  if (!customCardForm.occupation.trim()) return 'Enter the occupation.'
  if (!auth.isAdmin) return ''
  const wage = Number(customCardForm.wageRate.trim())
  if (!Number.isFinite(wage) || Number.isNaN(wage) || wage < 0) return 'Enter a wage amount.'
  return ''
}

async function handleAddCustomCard() {
  if (!selectedWeek.value || !canEditWeek.value) return

  resetMessages()
  const validationMessage = validateCustomCardForm()
  if (validationMessage) {
    pageError.value = validationMessage
    return
  }

  actionLoading.value = true
  try {
    const cardId = await createTimecardCard(
      selectedWeek.value.id,
      selectedWeekStartDate.value,
        {
          firstName: customCardForm.firstName,
          lastName: customCardForm.lastName,
          employeeNumber: customCardForm.employeeNumber,
          occupation: customCardForm.occupation,
          wageRate: auth.isAdmin ? Number(customCardForm.wageRate.trim()) : null,
          isContractor: customCardForm.isContractor,
        },
        getNextSortIndex(),
        linkedJobNumber.value,
    )
    compactCardStates[cardId] = false
    selectedCardId.value = cardId
    resetCustomCardForm()
    showCreateTray.value = false
    scrollCardIntoView(cardId)
  } catch (error) {
    setPageError(error, 'Failed to add the custom timecard.')
  } finally {
    actionLoading.value = false
  }
}

async function handleRemoveCard(card: TimecardCardRecord) {
  if (!selectedWeek.value || !canEditWeek.value) return

  const confirmed = window.confirm(`Remove ${buildCardDisplayName(card)} from this week?`)
  if (!confirmed) return

  actionLoading.value = true
  resetMessages()
  try {
    selectCard(card.id)
    await flushPendingSaves()
    await deleteTimecardCard(selectedWeek.value.id, card.id)
    setPageInfo('Removed the timecard.')
  } catch (error) {
    setPageError(error, 'Failed to remove the timecard.')
  } finally {
    actionLoading.value = false
  }
}

function sortCardsForMode(nextCards: TimecardCardRecord[], mode: WorkbookSortMode) {
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

async function handleSortCards() {
  if (!selectedWeek.value || !canEditWeek.value || cards.value.length < 2) return

  actionLoading.value = true
  resetMessages()
  try {
    await flushPendingSaves()
    const sortedCards = sortCardsForMode(cards.value, sortMode.value)
    await Promise.all(sortedCards.map((card, index) => {
      card.sortIndex = index
      return updateTimecardCard(
        selectedWeek.value!.id,
        card.id,
        selectedWeekStartDate.value,
        card,
        burdenValue.value,
      )
    }))
    setPageInfo(`Sorted cards by ${sortMode.value === 'name' ? 'name' : 'number'}.`)
  } catch (error) {
    setPageError(error, 'Failed to sort the cards.')
  } finally {
    actionLoading.value = false
  }
}

async function handleSubmitWeek() {
  if (!selectedWeek.value || !cards.value.length) return

  const confirmed = window.confirm(`Submit the week ending ${selectedWeekEndDate.value}?`)
  if (!confirmed) return

  actionLoading.value = true
  resetMessages()
  try {
    await flushPendingSaves()
    await submitTimecardWeek(selectedWeek.value.id, {
      userId: auth.currentUser?.uid ?? null,
      displayName: auth.displayName ?? null,
    })
    setPageInfo('Week submitted.')
  } catch (error) {
    setPageError(error, 'Failed to submit the timecard week.')
  } finally {
    actionLoading.value = false
  }
}

async function handleSelectWeek(weekEndDate: string) {
  if (selectedWeekEndDate.value === weekEndDate) return
  await flushPendingSaves()
  showCreateTray.value = false
  selectedWeekEndDate.value = weekEndDate
}

async function handleWeekEndingInput(event: Event) {
  const nextValue = snapToSaturday((event.target as HTMLInputElement).value || getTodayIsoDate())
  if (nextValue === selectedWeekEndDate.value) return
  await flushPendingSaves()
  showCreateTray.value = false
  selectedWeekEndDate.value = nextValue
}

function handleWeekEndingPickerOpen(event: Event) {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
  if (typeof input.showPicker !== 'function') return

  try {
    input.showPicker()
  } catch {
    // Ignore browsers that block programmatic picker opening.
  }
}

watch(
  () => selectedWeek.value?.id,
  () => {
    subscribeCardsForWeek()
  },
)

watch(
  () => selectedWeekEndDate.value,
  () => {
    resetCardWorkspaceState()
    cards.value = []
    subscribeCardsForWeek()
    void maybeEnsureSelectedWeek()
  },
)

watch(
  () => jobId.value,
  () => {
    resetMessages()
    resetCardWorkspaceState()
    weeks.value = []
    cards.value = []
    subscribeJob()
    subscribeWeeksForJob()
  },
)

watch(
  () => job.value?.id,
  () => {
    void maybeEnsureSelectedWeek()
  },
)

watch(
  () => burdenValue.value,
  () => {
    if (!selectedWeek.value) return
    subscribeCardsForWeek()
  },
)

watch(
  () => filteredCards.value.map((card) => card.id).join('|'),
  () => {
    if (!filteredCards.value.length) {
      selectedCardId.value = null
      return
    }

    if (!selectedCardId.value || !filteredCards.value.some((card) => card.id === selectedCardId.value)) {
      selectedCardId.value = filteredCards.value[0]?.id ?? null
    }
  },
)

onMounted(() => {
  subscribeJob()
  subscribeWeeksForJob()
  subscribeEmployeesForTimecards()
})

onBeforeUnmount(() => {
  saveTimers.forEach((timer) => clearTimeout(timer))
  cardShellObservers.forEach((observer) => observer.disconnect())
  cardContentObservers.forEach((observer) => observer.disconnect())
  stopWeeksSubscription()
  stopCardsSubscription()
  stopEmployeesSubscription()
  jobsStore.stopCurrentJobSubscription()
})
</script>

<template>
  <AppShell>
    <div class="timecards-page">
      <section class="timecards-workbook">
        <header class="timecards-toolbar">
          <div class="timecards-toolbar__tabs" role="tablist" aria-label="Timecard tools">
            <button
              v-for="tab in mobileToolbarTabs"
              :id="`timecards-toolbar-tab-${tab.key}`"
              :key="tab.key"
              class="timecards-toolbar__tab"
              :class="{ 'timecards-toolbar__tab--active': activeMobileToolbarTab === tab.key }"
              type="button"
              role="tab"
              :aria-selected="activeMobileToolbarTab === tab.key"
              :aria-controls="`timecards-toolbar-panel-${tab.key}`"
              @click="activeMobileToolbarTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <fieldset
            id="timecards-toolbar-panel-week"
            class="timecards-toolbar__group timecards-toolbar__group--details"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'week' }"
            role="tabpanel"
            :aria-labelledby="'timecards-toolbar-tab-week'"
          >
            <legend class="timecards-toolbar__legend">Week Filters</legend>
            <div class="timecards-toolbar__stack timecards-toolbar__stack--week-fields">
              <label class="timecards-toolbar__search">
                <span>Job Number</span>
                <div class="timecards-toolbar__display-field">
                  <span class="timecards-toolbar__display">{{ job?.code || 'No Job #' }}</span>
                </div>
              </label>
              <label class="timecards-toolbar__search">
                <span>Job Name</span>
                <div class="timecards-toolbar__display-field">
                  <span class="timecards-toolbar__display">{{ job?.name || 'Select a Job' }}</span>
                </div>
              </label>
              <label class="timecards-toolbar__search">
                <span>Week Ending</span>
                <input
                  :value="selectedWeekEndDate"
                  type="date"
                  @change="handleWeekEndingInput"
                  @click="handleWeekEndingPickerOpen"
                />
              </label>
            </div>
          </fieldset>

          <fieldset
            id="timecards-toolbar-panel-search"
            class="timecards-toolbar__group timecards-toolbar__group--search"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'search' }"
            role="tabpanel"
            :aria-labelledby="'timecards-toolbar-tab-search'"
          >
            <legend class="timecards-toolbar__legend">Card Filters</legend>
            <label class="timecards-toolbar__search">
              <span>Employee Search</span>
              <input v-model="cardSearchTerm" type="search" placeholder="Search all cards" />
            </label>
          </fieldset>

          <fieldset
            id="timecards-toolbar-panel-actions"
            class="timecards-toolbar__group timecards-toolbar__group--actions"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'actions' }"
            role="tabpanel"
            :aria-labelledby="'timecards-toolbar-tab-actions'"
          >
            <legend class="timecards-toolbar__legend">Workspace Actions</legend>
            <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
            <div class="timecards-toolbar__controls">
              <div class="timecards-toolbar__matrix">
                <button
                  class="timecards-button"
                  type="button"
                  :disabled="actionLoading || !canEditWeek"
                  @click="showCreateTray = !showCreateTray"
                >
                  {{ showCreateTray ? 'Close Create' : 'Create Card' }}
                </button>
                <button
                  class="timecards-button timecards-button--primary"
                  type="button"
                  :disabled="actionLoading || !selectedWeek || !cards.length || !canEditWeek"
                  @click="handleSubmitWeek"
                >
                  Submit Week
                </button>
                <button
                  class="timecards-button"
                  type="button"
                  :disabled="!cards.length"
                  @click="setAllCardsCompact(false)"
                >
                  Expand All
                </button>
                <button
                  class="timecards-button"
                  type="button"
                  :disabled="!cards.length"
                  @click="setAllCardsCompact(true)"
                >
                  Compact All
                </button>
              </div>
            </div>
          </fieldset>

          <fieldset
            id="timecards-toolbar-panel-sort"
            class="timecards-toolbar__group timecards-toolbar__group--sort"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'sort' }"
            role="tabpanel"
            :aria-labelledby="'timecards-toolbar-tab-sort'"
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
              <button
                class="timecards-button"
                type="button"
                :disabled="actionLoading || !canEditWeek || cards.length < 2"
                @click="handleSortCards"
              >
                Sort Cards
              </button>
            </div>
          </fieldset>

          <fieldset
            id="timecards-toolbar-panel-history"
            class="timecards-toolbar__group timecards-toolbar__group--history"
            :class="{ 'timecards-toolbar__group--mobile-active': activeMobileToolbarTab === 'history' }"
            role="tabpanel"
            :aria-labelledby="'timecards-toolbar-tab-history'"
          >
            <legend class="timecards-toolbar__legend">Saved Weeks</legend>
            <div class="timecards-toolbar__lead-spacer" aria-hidden="true"></div>
            <div class="timecards-toolbar__history">
              <button
                v-for="week in recentWeeks"
                :key="week.id"
                class="timecards-sidebar__history-row"
                :class="{ 'timecards-sidebar__history-row--active': week.weekEndDate === selectedWeekEndDate }"
                type="button"
                @click="handleSelectWeek(week.weekEndDate)"
              >
                <strong>{{ formatWorkbookDate(week.weekEndDate) }}</strong>
                <span>{{ week.status === 'submitted' ? 'Submitted' : 'Draft' }}</span>
              </button>

              <div v-if="!recentWeeks.length && !weeksLoading" class="timecards-sidebar__empty">
                No saved weeks yet.
              </div>
            </div>
          </fieldset>

          <fieldset class="timecards-toolbar__group timecards-toolbar__group--status-bar">
            <legend class="timecards-toolbar__legend">Status</legend>
            <div class="timecards-toolbar__status-strip">
              <span class="timecards-signal">{{ weekRangeLabel }}</span>
              <span
                class="timecards-signal"
                :class="{ 'timecards-signal--success': selectedWeek?.status === 'submitted' }"
              >
                {{ weekStatusLabel }}
              </span>
              <span class="timecards-signal">{{ cards.length }} Cards</span>
              <span class="timecards-signal" :class="{ 'timecards-signal--error': !!saveError }">
                {{ saveStateLabel }}
              </span>
            </div>
          </fieldset>
        </header>

        <section v-if="showCreateTray" class="timecards-create">
          <div class="timecards-create__panel timecards-create__panel--directory">
            <div class="timecards-create__header">
              <span class="timecards-create__eyebrow">Employee Directory</span>
              <h2>Create From Employee</h2>
            </div>

            <label class="timecards-toolbar__search timecards-create__search-field">
              <span>Employee Search</span>
              <input
                v-model="employeeSearchTerm"
                class="timecards-create__search"
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
                :disabled="actionLoading || !canEditWeek"
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
          </div>

          <div class="timecards-create__panel timecards-create__panel--custom">
            <div class="timecards-create__header">
              <span class="timecards-create__eyebrow">Custom Card</span>
              <h2>Create One-Off Card</h2>
            </div>

            <div class="timecards-create__grid">
              <label class="timecards-toolbar__search">
                <span>First Name</span>
                <input
                  v-model="customCardForm.firstName"
                  class="timecards-create__field"
                  type="text"
                  :disabled="actionLoading || !canEditWeek"
                />
              </label>
              <label class="timecards-toolbar__search">
                <span>Last Name</span>
                <input
                  v-model="customCardForm.lastName"
                  class="timecards-create__field"
                  type="text"
                  :disabled="actionLoading || !canEditWeek"
                />
              </label>
              <label class="timecards-toolbar__search">
                <span>Employee #</span>
                <input
                  v-model="customCardForm.employeeNumber"
                  class="timecards-create__field"
                  type="text"
                  :disabled="actionLoading || !canEditWeek"
                />
              </label>
              <label class="timecards-toolbar__search">
                <span>Occupation</span>
                <input
                  v-model="customCardForm.occupation"
                  class="timecards-create__field"
                  type="text"
                  :disabled="actionLoading || !canEditWeek"
                />
              </label>
              <label v-if="auth.isAdmin" class="timecards-toolbar__search">
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
              <div v-else class="timecards-create__restricted-note">
                Wage hidden for foremen
              </div>
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
              :disabled="actionLoading || !canEditWeek"
              @click="handleAddCustomCard"
            >
              Add Custom Card
            </button>
          </div>
        </section>

        <div v-if="pageError" class="timecards-message timecards-message--error">
          {{ pageError }}
        </div>

        <div v-else-if="pageInfo" class="timecards-message">
          {{ pageInfo }}
        </div>

        <div class="timecards-workspace">
          <section class="timecards-canvas-panel">
            <div class="timecards-canvas-panel__header">
              <span class="timecards-canvas-panel__eyebrow">Time Cards</span>
              <div class="timecards-canvas-panel__meta">
                <span>{{ formatWorkbookDate(selectedWeekEndDate) }}</span>
                <span>{{ filteredCards.length }} Visible</span>
              </div>
            </div>

            <div v-if="cardsLoading || ensuringWeek" class="timecards-empty timecards-empty--canvas">
              Loading workbook...
            </div>

            <div v-else-if="!filteredCards.length" class="timecards-empty timecards-empty--canvas">
              {{ emptyCanvasMessage }}
            </div>

            <div v-else class="timecards-canvas">
              <article
                v-for="card in filteredCards"
                :id="`timecard-card-${card.id}`"
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
                    v-if="auth.isAdmin && canEditWeek"
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
                      :week-end-date="selectedWeekEndDate"
                      :burden="burdenValue"
                      :read-only="isCardReadOnly(card.id)"
                      :employee-header-locked="card.sourceType !== 'custom' || isCardReadOnly(card.id)"
                      :show-employee-wage="auth.isAdmin"
                      @changed="handleWorkbookChanged(card)"
                    />
                  </div>
                </div>

                <div v-if="canEditWeek && !isCardCompact(card.id)" class="timecards-canvas__item-footer">
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
.timecards-create,
.timecards-sidebar__panel,
.timecards-canvas-panel,
.timecards-message {
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.timecards-toolbar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.75rem;
  padding: 0.95rem;
  align-items: start;
  min-width: 0;
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
  background: transparent;
}

.timecards-toolbar__legend {
  padding: 0;
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
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

.timecards-toolbar__display-field,
.timecards-toolbar__search input,
.timecards-create__search,
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

.timecards-toolbar__display-field {
  display: flex;
  align-items: center;
}

.timecards-toolbar__search input::placeholder,
.timecards-create__field::placeholder,
.timecards-create__search::placeholder {
  color: rgba(70, 77, 48, 0.72);
}

.timecards-toolbar__search input:focus,
.timecards-toolbar__search input:focus-visible,
.timecards-create__search:focus,
.timecards-create__search:focus-visible,
.timecards-create__field:focus,
.timecards-create__field:focus-visible {
  outline: none;
  border-color: var(--timecards-toolbar-control-border-strong);
  background-color: rgba(248, 250, 240, 0.98);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-toolbar__display {
  display: flex;
  align-items: center;
  min-height: calc(var(--timecards-toolbar-control-height) - 2px);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--timecards-toolbar-control-text);
  line-height: 1.3;
}

.timecards-toolbar__controls {
  display: grid;
  gap: 0.55rem;
}

.timecards-toolbar__stack {
  display: grid;
  gap: 0.55rem;
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

.timecards-toolbar__matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
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

.timecards-button--danger {
  border-color: rgba(167, 53, 53, 0.42);
  color: #922f2f;
  background: linear-gradient(180deg, #fffaf8 0%, #f0dfd8 100%);
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
  border-color: rgba(52, 112, 76, 0.36);
  color: #205832;
  background: rgba(220, 239, 208, 0.96);
}

.timecards-signal--error {
  border-color: rgba(167, 53, 53, 0.36);
  color: #8a2828;
  background: rgba(248, 224, 220, 0.96);
}

.timecards-create {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(20rem, 0.95fr);
  gap: 0.9rem;
  padding: 0.85rem;
}

.timecards-create__panel {
  display: grid;
  gap: 0.7rem;
  padding: 0.8rem;
  border: 1px solid rgba(71, 82, 41, 0.24);
  background: rgba(255, 255, 255, 0.32);
}

.timecards-create__header {
  display: grid;
  gap: 0.1rem;
}

.timecards-create__eyebrow {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.timecards-create__header h2 {
  margin: 0;
  font-size: 1rem;
}

.timecards-create__search-field {
  align-self: start;
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
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg);
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
  gap: 0.55rem;
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
}

.timecards-create__checkbox input {
  accent-color: #3d7a43;
}

.timecards-create__restricted-note {
  display: flex;
  align-items: center;
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.75rem;
  border: 1px dashed var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: rgba(244, 247, 234, 0.9);
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.9rem;
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

.timecards-canvas-panel__header h1 {
  margin: 0.12rem 0 0;
  font-size: 1.2rem;
}

.timecards-canvas-panel__eyebrow,
.timecards-sidebar__eyebrow {
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.timecards-canvas-panel__meta {
  display: inline-flex;
  flex-wrap: wrap;
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

.timecards-sidebar {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  align-items: start;
  min-width: 0;
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

.timecards-sidebar__header h2 {
  margin: 0;
  font-size: 1rem;
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

.timecards-sidebar__history {
  display: grid;
  gap: 0.55rem;
}

.timecards-sidebar__history-row {
  display: grid;
  gap: 0.18rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid rgba(71, 82, 41, 0.28);
  background: rgba(255, 255, 255, 0.84);
  color: #243018;
  text-align: left;
}

.timecards-sidebar__history-row--active {
  border-color: rgba(48, 121, 68, 0.56);
  background: rgba(224, 238, 212, 0.95);
}

.timecards-sidebar__history-row strong {
  color: #243018;
  font-size: 1rem;
}

.timecards-sidebar__history-row--active strong {
  color: #1b2b17;
}

.timecards-sidebar__history-row--active span {
  color: rgba(27, 43, 23, 0.82);
}

.timecards-sidebar__history-row span,
.timecards-sidebar__empty {
  color: rgba(38, 43, 23, 0.76);
  font-size: 0.84rem;
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

@media (min-width: 901px) {
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
      minmax(17rem, 1.04fr)
      minmax(15.5rem, 0.96fr)
      minmax(16rem, 1fr)
      minmax(16rem, 1.02fr);
    grid-template-areas:
      'details search sort actions history'
      'details search sort actions history'
      'status status status status status';
  }

  .timecards-toolbar__group--details {
    grid-area: details;
  }

  .timecards-toolbar__group--search {
    grid-area: search;
  }

  .timecards-toolbar__group--sort {
    grid-area: sort;
  }

  .timecards-toolbar__group--actions {
    grid-area: actions;
  }

  .timecards-toolbar__group--history {
    grid-area: history;
  }

  .timecards-toolbar__group--status-bar {
    grid-area: status;
  }
}

@media (max-width: 1450px) {
  .timecards-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
  }
}

@media (max-width: 1180px) {
  .timecards-toolbar {
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
  }

  .timecards-create {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .timecards-toolbar {
    grid-template-columns: 1fr;
    gap: 0.65rem;
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

  .timecards-create__employee {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  .timecards-toolbar__search {
    gap: 0.4rem;
  }

  .timecards-toolbar__matrix {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .timecards-toolbar__sort {
    flex-direction: column;
    align-items: stretch;
  }

  .timecards-toolbar__status-strip {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    gap: 0.45rem;
    overflow-x: auto;
    padding: 0 0.05rem 0.1rem;
    margin: 0 -0.05rem;
    scrollbar-width: none;
    -ms-overflow-style: none;
    overscroll-behavior-x: contain;
  }

  .timecards-toolbar__status-strip::-webkit-scrollbar {
    display: none;
  }

  .timecards-signal {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .timecards-toolbar__radio {
    width: 100%;
  }

  .timecards-canvas-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .timecards-canvas {
    grid-template-columns: 1fr;
  }

  .timecards-create__grid,
  .timecards-sidebar {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .timecards-toolbar__tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .timecards-toolbar__matrix {
    grid-template-columns: 1fr;
  }

  .timecards-toolbar__sort {
    flex-direction: column;
    align-items: stretch;
  }

  .timecards-toolbar__radio {
    width: 100%;
  }
}
</style>
