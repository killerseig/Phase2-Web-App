import { describe, expect, it } from 'vitest'

import { shouldShowJobDetailSuccessToast } from '@/features/jobs/jobViewHelpers'

describe('job view helpers', () => {
  it('suppresses passive autosave success messages from toast output', () => {
    expect(shouldShowJobDetailSuccessToast('Saving...')).toBe(false)
    expect(shouldShowJobDetailSuccessToast('All changes saved.')).toBe(false)
  })

  it('allows actionable job success messages to show as toasts', () => {
    expect(shouldShowJobDetailSuccessToast('Job created.')).toBe(true)
    expect(shouldShowJobDetailSuccessToast('Job archived.')).toBe(true)
  })
})
