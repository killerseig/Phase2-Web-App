import { describe, expect, it } from 'vitest'

import {
  getTargetFieldEmailRecipientEmails,
  targetRoleReceivesFieldEmail,
  type TargetFieldEmailRecipientUser,
} from '@/auth/targetFieldEmailRecipients'

describe('target field email recipient policy', () => {
  it('keeps Admin, Payroll, and no-access users out of automatic field emails', () => {
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'admin',
    })).toBe(false)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'payroll',
    })).toBe(false)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'none',
    })).toBe(false)
  })

  it('sends assigned Foremen and Project Managers Daily Log and Shop Order field emails', () => {
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'foreman',
    })).toBe(true)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'project-manager',
    })).toBe(true)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-b'],
      jobId: 'job-a',
      role: 'foreman',
    })).toBe(false)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: [],
      jobId: 'job-a',
      role: 'project-manager',
    })).toBe(false)
  })

  it('sends Shop Foremen Shop job field emails without requiring explicit assignment', () => {
    expect(targetRoleReceivesFieldEmail({
      jobId: 'shop-job',
      isShopJob: true,
      role: 'shop-foreman',
    })).toBe(true)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'shop-foreman',
    })).toBe(true)
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: [],
      jobId: 'job-a',
      role: 'shop-foreman',
    })).toBe(false)
  })

  it('requires a concrete job id before assigning automatic field email recipients', () => {
    expect(targetRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: '',
      role: 'foreman',
    })).toBe(false)
    expect(targetRoleReceivesFieldEmail({
      jobId: '',
      isShopJob: true,
      role: 'shop-foreman',
    })).toBe(false)
  })

  it('normalizes, deduplicates, sorts, and filters automatic field email recipient lists', () => {
    const users: TargetFieldEmailRecipientUser[] = [
      {
        assignedJobIds: ['job-a'],
        email: ' Foreman@Phase2Co.com ',
        role: 'foreman',
      },
      {
        assignedJobIds: ['job-a'],
        email: 'project.manager@phase2co.com',
        role: 'project-manager',
      },
      {
        assignedJobIds: ['job-a'],
        email: 'FOREMAN@phase2co.com',
        role: 'foreman',
      },
      {
        assignedJobIds: ['job-b'],
        email: 'wrong-job@phase2co.com',
        role: 'foreman',
      },
      {
        assignedJobIds: ['job-a'],
        active: false,
        email: 'inactive@phase2co.com',
        role: 'project-manager',
      },
      {
        assignedJobIds: ['job-a'],
        email: 'admin@phase2co.com',
        role: 'admin',
      },
      {
        assignedJobIds: ['job-a'],
        email: '',
        role: 'project-manager',
      },
    ]

    expect(getTargetFieldEmailRecipientEmails({ jobId: 'job-a', users })).toEqual([
      'foreman@phase2co.com',
      'project.manager@phase2co.com',
    ])
  })

  it('includes Shop Foremen for Shop job field email lists even when they are not assigned', () => {
    const users: TargetFieldEmailRecipientUser[] = [
      {
        assignedJobIds: [],
        email: 'shop.foreman@phase2co.com',
        role: 'shop-foreman',
      },
      {
        assignedJobIds: [],
        email: 'foreman@phase2co.com',
        role: 'foreman',
      },
      {
        assignedJobIds: [],
        email: 'pm@phase2co.com',
        role: 'project-manager',
      },
    ]

    expect(getTargetFieldEmailRecipientEmails({
      isShopJob: true,
      jobId: 'shop-job',
      users,
    })).toEqual(['shop.foreman@phase2co.com'])
  })
})
