import { describe, expect, it } from 'vitest'
import { normalizeAuthUserProfile } from '@/services/auth'

describe('auth service profile normalization', () => {
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
