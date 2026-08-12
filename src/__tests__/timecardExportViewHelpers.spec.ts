import { describe, expect, it } from 'vitest'

import {
  timecardExportCollator,
  timecardExportDateModeOptions,
  timecardExportWeekStatusOptions,
} from '@/features/timecards/exportViewHelpers'

describe('timecard export view helpers', () => {
  it('owns the toolbar date-mode and week-status options used by the route shell', () => {
    expect(timecardExportDateModeOptions).toEqual([
      { label: 'Single', value: 'single' },
      { label: 'Range', value: 'range' },
    ])
    expect(timecardExportWeekStatusOptions).toEqual([
      { label: 'Submitted', value: 'submitted' },
      { label: 'Draft', value: 'draft' },
      { label: 'Mixed', value: 'all' },
    ])
  })

  it('uses the shared numeric/base collator for export option and card ordering', () => {
    expect(['Job 10', 'Job 2'].sort(timecardExportCollator.compare)).toEqual(['Job 2', 'Job 10'])
    expect(timecardExportCollator.compare('cj blanchard', 'CJ Blanchard')).toBe(0)
  })
})
