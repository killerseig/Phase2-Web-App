import { describe, expect, it } from 'vitest'

import {
  canWriteFieldWorkflowForJob,
  type FieldWorkflowWriteAction,
} from '../../functions/src/fieldWorkflowAccess'
import { isFunctionShopJob } from '../../functions/src/jobIdentity'
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

function expectAllWriteActions(
  currentUser: CurrentFunctionUser,
  jobId: string,
  job: { assignedForemanIds?: string[]; code?: string | number; name: string; number: string | number } | null,
  expected: boolean,
) {
  const actions: FieldWorkflowWriteAction[] = ['create', 'edit-draft', 'submit']
  for (const action of actions) {
    expect(canWriteFieldWorkflowForJob(currentUser, jobId, job, action)).toBe(expected)
  }
}

describe('Cloud Functions field workflow access helpers', () => {
  it('recognizes the target Shop job by number or exact name', () => {
    expect(isFunctionShopJob({ code: '736', name: 'Anything', number: '' })).toBe(true)
    expect(isFunctionShopJob({ code: 736, name: 'Anything', number: '' })).toBe(true)
    expect(isFunctionShopJob({ name: 'Anything', number: '736' })).toBe(true)
    expect(isFunctionShopJob({ name: 'Anything', number: 736 })).toBe(true)
    expect(isFunctionShopJob({ name: ' Shop ', number: '' })).toBe(true)
    expect(isFunctionShopJob({ name: 'Shop Remodel', number: '736A' })).toBe(false)
    expect(isFunctionShopJob(null)).toBe(false)
  })

  it('allows Admin to write field workflows for any job', () => {
    expectAllWriteActions(user('admin'), 'job-a', null, true)
  })

  it('requires Foremen to be assigned before writing field workflows', () => {
    const job = { name: 'Lucky 3 Ranch', number: '5229' }

    expectAllWriteActions(user('foreman', ['job-a']), 'job-a', job, true)
    expectAllWriteActions(user('foreman', ['job-b']), 'job-a', job, false)
  })

  it('allows Foremen assigned on the job record when profile assignments are stale', () => {
    expectAllWriteActions(
      user('foreman', []),
      'job-a',
      { assignedForemanIds: ['foreman-uid'], name: 'Lucky 3 Ranch', number: '5229' },
      true,
    )
  })

  it('allows Shop Foremen to write Shop job workflows without explicit assignment', () => {
    expectAllWriteActions(user('shop-foreman'), 'shop-job', { name: 'Anything', number: 736 }, true)
    expectAllWriteActions(user('shop-foreman'), 'job-a', { name: 'Lucky 3 Ranch', number: '5229' }, false)
    expectAllWriteActions(user('shop-foreman', ['job-a']), 'job-a', { name: 'Lucky 3 Ranch', number: '5229' }, true)
  })

  it('allows assigned Project Managers to write field workflows while keeping Payroll out', () => {
    const job = { name: 'Lucky 3 Ranch', number: '5229' }

    expectAllWriteActions(user('project-manager', ['job-a']), 'job-a', job, true)
    expectAllWriteActions(user('project-manager', ['job-b']), 'job-a', job, false)
    expectAllWriteActions(user('payroll'), 'job-a', job, false)
  })
})
