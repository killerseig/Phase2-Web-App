import { describe, expect, it } from 'vitest'

import {
  canCreateTimecardWeekForJob,
  isFunctionShopJob,
} from '../../functions/src/timecardWeekAccess'
import type { CurrentFunctionUser } from '../../functions/src/roleAccess'

function user(
  role: CurrentFunctionUser['role'],
  assignedJobIds: string[] = [],
): CurrentFunctionUser {
  return {
    active: true,
    assignedJobIds,
    displayName: `${role} User`,
    role,
    uid: `${role}-uid`,
  }
}

describe('Cloud Functions timecard week access helpers', () => {
  it('recognizes the target Shop job by number or exact name', () => {
    expect(isFunctionShopJob({ code: '736', name: 'Anything', number: '' })).toBe(true)
    expect(isFunctionShopJob({ code: 736, name: 'Anything', number: '' })).toBe(true)
    expect(isFunctionShopJob({ name: 'Anything', number: '736' })).toBe(true)
    expect(isFunctionShopJob({ name: 'Anything', number: 736 })).toBe(true)
    expect(isFunctionShopJob({ name: ' Shop ', number: '' })).toBe(true)
    expect(isFunctionShopJob({ name: 'Shop Remodel', number: '999' })).toBe(false)
    expect(isFunctionShopJob(null)).toBe(false)
  })

  it('allows Admin and Payroll to create weeks from management/export workflows', () => {
    expect(canCreateTimecardWeekForJob(user('admin'), 'job-a', null)).toBe(true)
    expect(canCreateTimecardWeekForJob(user('payroll'), 'job-a', null)).toBe(true)
  })

  it('requires assigned Foremen to create job timecard weeks', () => {
    expect(canCreateTimecardWeekForJob(
      user('foreman', ['job-a']),
      'job-a',
      { name: 'Lucky 3 Ranch', number: '5229' },
    )).toBe(true)

    expect(canCreateTimecardWeekForJob(
      user('foreman', ['job-b']),
      'job-a',
      { name: 'Lucky 3 Ranch', number: '5229' },
    )).toBe(false)
  })

  it('allows Foremen assigned on the job record when profile assignments are stale', () => {
    expect(canCreateTimecardWeekForJob(
      user('foreman', []),
      'job-a',
      { assignedForemanIds: ['foreman-uid'], name: 'Lucky 3 Ranch', number: '5229' },
    )).toBe(true)
  })

  it('allows Shop Foremen to create Shop job weeks without explicit assignment', () => {
    expect(canCreateTimecardWeekForJob(
      user('shop-foreman'),
      'shop-job',
      { name: 'Anything', number: 736 },
    )).toBe(true)

    expect(canCreateTimecardWeekForJob(
      user('shop-foreman'),
      'job-a',
      { name: 'Lucky 3 Ranch', number: '5229' },
    )).toBe(false)

    expect(canCreateTimecardWeekForJob(
      user('shop-foreman', ['job-a']),
      'job-a',
      { name: 'Lucky 3 Ranch', number: '5229' },
    )).toBe(true)
  })

  it('keeps Project Managers read-only for assigned submitted-timecard reporting', () => {
    expect(canCreateTimecardWeekForJob(
      user('project-manager', ['job-a']),
      'job-a',
      { name: 'Lucky 3 Ranch', number: '5229' },
    )).toBe(false)
  })
})
