import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogSelectionState } from '@/features/dailyLogs/useDailyLogSelectionState'
import {
  canCreateDailyLogForDate,
  canDeleteDailyLogDraft,
  canEditDailyLog,
  getNextDailyLogSelectionId,
  getPreferredDailyLog,
  getVisibleDailyLogs,
} from '@/features/dailyLogs/viewHelpers'
import type { DailyLogPayload, DailyLogRecord, JobRecord } from '@/types/domain'

function makePayload(overrides: Partial<DailyLogPayload> = {}): DailyLogPayload {
  return createEmptyDailyLogPayload({
    projectName: 'Payload Project',
    jobSiteNumbers: 'PAYLOAD-1',
    foremanOnSite: 'Payload Foreman',
    siteForemanAssistant: 'Payload PM',
    ...overrides,
  })
}

function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'log-1',
    jobId: 'job-1',
    jobCode: '5229',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-06-17',
    sequenceNumber: 1,
    status: 'draft',
    foremanUserId: 'user-1',
    foremanName: 'Vince Hintz',
    additionalRecipients: [],
    payload: makePayload(),
    ...overrides,
  }
}

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    name: 'Lucky 3 Ranch',
    code: '5229',
    gc: 'Haselden Construction',
    type: 'general',
    projectManager: 'Chris Renn',
    foreman: 'Vince Hintz',
    jobAddress: '123 Ranch Road',
    active: true,
    assignedForemanIds: ['user-1'],
    ...overrides,
  }
}

