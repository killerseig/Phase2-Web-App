import { describe, expect, it } from 'vitest'

import { targetUserIsAssignedToJob } from '@/auth/targetJobAssignments'

describe('target job assignment helper', () => {
  it('matches concrete job ids against assigned job ids', () => {
    expect(targetUserIsAssignedToJob('job-a', ['job-a', 'job-b'])).toBe(true)
    expect(targetUserIsAssignedToJob('job-c', ['job-a', 'job-b'])).toBe(false)
  })

  it('treats missing job ids or assignment lists as unassigned', () => {
    expect(targetUserIsAssignedToJob('', ['job-a'])).toBe(false)
    expect(targetUserIsAssignedToJob('job-a', [])).toBe(false)
    expect(targetUserIsAssignedToJob('job-a', null)).toBe(false)
    expect(targetUserIsAssignedToJob('job-a', undefined)).toBe(false)
  })
})
