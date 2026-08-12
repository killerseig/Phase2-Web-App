import { describe, expect, it } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import {
  canCreateDailyLogForDate,
  canEditDailyLog,
  createDailyLogPayloadPreparer,
  hasSubmittedDailyLogForDate,
  type DailyLogSiteInfoDisplay,
} from '@/features/dailyLogs/viewHelpers'
import type { DailyLogRecord } from '@/types/domain'

const siteInfo: DailyLogSiteInfoDisplay = {
  projectName: 'Phase 2 Office',
  jobNumber: '111A1',
  projectManager: 'Denise Fuller',
  foreman: 'CJ Blanchard',
  generalContractor: 'Phase 2',
  address: '123 Test Way',
}

describe('daily log view helpers', () => {
  function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
    return {
      id: 'daily-log-1',
      jobId: 'job-1',
      jobCode: '111A1',
      jobName: 'Phase 2 Office',
      logDate: '2026-07-15',
      sequenceNumber: 1,
      status: 'draft',
      foremanUserId: 'user-1',
      foremanName: 'CJ Blanchard',
      additionalRecipients: [],
      payload: createEmptyDailyLogPayload(),
      ...overrides,
    }
  }

  it('allows editable owner drafts for today or earlier dates only', () => {
    expect(canEditDailyLog(makeLog({ logDate: '2026-07-15' }), {
      currentUserId: 'user-1',
      todayDate: '2026-07-15',
    })).toBe(true)
    expect(canEditDailyLog(makeLog({ logDate: '2026-07-14' }), {
      currentUserId: 'user-1',
      todayDate: '2026-07-15',
    })).toBe(true)
    expect(canEditDailyLog(makeLog({ logDate: '2026-07-16' }), {
      currentUserId: 'user-1',
      todayDate: '2026-07-15',
    })).toBe(false)
    expect(canEditDailyLog(makeLog({ foremanUserId: 'other-user' }), {
      currentUserId: 'user-1',
      todayDate: '2026-07-15',
    })).toBe(false)
  })

  it('allows additional daily log drafts for selected past or current dates when no owned draft exists', () => {
    expect(canCreateDailyLogForDate({
      currentUserId: 'user-1',
      selectedDate: '2026-07-14',
      todayDate: '2026-07-15',
      visibleLogs: [makeLog({ logDate: '2026-07-14', status: 'submitted' })],
    })).toBe(true)
    expect(canCreateDailyLogForDate({
      currentUserId: 'user-1',
      selectedDate: '2026-07-15',
      todayDate: '2026-07-15',
      visibleLogs: [],
    })).toBe(true)
    expect(canCreateDailyLogForDate({
      currentUserId: 'user-1',
      selectedDate: '2026-07-16',
      todayDate: '2026-07-15',
      visibleLogs: [],
    })).toBe(false)
    expect(canCreateDailyLogForDate({
      currentUserId: 'user-1',
      selectedDate: '2026-07-14',
      todayDate: '2026-07-15',
      visibleLogs: [makeLog({ logDate: '2026-07-14', status: 'draft' })],
    })).toBe(false)
  })

  it('detects submitted daily logs for the selected date', () => {
    expect(hasSubmittedDailyLogForDate([
      makeLog({ logDate: '2026-07-14', status: 'submitted' }),
    ], '2026-07-14')).toBe(true)
    expect(hasSubmittedDailyLogForDate([
      makeLog({ logDate: '2026-07-14', status: 'submitted' }),
    ], '2026-07-15')).toBe(false)
  })

  it('creates a payload preparer that uses the current form and site info by default', () => {
    const formPayload = createEmptyDailyLogPayload({
      projectName: 'stale project',
      jobSiteNumbers: 'old job',
      foremanOnSite: 'old foreman',
      siteForemanAssistant: 'old manager',
      qcAreasInspected: '  Level 2 ceilings  ',
      manpowerLines: [
        { trade: 'Carpenter', count: 3, areas: 'Level 2' },
        { trade: 'Painter', count: 0, areas: 'Skipped' },
        { trade: '  ', count: 4, areas: 'Skipped' },
        { trade: '  ', count: 0, areas: '  ' },
      ],
      indoorClimateReadings: [
        { area: 'Level 1', high: '72', low: '68', humidity: '30' },
        { area: '', high: '', low: '', humidity: '' },
      ],
    })

    const preparePayload = createDailyLogPayloadPreparer({
      getPayload: () => formPayload,
      getSiteInfo: () => siteInfo,
    })

    const prepared = preparePayload()

    expect(prepared).not.toBe(formPayload)
    expect(prepared.projectName).toBe('Phase 2 Office')
    expect(prepared.jobSiteNumbers).toBe('111A1')
    expect(prepared.foremanOnSite).toBe('CJ Blanchard')
    expect(prepared.siteForemanAssistant).toBe('Denise Fuller')
    expect(prepared.manpower).toBe('Carpenter: 3 (Level 2)')
    expect(prepared.manpowerLines).toEqual([
      { trade: 'Carpenter', count: 3, areas: 'Level 2' },
      { trade: 'Painter', count: 0, areas: 'Skipped' },
      { trade: '  ', count: 4, areas: 'Skipped' },
    ])
    expect(prepared.indoorClimateReadings).toEqual([
      { area: 'Level 1', high: '72', low: '68', humidity: '30' },
    ])
    expect(prepared.qcInspection).toBe('Level 2 ceilings')
    expect(formPayload.projectName).toBe('stale project')
  })

  it('allows callers to prepare an explicit payload without mutating the current form', () => {
    const formPayload = createEmptyDailyLogPayload({
      projectName: 'current form',
      manpowerLines: [{ trade: 'Form Trade', count: 1, areas: '' }],
    })
    const explicitPayload = createEmptyDailyLogPayload({
      projectName: 'explicit payload',
      qcAreasInspected: 'North wing',
      manpowerLines: [{ trade: 'Drywall', count: 2.6, areas: '' }],
    })

    const preparePayload = createDailyLogPayloadPreparer({
      getPayload: () => formPayload,
      getSiteInfo: () => siteInfo,
    })

    const prepared = preparePayload(explicitPayload)

    expect(prepared).not.toBe(explicitPayload)
    expect(prepared.manpower).toBe('Drywall: 3')
    expect(prepared.qcInspection).toBe('North wing')
    expect(formPayload.manpower).toBe('')
    expect(explicitPayload.manpower).toBe('')
  })
})
