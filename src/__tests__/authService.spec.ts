import { describe, expect, it } from 'vitest'
import { normalizeAuthSessionUser, normalizeAuthUserProfile } from '@/services/auth'
import type { User } from 'firebase/auth'

describe('auth service profile normalization', () => {
  it('normalizes Firebase Auth users into the app auth-session shape', () => {
    expect(normalizeAuthSessionUser({
      displayName: '',
      email: undefined,
      uid: 'auth-user-1',
    } as unknown as User)).toEqual({
      displayName: null,
      email: null,
      uid: 'auth-user-1',
    })

    expect(normalizeAuthSessionUser({
      displayName: 'Chris Larsen',
      email: 'chris@example.com',
      uid: 'auth-user-2',
    } as unknown as User)).toEqual({
      displayName: 'Chris Larsen',
      email: 'chris@example.com',
      uid: 'auth-user-2',
    })
  })

  it('normalizes complete profile documents', () => {
    expect(normalizeAuthUserProfile('user-a', {
      active: true,
      assignedJobIds: ['job-a', 'job-b'],
      email: 'field@example.com',
      firstName: 'Field',
      lastName: 'User',
      role: 'project-manager',
    })).toEqual({
      active: true,
      assignedJobIds: ['job-a', 'job-b'],
      email: 'field@example.com',
      firstName: 'Field',
      id: 'user-a',
      lastName: 'User',
      role: 'project-manager',
    })
  })

  it('preserves recognized target stored roles before live target access is enabled', () => {
    expect(normalizeAuthUserProfile('user-payroll', {
      email: 'payroll@example.com',
      role: 'payroll',
    })).toMatchObject({
      id: 'user-payroll',
      role: 'payroll',
    })

    expect(normalizeAuthUserProfile('user-shop', {
      email: 'shop@example.com',
      role: 'shop-foreman',
    })).toMatchObject({
      id: 'user-shop',
      role: 'shop-foreman',
    })
  })

  it('defaults missing profile fields into safe app values', () => {
    expect(normalizeAuthUserProfile('user-b', {
      assignedJobIds: ['job-a', 123, null, 'job-b'],
      role: 'unknown-role',
    })).toEqual({
      active: true,
      assignedJobIds: ['job-a', 'job-b'],
      email: null,
      firstName: null,
      id: 'user-b',
      lastName: null,
      role: 'none',
    })
  })

  it('preserves inactive status when the profile explicitly disables a user', () => {
    expect(normalizeAuthUserProfile('user-c', {
      active: false,
      assignedJobIds: [],
      role: 'admin',
    })).toMatchObject({
      active: false,
      role: 'admin',
    })
  })
})
