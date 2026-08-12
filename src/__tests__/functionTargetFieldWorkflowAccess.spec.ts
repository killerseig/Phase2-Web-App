import { describe, expect, it } from 'vitest'

import {
  targetRoleCanCreateFieldWorkflow,
  targetRoleCanEditFieldWorkflowDraft,
  targetRoleCanOpenFieldWorkflow,
  targetRoleCanSubmitFieldWorkflow,
  targetRoleCanViewSubmittedFieldWorkflow,
  type TargetFieldWorkflowAccessInput,
} from '@/auth/targetFieldWorkflowAccess'
import {
  targetFunctionRoleCanCreateFieldWorkflow,
  targetFunctionRoleCanEditFieldWorkflowDraft,
  targetFunctionRoleCanOpenFieldWorkflow,
  targetFunctionRoleCanSubmitFieldWorkflow,
  targetFunctionRoleCanViewSubmittedFieldWorkflow,
  type TargetFunctionFieldWorkflowAccessInput,
} from '../../functions/src/targetFieldWorkflowAccess'

const fieldWorkflowCases = [
  { role: 'admin', jobId: 'job-a' },
  { role: 'payroll', jobId: 'job-a' },
  { role: 'shop-foreman', jobId: 'shop-job', isShopJob: true },
  { role: 'shop-foreman', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'shop-foreman', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'project-manager', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'project-manager', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'foreman', jobId: 'job-a', assignedJobIds: ['job-a'] },
  { role: 'foreman', jobId: 'job-a', assignedJobIds: ['job-b'] },
  { role: 'none', jobId: 'job-a' },
  { role: 'admin', jobId: '' },
] as const satisfies readonly TargetFieldWorkflowAccessInput[]

describe('Cloud Functions target field workflow access policy', () => {
  it('matches frontend target field workflow policy for representative role/job cases', () => {
    for (const input of fieldWorkflowCases) {
      const functionInput = input as TargetFunctionFieldWorkflowAccessInput

      expect(targetFunctionRoleCanOpenFieldWorkflow(functionInput)).toBe(
        targetRoleCanOpenFieldWorkflow(input),
      )
      expect(targetFunctionRoleCanViewSubmittedFieldWorkflow(functionInput)).toBe(
        targetRoleCanViewSubmittedFieldWorkflow(input),
      )
      expect(targetFunctionRoleCanCreateFieldWorkflow(functionInput)).toBe(
        targetRoleCanCreateFieldWorkflow(input),
      )
      expect(targetFunctionRoleCanEditFieldWorkflowDraft(functionInput)).toBe(
        targetRoleCanEditFieldWorkflowDraft(input),
      )
      expect(targetFunctionRoleCanSubmitFieldWorkflow(functionInput)).toBe(
        targetRoleCanSubmitFieldWorkflow(input),
      )
    }
  })

  it('keeps backend target Project Managers assigned-job editors for field workflows', () => {
    const assignedJob = {
      role: 'project-manager' as const,
      jobId: 'job-a',
      assignedJobIds: ['job-a'],
    }

    expect(targetFunctionRoleCanOpenFieldWorkflow(assignedJob)).toBe(true)
    expect(targetFunctionRoleCanViewSubmittedFieldWorkflow(assignedJob)).toBe(true)
    expect(targetFunctionRoleCanCreateFieldWorkflow(assignedJob)).toBe(true)
    expect(targetFunctionRoleCanEditFieldWorkflowDraft(assignedJob)).toBe(true)
    expect(targetFunctionRoleCanSubmitFieldWorkflow(assignedJob)).toBe(true)
  })

  it('keeps backend target Payroll out of field workflows', () => {
    const input = { role: 'payroll' as const, jobId: 'job-a' }

    expect(targetFunctionRoleCanOpenFieldWorkflow(input)).toBe(false)
    expect(targetFunctionRoleCanViewSubmittedFieldWorkflow(input)).toBe(false)
    expect(targetFunctionRoleCanCreateFieldWorkflow(input)).toBe(false)
    expect(targetFunctionRoleCanEditFieldWorkflowDraft(input)).toBe(false)
    expect(targetFunctionRoleCanSubmitFieldWorkflow(input)).toBe(false)
  })

  it('allows backend target Shop Foremen to edit Shop job field workflows', () => {
    const shopJob = { role: 'shop-foreman' as const, jobId: 'shop-job', isShopJob: true }

    expect(targetFunctionRoleCanOpenFieldWorkflow(shopJob)).toBe(true)
    expect(targetFunctionRoleCanViewSubmittedFieldWorkflow(shopJob)).toBe(true)
    expect(targetFunctionRoleCanCreateFieldWorkflow(shopJob)).toBe(true)
    expect(targetFunctionRoleCanEditFieldWorkflowDraft(shopJob)).toBe(true)
    expect(targetFunctionRoleCanSubmitFieldWorkflow(shopJob)).toBe(true)
  })
})
