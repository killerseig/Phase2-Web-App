import { reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useTimecardExportCreateContext } from '@/features/timecards/useTimecardExportCreateContext'
import type { TimecardExportDateFilterMode } from '@/features/timecards/exportViewHelpers'
import type { EmployeeRecord, JobRecord, TimecardWeekRecord, UserProfile } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    active: true,
    assignedForemanIds: ['user-cj'],
    code: '736',
    gc: 'Phase 2',
    name: 'Shop',
    productionBurden: 0.33,
    type: 'general',
    ...overrides,
  }
}

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    active: true,
    employeeNumber: '5133',
    firstName: 'CJ',
    isContractor: false,
    jobId: null,
    lastName: 'Blanchard',
    occupation: 'Shop Foreman',
    ...overrides,
  }
}

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-cj',
    active: true,
    assignedJobIds: [],
    email: 'cj.blanchard@phase2co.com',
    firstName: 'CJ',
    lastName: 'Blanchard',
    role: 'foreman',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-1',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'user-cj',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function mountCreateContext(options: {
  createCardJobId?: string
  employeeSearchTerm?: string
  employees?: EmployeeRecord[]
  filters?: { dateMode: TimecardExportDateFilterMode, singleWeekEndDate: string }
  jobs?: JobRecord[]
  users?: UserProfile[]
  weeks?: TimecardWeekRecord[]
} = {}) {
  const createCardJobId = ref(options.createCardJobId ?? 'job-1')
  const employeeSearchTerm = ref(options.employeeSearchTerm ?? '')
  const employees = ref<EmployeeRecord[]>(options.employees ?? [])
  const filters = reactive(options.filters ?? {
    dateMode: 'single' as TimecardExportDateFilterMode,
    singleWeekEndDate: '2026-06-20',
  })
  const jobs = ref<JobRecord[]>(options.jobs ?? [makeJob()])
  const users = ref<UserProfile[]>(options.users ?? [])
  const weeks = ref<TimecardWeekRecord[]>(options.weeks ?? [])
  const state = useTimecardExportCreateContext({
    collator: new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' }),
    createCardJobId,
    employeeSearchTerm,
    employees,
    filters,
    getCurrentUserId: () => 'current-user',
    getDisplayName: () => 'Current User',
    getJobs: () => jobs.value,
    users,
    weeks,
  })

  return {
    createCardJobId,
    employeeSearchTerm,
    employees,
    filters,
    jobs,
    state,
    users,
    weeks,
  }
}

describe('useTimecardExportCreateContext', () => {
  it('builds sorted job, foreman-filter, user-foreman, and employee options', () => {
    const { state } = mountCreateContext({
      employeeSearchTerm: 'foreman',
      employees: [
        makeEmployee({ id: 'employee-cj', firstName: 'CJ', lastName: 'Blanchard', occupation: 'Shop Foreman' }),
        makeEmployee({ id: 'employee-inactive', active: false, firstName: 'Inactive', occupation: 'Foreman' }),
        makeEmployee({ id: 'employee-other', firstName: 'Alison', lastName: 'Larsen', occupation: 'Admin' }),
      ],
      jobs: [
        makeJob({ id: 'job-10', code: '10', name: 'Tenth Job' }),
        makeJob({ id: 'job-2', code: '2', name: 'Second Job' }),
      ],
      users: [
        makeUser({ id: 'user-cj', firstName: 'CJ', role: 'foreman' }),
        makeUser({ id: 'user-pm', firstName: 'Project', role: 'project-manager' }),
        makeUser({ id: 'user-admin', firstName: 'Admin', role: 'admin' }),
        makeUser({ id: 'user-inactive', active: false, firstName: 'Inactive', role: 'foreman' }),
      ],
      weeks: [
        makeWeek({ ownerForemanName: 'Vince Hintz' }),
        makeWeek({ ownerForemanName: 'CJ Blanchard' }),
        makeWeek({ ownerForemanName: 'CJ Blanchard' }),
      ],
    })

    expect(state.availableJobOptions.value.map((job) => job.label)).toEqual([
      '2 - Second Job',
      '10 - Tenth Job',
    ])
    expect(state.availableForemen.value).toEqual(['CJ Blanchard', 'Vince Hintz'])
    expect(state.availableForemanOptions.value).toEqual([
      { label: 'All Foremen', value: 'all' },
      { label: 'CJ Blanchard', value: 'CJ Blanchard' },
      { label: 'Vince Hintz', value: 'Vince Hintz' },
    ])
    expect(state.availableUserForemen.value.map((user) => user.id)).toEqual(['user-cj', 'user-pm'])
    expect(state.availableEmployees.value.map((employee) => employee.id)).toEqual(['employee-cj'])
  })

  it('resolves existing and synthetic create target weeks with owner context', () => {
    const savedWeek = makeWeek({
      id: 'week-saved',
      jobId: 'job-1',
      weekEndDate: '2026-06-20',
    })
    const {
      createCardJobId,
      state,
    } = mountCreateContext({
      createCardJobId: 'job-1',
      jobs: [
        makeJob({ id: 'job-1', code: '736', name: 'Shop' }),
        makeJob({ id: 'job-2', code: '5229', name: 'Lucky 3 Ranch' }),
      ],
      weeks: [savedWeek],
    })

    expect(state.targetCreateWeek.value).toStrictEqual(savedWeek)

    createCardJobId.value = 'job-2'

    expect(state.targetCreateWeek.value).toMatchObject({
      id: '',
      jobCode: '5229',
      jobId: 'job-2',
      jobName: 'Lucky 3 Ranch',
      ownerForemanName: 'Current User',
      ownerForemanUserId: 'current-user',
      status: 'draft',
      weekEndDate: '2026-06-20',
      weekStartDate: '2026-06-14',
    })
  })

  it('builds assigned create-foreman options and create-tray guidance', () => {
    const {
      filters,
      jobs,
      state,
    } = mountCreateContext({
      createCardJobId: 'job-1',
      jobs: [makeJob({ assignedForemanIds: ['user-cj'] })],
      users: [
        makeUser({ id: 'user-cj', firstName: 'CJ', assignedJobIds: [] }),
        makeUser({ id: 'user-vince', firstName: 'Vince', assignedJobIds: ['job-1'] }),
        makeUser({ id: 'user-other', firstName: 'Other', assignedJobIds: ['job-other'] }),
      ],
    })

    expect(state.createCardForemanOptions.value).toEqual([
      { id: 'user-cj', label: 'CJ Blanchard' },
      { id: 'user-vince', label: 'Vince Blanchard' },
    ])
    expect(state.createTrayMessage.value).toBe('')

    filters.dateMode = 'range'

    expect(state.targetCreateWeek.value).toBeNull()
    expect(state.createTrayMessage.value).toBe('Switch Date Mode to Single before creating cards.')

    filters.dateMode = 'single'
    jobs.value = []

    expect(state.createTrayMessage.value).toBe('No jobs are available to create cards for.')
  })
})
