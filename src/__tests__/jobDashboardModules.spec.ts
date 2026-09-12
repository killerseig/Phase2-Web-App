import { describe, expect, it } from 'vitest'

import {
  getJobDashboardModules,
  JOB_DASHBOARD_MODULES,
} from '@/features/jobs/jobDashboardModules'

describe('jobDashboardModules', () => {
  it('keeps the current job dashboard modules in workflow priority order', () => {
    expect(getJobDashboardModules()).toEqual([
      {
        label: 'Timecards',
        detail: 'Enter crew hours and submit weekly timecards.',
        to: 'timecards',
      },
      {
        label: 'Daily Logs',
        detail: 'Record daily work, site updates, and photos.',
        to: 'daily-logs',
      },
      {
        label: 'Shop Orders',
        detail: 'Order materials from the catalog or add a custom item.',
        to: 'shop-orders',
      },
    ])
  })

  it('returns fresh module records so callers cannot mutate the canonical list', () => {
    const modules = getJobDashboardModules()
    const firstModule = modules[0]

    expect(firstModule).toBeDefined()
    if (!firstModule) {
      return
    }

    firstModule.label = 'Changed'

    const canonicalFirstModule = JOB_DASHBOARD_MODULES[0]
    const nextFirstModule = getJobDashboardModules()[0]

    expect(canonicalFirstModule?.label).toBe('Timecards')
    expect(nextFirstModule?.label).toBe('Timecards')
  })
})