describe('daily log visibility and selection helpers', () => {
  it('shows submitted logs and the current foreman draft, but hides other foremen drafts', () => {
    const logs = [
      makeLog({ id: 'own-draft', status: 'draft', foremanUserId: 'user-1' }),
      makeLog({ id: 'other-draft', status: 'draft', foremanUserId: 'user-2' }),
      makeLog({ id: 'other-submitted', status: 'submitted', foremanUserId: 'user-2' }),
    ]

    expect(getVisibleDailyLogs(logs, { currentUserId: 'user-1', canViewAllDailyLogs: false }).map((log) => log.id))
      .toEqual(['own-draft', 'other-submitted'])
    expect(getVisibleDailyLogs(logs, { currentUserId: 'admin-1', canViewAllDailyLogs: true }).map((log) => log.id))
      .toEqual(['own-draft', 'other-draft', 'other-submitted'])
  })

  it('prefers the current foreman draft, then their submitted log, then the first visible log', () => {
    const otherSubmitted = makeLog({ id: 'other-submitted', status: 'submitted', foremanUserId: 'user-2' })
    const ownSubmitted = makeLog({ id: 'own-submitted', status: 'submitted', foremanUserId: 'user-1' })
    const ownDraft = makeLog({ id: 'own-draft', status: 'draft', foremanUserId: 'user-1' })

    expect(getPreferredDailyLog([otherSubmitted, ownSubmitted, ownDraft], 'user-1')?.id).toBe('own-draft')
    expect(getPreferredDailyLog([otherSubmitted, ownSubmitted], 'user-1')?.id).toBe('own-submitted')
    expect(getPreferredDailyLog([otherSubmitted], 'user-1')?.id).toBe('other-submitted')
  })

  it('resolves the next selection by preserving visible logs before falling back to submitted-first access rules', () => {
    const otherSubmitted = makeLog({ id: 'other-submitted', status: 'submitted', foremanUserId: 'user-2' })
    const ownSubmitted = makeLog({ id: 'own-submitted', status: 'submitted', foremanUserId: 'user-1' })
    const ownDraft = makeLog({ id: 'own-draft', status: 'draft', foremanUserId: 'user-1' })
    const hiddenDraft = makeLog({ id: 'hidden-draft', status: 'draft', foremanUserId: 'user-2' })

    expect(getNextDailyLogSelectionId(
      [otherSubmitted, ownDraft, hiddenDraft],
      {
        canViewAllDailyLogs: false,
        currentSelectedLogId: 'other-submitted',
        currentUserId: 'user-1',
      },
    )).toBe('other-submitted')

    expect(getNextDailyLogSelectionId(
      [otherSubmitted, ownDraft, hiddenDraft],
      {
        canViewAllDailyLogs: false,
        currentSelectedLogId: 'hidden-draft',
        currentUserId: 'user-1',
      },
    )).toBe('own-draft')

    expect(getNextDailyLogSelectionId(
      [hiddenDraft],
      {
        canViewAllDailyLogs: true,
        currentSelectedLogId: 'hidden-draft',
        currentUserId: 'user-1',
      },
    )).toBe('hidden-draft')

    expect(getNextDailyLogSelectionId(
      [otherSubmitted, ownSubmitted],
      {
        canViewAllDailyLogs: false,
        currentSelectedLogId: 'missing-log',
        currentUserId: 'user-1',
      },
    )).toBe('own-submitted')

    expect(getNextDailyLogSelectionId(
      [],
      {
        canViewAllDailyLogs: false,
        currentSelectedLogId: 'missing-log',
        currentUserId: 'user-1',
      },
    )).toBeNull()
  })

  it('allows editing the current user draft for today or earlier and allows another log when only submitted logs exist', () => {
    const ownDraftToday = makeLog({ status: 'draft', logDate: '2026-06-17', foremanUserId: 'user-1' })
    const ownDraftPast = makeLog({ status: 'draft', logDate: '2026-06-16', foremanUserId: 'user-1' })
    const ownDraftFuture = makeLog({ status: 'draft', logDate: '2026-06-18', foremanUserId: 'user-1' })
    const ownSubmittedToday = makeLog({ status: 'submitted', logDate: '2026-06-17', foremanUserId: 'user-1' })

    expect(canEditDailyLog(ownDraftToday, { currentUserId: 'user-1', todayDate: '2026-06-17' })).toBe(true)
    expect(canEditDailyLog(ownDraftPast, { currentUserId: 'user-1', todayDate: '2026-06-17' })).toBe(true)
    expect(canEditDailyLog(ownDraftFuture, { currentUserId: 'user-1', todayDate: '2026-06-17' })).toBe(false)
    expect(canEditDailyLog(ownSubmittedToday, { currentUserId: 'user-1', todayDate: '2026-06-17' })).toBe(false)
    expect(canEditDailyLog(ownDraftToday, { currentUserId: 'user-2', todayDate: '2026-06-17' })).toBe(false)

    expect(canCreateDailyLogForDate({
      selectedDate: '2026-06-17',
      todayDate: '2026-06-17',
      currentUserId: 'user-1',
      visibleLogs: [ownSubmittedToday],
    })).toBe(true)
    expect(canCreateDailyLogForDate({
      selectedDate: '2026-06-17',
      todayDate: '2026-06-17',
      currentUserId: 'user-1',
      visibleLogs: [ownDraftToday],
    })).toBe(false)
    expect(canCreateDailyLogForDate({
      selectedDate: '2026-06-16',
      todayDate: '2026-06-17',
      currentUserId: 'user-1',
      visibleLogs: [makeLog({ status: 'submitted', logDate: '2026-06-16', foremanUserId: 'user-1' })],
    })).toBe(true)
    expect(canCreateDailyLogForDate({
      selectedDate: '2026-06-18',
      todayDate: '2026-06-17',
      currentUserId: 'user-1',
      visibleLogs: [],
    })).toBe(false)
  })

  it('allows admins to delete stale drafts without making those drafts editable', () => {
    const ownPastDraft = makeLog({ id: 'own-past-draft', status: 'draft', logDate: '2026-06-16', foremanUserId: 'user-1' })
    const otherPastDraft = makeLog({ id: 'other-past-draft', status: 'draft', logDate: '2026-06-16', foremanUserId: 'user-2' })
    const submittedLog = makeLog({ id: 'submitted-log', status: 'submitted', logDate: '2026-06-16', foremanUserId: 'user-2' })

    expect(canDeleteDailyLogDraft(ownPastDraft, {
      currentUserId: 'user-1',
      todayDate: '2026-06-17',
      canViewAllDailyLogs: false,
    })).toBe(true)
    expect(canDeleteDailyLogDraft(otherPastDraft, {
      currentUserId: 'user-1',
      todayDate: '2026-06-17',
      canViewAllDailyLogs: false,
    })).toBe(false)
    expect(canDeleteDailyLogDraft(otherPastDraft, {
      currentUserId: 'admin-1',
      todayDate: '2026-06-17',
      canViewAllDailyLogs: true,
    })).toBe(true)
    expect(canDeleteDailyLogDraft(submittedLog, {
      currentUserId: 'admin-1',
      todayDate: '2026-06-17',
      canViewAllDailyLogs: true,
    })).toBe(false)
  })
})

