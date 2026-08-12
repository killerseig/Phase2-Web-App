import { describe, expect, it } from 'vitest'

import {
  getTargetRoleCapabilities,
  normalizeTargetRoleKey,
  TARGET_BUILT_IN_ROLE_KEYS,
  targetRoleCanBeAssignedJobs,
  type TargetRoleKey,
} from '@/auth/targetRoleCapabilities'
import {
  getTargetFunctionRoleCapabilities,
  normalizeTargetFunctionRoleKey,
  TARGET_FUNCTION_BUILT_IN_ROLE_KEYS,
  targetFunctionRoleCanBeAssignedJobs,
  type TargetFunctionRoleKey,
} from '../../functions/src/targetRoleCapabilities'

const targetRoles = [
  'admin',
  'payroll',
  'shop-foreman',
  'project-manager',
  'foreman',
  'none',
] as const satisfies readonly TargetRoleKey[]

describe('Cloud Functions target role capabilities', () => {
  it('matches the frontend target built-in role order', () => {
    expect(TARGET_FUNCTION_BUILT_IN_ROLE_KEYS).toEqual(TARGET_BUILT_IN_ROLE_KEYS)
  })

  it('normalizes target function roles the same way as the frontend target role helper', () => {
    const examples = [
      ' Payroll ',
      'SHOP-FOREMAN',
      'Shop Foreman',
      'shop_foreman',
      'shopForeman',
      'project-manager',
      'Project Manager',
      'project_manager',
      'projectManager',
      'controller',
      undefined,
    ]

    for (const example of examples) {
      expect(normalizeTargetFunctionRoleKey(example)).toBe(normalizeTargetRoleKey(example))
    }
  })

  it('matches the frontend target capability matrix for every target role', () => {
    for (const role of targetRoles) {
      expect(getTargetFunctionRoleCapabilities(role as TargetFunctionRoleKey)).toEqual(
        getTargetRoleCapabilities(role),
      )
    }
  })

  it('matches the frontend target assigned-job role policy', () => {
    for (const role of targetRoles) {
      expect(targetFunctionRoleCanBeAssignedJobs(role as TargetFunctionRoleKey)).toBe(
        targetRoleCanBeAssignedJobs(role),
      )
    }
  })

  it('keeps backend target no-access users outside every capability', () => {
    expect(
      Object.values(getTargetFunctionRoleCapabilities('none')).every((value) => value === false),
    ).toBe(true)
  })
})
