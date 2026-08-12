import { describe, expect, it } from 'vitest'

import {
  targetRoleCanCreateFieldWorkflow,
  targetRoleCanEditFieldWorkflowDraft,
  targetRoleCanOpenFieldWorkflow,
  targetRoleCanSubmitFieldWorkflow,
  targetRoleCanViewSubmittedFieldWorkflow,
} from '@/auth/targetFieldWorkflowAccess'

describe('target field workflow access policy', () => {
  it('models Admin as full Daily Log and Shop Order workflow access', () => {
    const input = { role: 'admin' as const, jobId: 'job-a' }

    expect(targetRoleCanOpenFieldWorkflow(input)).toBe(true)
    expect(targetRoleCanViewSubmittedFieldWorkflow(input)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(input)).toBe(true)
    expect(targetRoleCanEditFieldWorkflowDraft(input)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(input)).toBe(true)
  })

  it('keeps Payroll out of Daily Log and Shop Order workflow modules', () => {
    const input = { role: 'payroll' as const, jobId: 'job-a' }

    expect(targetRoleCanOpenFieldWorkflow(input)).toBe(false)
    expect(targetRoleCanViewSubmittedFieldWorkflow(input)).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow(input)).toBe(false)
    expect(targetRoleCanEditFieldWorkflowDraft(input)).toBe(false)
    expect(targetRoleCanSubmitFieldWorkflow(input)).toBe(false)
  })

  it('models Shop Foreman as Shop job workflow editor plus assigned non-Shop workflow editor', () => {
    const shopJob = { role: 'shop-foreman' as const, jobId: 'shop-job', isShopJob: true }
    const assignedJob = {
      role: 'shop-foreman' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    }
    const unassignedJob = {
      role: 'shop-foreman' as const,
      jobId: 'job-a',
      assignedJobIds: [],
    }

    expect(targetRoleCanOpenFieldWorkflow(shopJob)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(shopJob)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(shopJob)).toBe(true)
    expect(targetRoleCanOpenFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanOpenFieldWorkflow(unassignedJob)).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow(unassignedJob)).toBe(false)
  })

  it('models Project Manager as assigned-job workflow editor without unassigned access', () => {
    const assignedJob = {
      role: 'project-manager' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    }
    const unassignedJob = {
      role: 'project-manager' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    }

    expect(targetRoleCanOpenFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanViewSubmittedFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanEditFieldWorkflowDraft(assignedJob)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanOpenFieldWorkflow(unassignedJob)).toBe(false)
    expect(targetRoleCanViewSubmittedFieldWorkflow(unassignedJob)).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow(unassignedJob)).toBe(false)
  })

  it('models Foreman as assigned-job workflow editor without unassigned access', () => {
    const assignedJob = {
      role: 'foreman' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    }
    const unassignedJob = {
      role: 'foreman' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-b'],
    }

    expect(targetRoleCanOpenFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanViewSubmittedFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanCreateFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanEditFieldWorkflowDraft(assignedJob)).toBe(true)
    expect(targetRoleCanSubmitFieldWorkflow(assignedJob)).toBe(true)
    expect(targetRoleCanOpenFieldWorkflow(unassignedJob)).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow(unassignedJob)).toBe(false)
  })

  it('keeps no-access users and missing job ids out of field workflow surfaces', () => {
    expect(targetRoleCanOpenFieldWorkflow({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanViewSubmittedFieldWorkflow({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanEditFieldWorkflowDraft({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanSubmitFieldWorkflow({ role: 'none', jobId: 'job-a' })).toBe(false)
    expect(targetRoleCanOpenFieldWorkflow({ role: 'admin', jobId: '' })).toBe(false)
    expect(targetRoleCanCreateFieldWorkflow({ role: 'admin', jobId: '' })).toBe(false)
  })
})