describe('useDailyLogSelectionState', () => {
  it('derives visible logs, edit/create state, labels, title, and job-backed site info', () => {
    const currentUserId = ref<string | null>('user-1')
    const form = ref(makePayload())
    const job = ref<JobRecord | null>(makeJob())
    const logs = ref<DailyLogRecord[]>([
      makeLog({ id: 'submitted-log', status: 'submitted', foremanUserId: 'user-2', foremanName: 'CJ Blanchard' }),
      makeLog({ id: 'own-draft', status: 'draft', foremanUserId: 'user-1', foremanName: 'Vince Hintz' }),
      makeLog({ id: 'hidden-draft', status: 'draft', foremanUserId: 'user-3' }),
    ])
    const selectedDate = ref('2026-06-17')
    const selectedLogId = ref<string | null>('own-draft')

    const state = useDailyLogSelectionState({
      currentUserId,
      form: computed(() => form.value),
      getAuthDisplayName: () => 'Auth User',
      getCanViewAllDailyLogs: () => false,
      getTodayDateString: () => '2026-06-17',
      job: computed(() => job.value),
      logs: computed(() => logs.value),
      selectedDate: computed(() => selectedDate.value),
      selectedLogId: computed(() => selectedLogId.value),
    })

    expect(state.visibleLogs.value.map((log) => log.id)).toEqual(['submitted-log', 'own-draft'])
    expect(state.selectedLog.value?.id).toBe('own-draft')
    expect(state.canEditSelectedLog.value).toBe(true)
    expect(state.canDeleteSelectedLog.value).toBe(true)
    expect(state.canCreateDailyLogForToday.value).toBe(false)
    expect(state.hasSubmittedLogForToday.value).toBe(true)
    expect(state.createDailyLogButtonLabel.value).toBe('Another Daily Log')
    expect(state.dailyLogsTitle.value).toBe('5229 - Lucky 3 Ranch')
    expect(state.siteInfo.value).toEqual({
      projectName: 'Lucky 3 Ranch',
      jobNumber: '5229',
      projectManager: 'Chris Renn',
      foreman: 'Vince Hintz',
      generalContractor: 'Haselden Construction',
      address: '123 Ranch Road',
    })

    selectedLogId.value = 'submitted-log'

    expect(state.selectedLog.value?.id).toBe('submitted-log')
    expect(state.canEditSelectedLog.value).toBe(false)
    expect(state.canDeleteSelectedLog.value).toBe(false)
    expect(state.siteInfo.value.foreman).toBe('CJ Blanchard')
  })

  it('falls back to form/auth values when no job or selected log owns site info', () => {
    const state = useDailyLogSelectionState({
      currentUserId: computed(() => 'user-1'),
      form: computed(() => makePayload({
        projectName: 'Manual Project',
        jobSiteNumbers: 'MANUAL-9',
        foremanOnSite: 'Manual Foreman',
        siteForemanAssistant: 'Manual PM',
      })),
      getAuthDisplayName: () => 'Auth Foreman',
      getCanViewAllDailyLogs: () => false,
      getTodayDateString: () => '2026-06-17',
      job: computed(() => null),
      logs: computed(() => []),
      selectedDate: computed(() => '2026-06-17'),
      selectedLogId: computed(() => null),
    })

    expect(state.dailyLogsTitle.value).toBe('Daily Logs')
    expect(state.selectedDateIsToday.value).toBe(true)
    expect(state.selectedDateIsFuture.value).toBe(false)
    expect(state.canCreateDailyLogForToday.value).toBe(true)
    expect(state.siteInfo.value).toEqual({
      projectName: 'Manual Project',
      jobNumber: 'MANUAL-9',
      projectManager: 'Manual PM',
      foreman: 'Auth Foreman',
      generalContractor: '',
      address: '',
    })
  })
})
