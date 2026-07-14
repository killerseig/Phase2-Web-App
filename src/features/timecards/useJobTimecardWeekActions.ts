import { ensureTimecardWeek } from '@/services/timecards'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobTimecardWeekActionsOptions {
  cards: ReadonlyRef<TimecardCardRecord[]>
  closeCreateTray: () => void
  ensuringWeek: Ref<boolean>
  flushPendingSaves: () => Promise<void>
  getCurrentUserId: () => string | null
  getDisplayName: () => string | null
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  resetPageAndSaveMessages: () => void
  selectedWeek: ReadonlyRef<TimecardWeekRecord | null>
  selectedWeekEndDate: Ref<string>
  selectedWeekId: Ref<string | null>
  setPageError: (error: unknown, fallback: string) => void
  setPageInfo: (message: string) => void
  weeksLoading: ReadonlyRef<boolean>
}

export function useJobTimecardWeekActions({
  cards,
  closeCreateTray,
  ensuringWeek,
  flushPendingSaves,
  getCurrentUserId,
  getDisplayName,
  job,
  jobId,
  resetPageAndSaveMessages,
  selectedWeek,
  selectedWeekEndDate,
  selectedWeekId,
  setPageError,
  setPageInfo,
  weeksLoading,
}: UseJobTimecardWeekActionsOptions) {
  let ensureKeyInFlight = ''

  function getEnsureKey() {
    if (!jobId.value || !selectedWeekEndDate.value) return ''
    return `${jobId.value}|${selectedWeekEndDate.value}`
  }

  function buildEnsurePayload() {
    if (!jobId.value || !selectedWeekEndDate.value) return null

    return {
      jobId: jobId.value,
      jobCode: job.value?.code ?? null,
      jobName: job.value?.name ?? null,
      ownerForemanUserId: getCurrentUserId(),
      ownerForemanName: getDisplayName(),
      weekEndDate: selectedWeekEndDate.value,
    }
  }

  async function maybeBackfillSelectedDraftWeek() {
    if (!jobId.value) return
    if (!selectedWeekEndDate.value) return
    if (weeksLoading.value) return
    const currentWeek = selectedWeek.value
    if (!currentWeek) return
    if (
      currentWeek.status !== 'draft'
      || currentWeek.employeeCardCount > 0
      || cards.value.length > 0
    ) return

    const key = getEnsureKey()
    if (!key || ensuringWeek.value || ensureKeyInFlight === key) return

    ensuringWeek.value = true
    ensureKeyInFlight = key
    try {
      const payload = buildEnsurePayload()
      if (payload) await ensureTimecardWeek(payload)
    } catch (error) {
      setPageError(error, 'Failed to roll over the timecard week.')
    } finally {
      ensuringWeek.value = false
      ensureKeyInFlight = ''
    }
  }

  async function handleCreateWeek() {
    if (!jobId.value || !selectedWeekEndDate.value) {
      const message = 'Choose a week ending date before creating a week.'
      setPageError(message, message)
      return
    }

    if (selectedWeek.value) {
      selectedWeekId.value = selectedWeek.value.id
      return
    }

    const key = getEnsureKey()
    if (!key || ensuringWeek.value || ensureKeyInFlight === key) return

    await flushPendingSaves()
    closeCreateTray()
    ensuringWeek.value = true
    ensureKeyInFlight = key
    resetPageAndSaveMessages()
    try {
      const payload = buildEnsurePayload()
      if (!payload) return
      const weekId = await ensureTimecardWeek(payload)
      selectedWeekId.value = weekId
      setPageInfo('Timecard week opened.')
    } catch (error) {
      setPageError(error, 'Failed to open the timecard week.')
    } finally {
      ensuringWeek.value = false
      ensureKeyInFlight = ''
    }
  }

  return {
    handleCreateWeek,
    maybeBackfillSelectedDraftWeek,
  }
}
