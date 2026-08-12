import { describe, expect, it } from 'vitest'
import { isShopJobRecord } from '@/auth/jobIdentity'
import { getRoleDashboardJobShortcuts } from '@/features/dashboard/roleDashboardJobShortcuts'
import type { JobRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: [],
    code: '1A',
    gc: 'Phase 2',
    id: 'job-a',
    name: 'Acoustical Remodel',
    notificationRecipients: {
      dailyLogs: [],
      shopOrders: [],
      timecards: [],
    },
    productionBurden: 0.33,
    type: 'general',
    ...overrides,
  }
}

describe('job identity helpers', () => {
  it('recognizes the target Shop job by job number or exact name', () => {
    expect(isShopJobRecord(makeJob({ code: '736', name: 'Warehouse' }))).toBe(true)
    expect(isShopJobRecord({ code: 736, name: 'Warehouse' })).toBe(true)
    expect(isShopJobRecord({ number: 736, name: 'Warehouse' })).toBe(true)
    expect(isShopJobRecord(makeJob({ code: '999', name: 'Shop' }))).toBe(true)
    expect(isShopJobRecord(makeJob({ code: '999', name: 'Shop Office' }))).toBe(false)
  })
})

describe('role dashboard job shortcuts', () => {
  it('shows assigned jobs only for foremen', () => {
    const shortcuts = getRoleDashboardJobShortcuts({
      assignedJobIds: ['job-a'],
      jobs: [
        makeJob({ id: 'job-b', code: '2B', name: 'Blocked Job' }),
        makeJob({ id: 'job-a', code: '1A', name: 'Assigned Job' }),
      ],
      rawRole: 'foreman',
    })

    expect(shortcuts.map((shortcut) => shortcut.id)).toEqual(['job-a'])
    expect(shortcuts[0]?.moduleRoutes.submittedTimecards).toBeNull()
  })

  it('shows the Shop job and assigned non-Shop jobs for Shop Foremen', () => {
    const shortcuts = getRoleDashboardJobShortcuts({
      assignedJobIds: ['job-assigned'],
      jobs: [
        makeJob({ id: 'job-shop', code: '736', name: 'Shop' }),
        makeJob({ id: 'job-assigned', code: '8A', name: 'Assigned Field Job' }),
        makeJob({ id: 'job-other', code: '9B', name: 'Other Field Job' }),
      ],
      rawRole: 'shop-foreman',
    })

    expect(shortcuts.map((shortcut) => shortcut.id)).toEqual(['job-assigned', 'job-shop'])
    expect(shortcuts.find((shortcut) => shortcut.id === 'job-shop')?.isShopJob).toBe(true)
  })

  it('adds submitted-timecard reporting links for assigned Project Manager jobs', () => {
    const shortcuts = getRoleDashboardJobShortcuts({
      assignedJobIds: ['job-pm'],
      jobs: [
        makeJob({ id: 'job-pm', code: '5229', name: 'Lucky 3 Ranch' }),
        makeJob({ id: 'job-other', code: '736', name: 'Shop' }),
      ],
      rawRole: 'project-manager',
    })

    expect(shortcuts).toHaveLength(1)
    expect(shortcuts[0]?.id).toBe('job-pm')
    expect(shortcuts[0]?.moduleRoutes.submittedTimecards).toBe('/jobs/job-pm/timecards')
  })

  it('keeps Payroll without workflow job shortcuts', () => {
    expect(getRoleDashboardJobShortcuts({
      assignedJobIds: [],
      jobs: [makeJob({ id: 'job-a' })],
      rawRole: 'payroll',
    })).toEqual([])
  })
})
