import { describe, expect, it } from 'vitest'
import { buildEmployeeCard, recalculateCardTotals } from './workbook'
import {
  mergePersonalTimecard,
  parsePersonalTimecard,
  personalCardId,
  personalSaveHash,
} from '../../../functions/src/personalTimecardModel'
import type { TimecardCardRecord } from '@/types/domain'
const make = () => ({
  id: 'own',
  ...buildEmployeeCard(
    {
      employeeId: 'employee',
      firstName: 'Synthetic',
      lastName: 'Employee',
      employeeNumber: 'T1',
      occupation: 'Painter',
      wageRate: 25,
      isContractor: false,
    },
    '2026-11-07',
    0,
  ),
})
function input(card: TimecardCardRecord) {
  return {
    lines: card.lines.map((line) => ({
      jobNumber: line.jobNumber,
      subsectionArea: line.subsectionArea,
      account: line.account,
      hours: line.days.map((day) => day.hours),
    })),
    notes: card.notes,
  }
}
describe('personal timecard boundary', () => {
  it('accepts split jobs while preserving the payroll-owned fields', () => {
    const card = make()
    card.footerAmount = '99'
    card.regularHoursOverride = 32
    card.lines[0]!.days[1]!.production = 8
    const draft = input(card)
    draft.lines[0]!.jobNumber = '100'
    draft.lines[0]!.account = 'PAINT'
    draft.lines[0]!.hours[1] = 4
    draft.lines[1]!.jobNumber = '200'
    draft.lines[1]!.account = 'PAINT'
    draft.lines[1]!.hours[1] = 4
    const result = mergePersonalTimecard(card, parsePersonalTimecard(draft))
    expect(result.totals.hoursTotal).toBe(8)
    expect(result.employeeId).toBe('employee')
    expect(result.wageRate).toBe(25)
    expect(result.footerAmount).toBe('99')
    expect(result.regularHoursOverride).toBe(32)
    expect(card.totals.hoursTotal).toBe(0)
  })
  it.each([0.33, 0.294, 0, 0.4])(
    'matches existing workbook calculations at burden %s',
    (burden) => {
      const card = make()
      card.lines[2]!.days[6]!.production = 3
      card.lines[0]!.days[1]!.production = 8
      recalculateCardTotals(card, '2026-11-01', burden)
      const draft = input(card)
      draft.lines[2]!.jobNumber = '100'
      draft.lines[2]!.account = 'PAINT'
      draft.lines[2]!.hours[6] = 5
      draft.lines[0]!.jobNumber = '100'
      draft.lines[0]!.account = 'PAINT'
      draft.lines[0]!.hours[1] = 4
      const expected = structuredClone(card)
      expected.lines[2]!.days[6]!.hours = 5
      expected.lines[0]!.days[1]!.hours = 4
      recalculateCardTotals(expected, '2026-11-01', burden)
      expect(mergePersonalTimecard(card, parsePersonalTimecard(draft), burden).totals).toEqual(
        expected.totals,
      )
    },
  )
  it('retains manual cost overrides', () => {
    const card = make()
    card.lines[0]!.days[1]!.production = 3
    card.lines[0]!.days[1]!.unitCostOverride = 7
    const draft = input(card)
    draft.lines[0]!.jobNumber = '100'
    draft.lines[0]!.account = 'PAINT'
    draft.lines[0]!.hours[1] = 4
    expect(
      mergePersonalTimecard(card, parsePersonalTimecard(draft)).lines[0].days[1].lineTotal,
    ).toBe(21)
  })
  it.each([NaN, Infinity, -1, 25])('rejects invalid daily hours %s', (hours) => {
    const draft = input(make())
    draft.lines[0]!.hours[1] = hours
    expect(() => parsePersonalTimecard(draft)).toThrow()
  })
  it('rejects cross-job daily totals over 24 hours', () => {
    const draft = input(make())
    for (const line of draft.lines.slice(0, 2)) {
      line.jobNumber = '100'
      line.account = 'PAINT'
      line.hours[1] = 13
    }
    expect(() => parsePersonalTimecard(draft)).toThrow('24')
  })
  it('requires job and account for entered time', () => {
    const draft = input(make())
    draft.lines[0]!.hours[1] = 1
    expect(() => parsePersonalTimecard(draft)).toThrow('job number and account')
  })
  it('uses stable card ids and distinguishes retry payloads', () => {
    const draft = input(make())
    expect(personalCardId('employee')).toBe(personalCardId('employee'))
    expect(personalCardId('employee')).not.toBe(personalCardId('other'))
    expect(personalSaveHash(draft)).not.toBe(personalSaveHash({ ...draft, notes: 'Edited' }))
  })
})
