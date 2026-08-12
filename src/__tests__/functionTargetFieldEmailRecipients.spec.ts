import { describe, expect, it } from 'vitest'

import {
  getTargetFieldEmailRecipientEmails,
  targetRoleReceivesFieldEmail,
  type TargetFieldEmailRecipientInput,
  type TargetFieldEmailRecipientUser,
} from '@/auth/targetFieldEmailRecipients'
import {
  getTargetFunctionFieldEmailRecipientEmails,
  targetFunctionRoleReceivesFieldEmail,
  type TargetFunctionFieldEmailRecipientInput,
  type TargetFunctionFieldEmailRecipientUser,
} from '../../functions/src/targetFieldEmailRecipients'

const recipientCases = [
  { assignedJobIds: ['job-a'], jobId: 'job-a', role: 'admin' },
  { assignedJobIds: ['job-a'], jobId: 'job-a', role: 'payroll' },
  { assignedJobIds: ['job-a'], jobId: 'job-a', role: 'none' },
  { assignedJobIds: ['job-a'], jobId: 'job-a', role: 'foreman' },
  { assignedJobIds: ['job-b'], jobId: 'job-a', role: 'foreman' },
  { assignedJobIds: ['job-a'], jobId: 'job-a', role: 'project-manager' },
  { assignedJobIds: [], jobId: 'job-a', role: 'project-manager' },
  { jobId: 'shop-job', isShopJob: true, role: 'shop-foreman' },
  { assignedJobIds: ['job-a'], jobId: 'job-a', role: 'shop-foreman' },
  { assignedJobIds: [], jobId: 'job-a', role: 'shop-foreman' },
  { assignedJobIds: ['job-a'], jobId: '', role: 'foreman' },
  { jobId: '', isShopJob: true, role: 'shop-foreman' },
] as const satisfies readonly TargetFieldEmailRecipientInput[]

const recipientUsers: TargetFieldEmailRecipientUser[] = [
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

describe('Cloud Functions target field email recipient policy', () => {
  it('matches frontend target automatic field email recipient role decisions', () => {
    for (const input of recipientCases) {
      expect(targetFunctionRoleReceivesFieldEmail(
        input as TargetFunctionFieldEmailRecipientInput,
      )).toBe(targetRoleReceivesFieldEmail(input))
    }
  })

  it('matches frontend target recipient list normalization and filtering', () => {
    expect(getTargetFunctionFieldEmailRecipientEmails({
      jobId: 'job-a',
      users: recipientUsers as TargetFunctionFieldEmailRecipientUser[],
    })).toEqual(getTargetFieldEmailRecipientEmails({
      jobId: 'job-a',
      users: recipientUsers,
    }))
  })

  it('keeps backend target Admin, Payroll, and no-access users out of automatic field emails', () => {
    expect(targetFunctionRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'admin',
    })).toBe(false)
    expect(targetFunctionRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'payroll',
    })).toBe(false)
    expect(targetFunctionRoleReceivesFieldEmail({
      assignedJobIds: ['job-a'],
      jobId: 'job-a',
      role: 'none',
    })).toBe(false)
  })

  it('includes backend target Shop Foremen for Shop job field emails even when unassigned', () => {
    const users: TargetFunctionFieldEmailRecipientUser[] = [
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

    expect(getTargetFunctionFieldEmailRecipientEmails({
      isShopJob: true,
      jobId: 'shop-job',
      users,
    })).toEqual(['shop.foreman@phase2co.com'])
  })
})
