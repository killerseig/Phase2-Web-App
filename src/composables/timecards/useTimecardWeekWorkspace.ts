import { computed, ref, watch, type ComputedRef } from 'vue'
import { ROLES } from '@/constants/app'
import { useAuthStore } from '@/stores/auth'
import { getForemanTimecardWorkspace } from '@/services/ForemanTimecards'
import { subscribeRosterEmployees } from '@/services/JobRoster'
import {
  ensureWeekTimecardsForActiveRoster,
  watchWorkspaceTimecardsByWeek,
} from '@/services/Timecards'
import { normalizeError } from '@/services/serviceUtils'
import type { JobRosterEmployee } from '@/types/models'
import type { TimecardWorkspaceEmployeeItem } from '@/types/timecards'
import type { TimecardModel } from '@/utils/timecardUtils'
import { matchesRosterEmployeeTimecard } from '@/utils/timecardWorkbook'

type SubscriptionRegistry = {
  replace: (key: string, unsubscribe: (() => void) | null | undefined) => void
  clear: (key: string) => void
  clearAll: () => void
}

type UseTimecardWeekWorkspaceOptions = {
  jobId: ComputedRef<string>
  weekEndingDate: ComputedRef<string>
  subscriptions: SubscriptionRegistry
  recalcTotals: (timecard: TimecardModel) => void
}

function buildWorkspaceSearchText(item: TimecardWorkspaceEmployeeItem): string {
  return [
    item.employeeName,
    item.employeeNumber,
    item.occupation,
    item.subcontractedEmployee ? 'subcontracted' : 'direct',
  ]
    .join(' ')
    .toLowerCase()
}

