import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogPayloadPreparer } from '@/features/dailyLogs/useDailyLogPayloadPreparer'
import type { DailyLogSiteInfoDisplay } from '@/features/dailyLogs/viewHelpers'

function makeSiteInfo(overrides: Partial<DailyLogSiteInfoDisplay> = {}): DailyLogSiteInfoDisplay {
  return {
    address: '123 Test Way',
    foreman: 'CJ Blanchard',
    generalContractor: 'Phase 2',
    jobNumber: '736',
    projectManager: 'Denise Fuller',
    projectName: 'Shop',
    ...overrides,
  }
}

describe('useDailyLogPayloadPreparer', () => {
  it('prepares the current form payload with the latest site info', () => {
    const form = ref(createEmptyDailyLogPayload({
      projectName: 'stale project',
      qcAreasInspected: '  Level 2 ceilings  ',
      manpowerLines: [
        { trade: 'Carpenter', count: 3, areas: 'Level 2' },
        { trade: 'Painter', count: 0, areas: 'Skipped' },
      ],
    }))
    const siteInfo = ref(makeSiteInfo())
    const { clonePreparedPayload } = useDailyLogPayloadPreparer({ form, siteInfo })

    let prepared = clonePreparedPayload()

    expect(prepared).not.toBe(form.value)
    expect(prepared.projectName).toBe('Shop')
    expect(prepared.jobSiteNumbers).toBe('736')
    expect(prepared.foremanOnSite).toBe('CJ Blanchard')
    expect(prepared.siteForemanAssistant).toBe('Denise Fuller')
    expect(prepared.manpower).toBe('Carpenter: 3 (Level 2)')
    expect(prepared.qcInspection).toBe('Level 2 ceilings')
    expect(form.value.projectName).toBe('stale project')

    siteInfo.value = makeSiteInfo({ projectName: 'Lucky 3 Ranch', jobNumber: '5229' })
    prepared = clonePreparedPayload()

    expect(prepared.projectName).toBe('Lucky 3 Ranch')
    expect(prepared.jobSiteNumbers).toBe('5229')
  })

  it('prepares explicit payloads without mutating the current form or explicit source', () => {
    const form = ref(createEmptyDailyLogPayload({
      manpowerLines: [{ trade: 'Form Trade', count: 1, areas: '' }],
    }))
    const siteInfo = ref(makeSiteInfo())
    const explicitPayload = createEmptyDailyLogPayload({
      manpowerLines: [{ trade: 'Drywall', count: 2.6, areas: '' }],
      qcAreasInspected: 'North wing',
    })
    const { clonePreparedPayload } = useDailyLogPayloadPreparer({ form, siteInfo })

    const prepared = clonePreparedPayload(explicitPayload)

    expect(prepared).not.toBe(explicitPayload)
    expect(prepared.manpower).toBe('Drywall: 3')
    expect(prepared.qcInspection).toBe('North wing')
    expect(form.value.manpower).toBe('')
    expect(explicitPayload.manpower).toBe('')
  })
})
