import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useJobsStore } from '@/stores/jobs'

vi.mock('@/services', () => ({
  assignForemanToJob: vi.fn(),
  createJob: vi.fn(),
  deleteJob: vi.fn(),
  getJob: vi.fn(),
  listAllJobs: vi.fn(),
  removeForemanFromJob: vi.fn(),
  setJobActive: vi.fn(),
  setTimecardPeriodEndDate: vi.fn(),
  subscribeAllJobs: vi.fn(),
  subscribeJob: vi.fn(),
  updateJob: vi.fn(),
  updateTimecardStatus: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logError: vi.fn(),
}))

import {
  createJob as createJobService,
  getJob as getJobService,
} from '@/services'

const createJobMock = createJobService as unknown as ReturnType<typeof vi.fn>
const getJobMock = getJobService as unknown as ReturnType<typeof vi.fn>

describe('jobs store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates a job and caches the fetched created job', async () => {
    const store = useJobsStore()
    createJobMock.mockResolvedValue('job-1')
    getJobMock.mockResolvedValue({
      id: 'job-1',
      name: 'Project One',
      code: '4197',
      active: true,
      type: 'general',
      assignedForemanIds: [],
      timecardStatus: 'pending',
      timecardPeriodEndDate: null,
      timecardLastSentWeekEnding: null,
      timecardSubmittedAt: null,
      dailyLogRecipients: [],
      archivedAt: null,
      createdAt: null,
      productionBurden: 0.33,
    })

    const job = await store.createJob('Project One', { code: '4197' })

    expect(createJobMock).toHaveBeenCalledWith('Project One', { code: '4197' })
    expect(getJobMock).toHaveBeenCalledWith('job-1')
    expect(job).toMatchObject({ id: 'job-1', name: 'Project One' })
    expect(store.jobs).toHaveLength(1)
    expect(store.jobs[0]).toMatchObject({ id: 'job-1', code: '4197' })
    expect(store.error).toBeNull()
  })

  it('stores an error and rethrows when create fails', async () => {
    const store = useJobsStore()
    createJobMock.mockRejectedValue(new Error('create failed'))

    await expect(store.createJob('Project One')).rejects.toThrow('create failed')

    expect(store.error).toBe('create failed')
    expect(getJobMock).not.toHaveBeenCalled()
  })
})
