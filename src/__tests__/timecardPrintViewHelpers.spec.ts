import { describe, expect, it } from 'vitest'

import {
  formatTimecardPrintGeneratedAt,
  getTimecardPrintExportId,
  getTimecardPrintPages,
  missingTimecardPrintPayloadMessage,
} from '@/features/timecards/printViewHelpers'

describe('timecard print view helpers', () => {
  it('reads the export id from scalar or repeated route query values', () => {
    expect(getTimecardPrintExportId({ exportId: 'export-a' })).toBe('export-a')
    expect(getTimecardPrintExportId({ exportId: ['export-a', 'export-b'] })).toBe('export-a')
    expect(getTimecardPrintExportId({ exportId: '' })).toBeUndefined()
    expect(getTimecardPrintExportId({})).toBeUndefined()
  })

  it('chunks printable cards into two-card pages by default', () => {
    const cards = [
      { id: 'card-1' },
      { id: 'card-2' },
      { id: 'card-3' },
      { id: 'card-4' },
      { id: 'card-5' },
    ]

    expect(getTimecardPrintPages(cards).map((page) => page.map((card) => card.id))).toEqual([
      ['card-1', 'card-2'],
      ['card-3', 'card-4'],
      ['card-5'],
    ])
  })

  it('supports custom page sizes and guards invalid page sizes', () => {
    const cards = [{ id: 'card-1' }, { id: 'card-2' }, { id: 'card-3' }]

    expect(getTimecardPrintPages(cards, 1).map((page) => page.map((card) => card.id))).toEqual([
      ['card-1'],
      ['card-2'],
      ['card-3'],
    ])
    expect(getTimecardPrintPages(cards, 0)).toEqual([])
  })

  it('formats generated timestamps and exposes the missing payload message', () => {
    const formatted = formatTimecardPrintGeneratedAt(Date.UTC(2026, 5, 13, 18, 30))

    expect(formatted).toContain('2026')
    expect(missingTimecardPrintPayloadMessage).toContain('No timecard export data was found')
  })
})
