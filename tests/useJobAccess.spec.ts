import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useJobAccess } from '@/composables/useJobAccess'
import { ROLES, type Role } from '@/constants/app'

type MockAuthStore = {
  role: Role
  assignedJobIds: string[]
  user: { uid: string } | null
}

type JobStub = {
  id: string
  name: string
}

type MockJobsStore = {
  activeJobs: JobStub[]
  archivedJobs: JobStub[]
  fetchAllJobs: ReturnType<typeof vi.fn>
}

let mockAuth: MockAuthStore
let mockJobsStore: MockJobsStore

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth,
}))

vi.mock('@/stores/jobs', () => ({
  useJobsStore: () => mockJobsStore,
}))

describe('useJobAccess', () => {
  beforeEach(() => {
    mockAuth = {
      role: ROLES.ADMIN,
      assignedJobIds: ['job-1'],
      user: { uid: 'user-1' },
    }

    mockJobsStore = {
      activeJobs: [
        { id: 'job-1', name: 'Alpha' },
        { id: 'job-2', name: 'Beta' },
      ],
      archivedJobs: [{ id: 'job-3', name: 'Gamma' }],
      fetchAllJobs: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('allows admins to see all jobs and access each job', () => {
    const { visibleActiveJobs, visibleArchivedJobs, canAccessJob } = useJobAccess()

    expect(visibleActiveJobs.value.map((j) => j.id)).toEqual(['job-1', 'job-2'])
    expect(visibleArchivedJobs.value.map((j) => j.id)).toEqual(['job-3'])
    expect(canAccessJob('job-2')).toBe(true)
  })

  it('restricts foremen to assigned jobs', () => {
    mockAuth.role = ROLES.FOREMAN

    const { visibleActiveJobs, visibleArchivedJobs, canAccessJob } = useJobAccess()

    expect(visibleActiveJobs.value.map((j) => j.id)).toEqual(['job-1'])
    expect(visibleArchivedJobs.value).toHaveLength(0)
    expect(canAccessJob('job-1')).toBe(true)
    expect(canAccessJob('job-2')).toBe(false)
  })

  it('requests filtered jobs for foremen', async () => {
    mockAuth.role = ROLES.FOREMAN

    const { loadJobsForCurrentUser } = useJobAccess()
    await loadJobsForCurrentUser()

    expect(mockJobsStore.fetchAllJobs).toHaveBeenCalledWith(false, {
      assignedOnlyForUid: 'user-1',
    })
  })

  it('requests all jobs for admins', async () => {
    mockAuth.role = ROLES.ADMIN

    const { loadJobsForCurrentUser } = useJobAccess()
    await loadJobsForCurrentUser()

    expect(mockJobsStore.fetchAllJobs).toHaveBeenCalledWith(true, {
      assignedOnlyForUid: undefined,
    })
  })
})
