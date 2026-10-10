import { describe, expect, it } from 'vitest'
import { reportingStarter, reportingStarterDefinitions } from './reportingStarters'
import { withCompanyReportDelivery } from './companyReports'
import { validateFormAnswers, validateFormDefinition } from '../../../functions/src/formModel'
describe('requested company report delivery', () => {
  for (const kind of ['committee', 'bbs', 'general-visit'] as const) it(kind + ' preserves authentic questions and adds validated delivery controls', () => {
    const source = reportingStarterDefinitions[kind], draft = reportingStarter(kind), valid = validateFormDefinition(draft)
    expect(draft.fields.slice(0, -1)).toEqual(source.fields)
    expect(draft.access).toEqual(source.access)
    expect(draft.fields.at(-1)?.kind).toBe('recipients')
    expect(valid.output?.template).toBe('')
    expect(valid.recipients).toEqual([])
    expect(withCompanyReportDelivery(draft).fields).toEqual(draft.fields)
    expect(() => validateFormAnswers(valid, { 'report-recipients': ['bad-address'] }, false)).toThrow()
    const recipients = validateFormAnswers(valid, { 'report-recipients': ['staff@example.com', 'staff@example.com'] }, false)['report-recipients']
    expect(recipients).toEqual(['staff@example.com'])
  })
  it('leaves deferred Near Miss source unchanged', () => {
    expect(reportingStarter('near-miss').fields).toEqual(reportingStarterDefinitions['near-miss'].fields)
  })
})