export function useTimecardWeekWorkspace(options: UseTimecardWeekWorkspaceOptions) {
  const { jobId, weekEndingDate, subscriptions, recalcTotals } = options
  const auth = useAuthStore()

  const loading = ref(true)
  const ensuring = ref(false)
  const error = ref('')
  const searchTerm = ref('')
  const selectedEmployeeId = ref<string | null>(null)
  const rosterEmployees = ref<JobRosterEmployee[]>([])
  const timecards = ref<TimecardModel[]>([])
  const rosterReady = ref(false)
  const timecardsReady = ref(false)
  const lastCoverageSweepKey = ref('')
  const useForemanWorkspace = computed(() => auth.role === ROLES.FOREMAN)

  const activeRosterEmployees = computed(() => rosterEmployees.value.filter((employee) => employee.active))
  const missingEmployeeIds = computed(() => (
    activeRosterEmployees.value
      .filter((employee) => !timecards.value.some((timecard) => matchesRosterEmployeeTimecard(employee, timecard)))
      .map((employee) => employee.id)
      .sort()
  ))
  const missingCoverageKey = computed(() => (
    `${jobId.value}|${weekEndingDate.value}|${missingEmployeeIds.value.join(',')}`
  ))

  const employeeItems = computed<TimecardWorkspaceEmployeeItem[]>(() => (
    activeRosterEmployees.value.map((employee) => {
      const matchedTimecard = timecards.value.find((timecard) => matchesRosterEmployeeTimecard(employee, timecard))
      return {
        employeeId: employee.id,
        timecardId: matchedTimecard?.id ?? null,
        employeeName: `${employee.firstName} ${employee.lastName}`.trim() || 'Unnamed Employee',
        employeeNumber: employee.employeeNumber,
        occupation: employee.occupation,
        subcontractedEmployee: !!employee.contractor,
        status: matchedTimecard?.status ?? 'missing',
        hoursTotal: matchedTimecard?.totals?.hoursTotal ?? 0,
        productionTotal: matchedTimecard?.totals?.productionTotal ?? 0,
      }
    })
  ))

  const filteredEmployeeItems = computed(() => {
    const term = searchTerm.value.trim().toLowerCase()
    if (!term) return employeeItems.value
    return employeeItems.value.filter((item) => buildWorkspaceSearchText(item).includes(term))
  })

  const selectedEmployeeItem = computed(() => (
    filteredEmployeeItems.value.find((item) => item.employeeId === selectedEmployeeId.value)
    ?? employeeItems.value.find((item) => item.employeeId === selectedEmployeeId.value)
    ?? null
  ))

  const selectedTimecard = computed<TimecardModel | null>(() => {
    const selectedTimecardId = selectedEmployeeItem.value?.timecardId
    if (!selectedTimecardId) return null
    return timecards.value.find((timecard) => timecard.id === selectedTimecardId) ?? null
  })

  const draftCount = computed(() => employeeItems.value.filter((item) => item.status === 'draft').length)
  const submittedCount = computed(() => employeeItems.value.filter((item) => item.status === 'submitted').length)
  const readOnly = computed(() => selectedTimecard.value?.status === 'submitted')

  watch(
    filteredEmployeeItems,
    (items) => {
      if (!items.length) {
        selectedEmployeeId.value = null
        return
      }

      if (selectedEmployeeId.value && items.some((item) => item.employeeId === selectedEmployeeId.value)) {
        return
      }

      selectedEmployeeId.value = items[0]?.employeeId ?? null
    },
    { immediate: true, flush: 'sync' },
  )

  function syncLoadingState() {
    loading.value = ensuring.value || !rosterReady.value || !timecardsReady.value
  }

  function setError(err: unknown, fallback: string) {
    error.value = normalizeError(err, fallback)
  }

  function selectEmployee(employeeId: string | null) {
    selectedEmployeeId.value = employeeId
  }

  function clearWorkspaceState() {
    rosterEmployees.value = []
    timecards.value = []
    rosterReady.value = false
    timecardsReady.value = false
    lastCoverageSweepKey.value = ''
    selectedEmployeeId.value = null
    searchTerm.value = ''
    error.value = ''
    loading.value = true
    ensuring.value = false
  }

  async function loadForemanWorkspace() {
    try {
      const workspace = await getForemanTimecardWorkspace(jobId.value, weekEndingDate.value)
      rosterEmployees.value = workspace.rosterEmployees
      timecards.value = workspace.timecards
      rosterReady.value = true
      timecardsReady.value = true
      syncLoadingState()
    } catch (err) {
      setError(err, 'Failed to load timecard workspace')
      rosterReady.value = true
      timecardsReady.value = true
      syncLoadingState()
    }
  }

  async function ensureCoverage() {
    if (!jobId.value || !weekEndingDate.value) return
    lastCoverageSweepKey.value = missingCoverageKey.value
    ensuring.value = true
    syncLoadingState()
    try {
      await ensureWeekTimecardsForActiveRoster(jobId.value, weekEndingDate.value)
    } catch (err) {
      setError(err, 'Failed to prepare weekly timecards')
    } finally {
      ensuring.value = false
      syncLoadingState()
    }
  }

  async function init() {
    if (!jobId.value || !weekEndingDate.value) {
      clearWorkspaceState()
      return
    }

    error.value = ''
    rosterReady.value = false
    timecardsReady.value = false
    ensuring.value = false
    syncLoadingState()

    subscriptions.replace('timecard-week-workspace-roster', null)
    subscriptions.replace('timecard-week-workspace-cards', null)

    if (useForemanWorkspace.value) {
      await loadForemanWorkspace()
      return
    }

    subscriptions.replace(
      'timecard-week-workspace-roster',
      subscribeRosterEmployees(
        jobId.value,
        (employees) => {
          rosterEmployees.value = employees
          rosterReady.value = true
          syncLoadingState()
        },
        (err) => {
          setError(err, 'Failed to subscribe to roster')
          rosterReady.value = true
          syncLoadingState()
        },
      ),
    )

    subscriptions.replace(
      'timecard-week-workspace-cards',
      watchWorkspaceTimecardsByWeek(
        jobId.value,
        weekEndingDate.value,
        (snapshotTimecards) => {
          timecards.value = (snapshotTimecards as TimecardModel[]).map((timecard) => {
            recalcTotals(timecard)
            return timecard
          })
          timecardsReady.value = true
          syncLoadingState()
        },
        (err) => {
          setError(err, 'Failed to subscribe to weekly timecards')
          timecardsReady.value = true
          syncLoadingState()
        },
      ),
    )

    await ensureCoverage()
  }

  watch(
    () => ({
      ready: rosterReady.value && timecardsReady.value,
      ensuring: ensuring.value,
      missingKey: missingCoverageKey.value,
      missingCount: missingEmployeeIds.value.length,
      useForemanWorkspace: useForemanWorkspace.value,
    }),
    ({ ready, ensuring: isEnsuring, missingKey, missingCount, useForemanWorkspace: isForemanWorkspace }) => {
      if (isForemanWorkspace || !ready || isEnsuring || missingCount === 0) return
      if (missingKey === lastCoverageSweepKey.value) return
      void ensureCoverage()
    },
    { flush: 'post' },
  )

  async function refreshWorkspace() {
    await init()
  }

  function upsertTimecard(nextTimecard: TimecardModel) {
    const existingIndex = timecards.value.findIndex((timecard) => timecard.id === nextTimecard.id)
    if (existingIndex === -1) {
      timecards.value = [...timecards.value, nextTimecard]
      return
    }

    timecards.value = timecards.value.map((timecard) => (
      timecard.id === nextTimecard.id ? nextTimecard : timecard
    ))
  }

  return {
    draftCount,
    employeeItems,
    error,
    filteredEmployeeItems,
    init,
    loading,
    readOnly,
    refreshWorkspace,
    rosterEmployees,
    searchTerm,
    selectEmployee,
    selectedEmployeeId,
    selectedEmployeeItem,
    selectedTimecard,
    submittedCount,
    timecards,
    upsertTimecard,
  }
}
