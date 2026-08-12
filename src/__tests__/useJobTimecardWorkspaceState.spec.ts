import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useJobTimecardWorkspaceState } from '@/features/timecards/useJobTimecardWorkspaceState'
import type { EmployeeRecord, JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '5229',
    gc: 'Lucky 3',
    name: 'Lucky 3 Ranch',
    productionBurden: 0.42,
    type: 'general',
    ...overrides,
  }
}

function makeEmployee(overrides: Partial<EmployeeRecord> = {}): EmployeeRecord {
  return {
    id: 'employee-1',
    active: true,
    employeeNumber: '5133',
    firstName: 'Vince',
    isContractor: false,
    jobId: null,
    lastName: 'Hintz',
    occupation: 'Foreman',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    ownerForemanName: 'Vince Hintz',
    ownerForemanUserId: 'foreman-1',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
    id: 'card-1',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'Vince',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Vince Hintz',
    isContractor: false,
    lastName: 'Hintz',
    lines: [],
    notes: '',
    occupation: 'Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: null,
    ...overrides,
  }
}

function mountWorkspaceState(options: {
  canManageJobTimecards?: boolean
  canUseJobTimecardWorkflow?: boolean
  cardSearchTerm?: string
  cards?: TimecardCardRecord[]
  employeeSearchTerm?: string
  employees?: EmployeeRecord[]
  ensuringWeek?: boolean
  job?: JobRecord | null
  jobId?: string | null
  selectedWeekEndDate?: string
  selectedWeekId?: string | null
  weeks?: TimecardWeekRecord[]
  weeksLoading?: boolean
} = {}) {
  const canManageJobTimecards = ref(options.canManageJobTimecards ?? false)
  const canUseJobTimecardWorkflow = ref(options.canUseJobTimecardWorkflow ?? true)
  const cardSearchTerm = ref(options.cardSearchTerm ?? '')
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [])
  const employeeSearchTerm = ref(options.employeeSearchTerm ?? '')
  const employees = ref<EmployeeRecord[]>(options.employees ?? [])
  const ensuringWeek = ref(options.ensuringWeek ?? false)
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const selectedWeekEndDate = ref(options.selectedWeekEndDate ?? '2026-06-20')
  const selectedWeekId = ref<string | null>(options.selectedWeekId ?? null)
  const weeks = ref<TimecardWeekRecord[]>(options.weeks ?? [])
  const weeksLoading = ref(options.weeksLoading ?? false)

  const state = useJobTimecardWorkspaceState({
    cardSearchTerm,
    cards,
    employeeSearchTerm,
    employees,
    ensuringWeek,
    getCanManageJobTimecards: () => canManageJobTimecards.value,
    getCanUseJobTimecardWorkflow: () => canUseJobTimecardWorkflow.value,
    job,
    jobId,
    selectedWeekEndDate,
    selectedWeekId,
    weeks,
    weeksLoading,
  })

  return {
    canManageJobTimecards,
    canUseJobTimecardWorkflow,
    cardSearchTerm,
    cards,
    employeeSearchTerm,
    employees,
    ensuringWeek,
    job,
    jobId,
    selectedWeekEndDate,
    selectedWeekId,
    state,
    weeks,
    weeksLoading,
  }
}

describe('useJobTimecardWorkspaceState', () => {
  it('prefers the explicitly selected week only when it matches the selected date', () => {
    const matchingSelected = makeWeek({
      id: 'week-explicit',
      status: 'draft',
      weekEndDate: '2026-06-20',
    })
    const submittedFallback = makeWeek({
      id: 'week-submitted',
      status: 'submitted',
      weekEndDate: '2026-06-20',
    })
    const {
      selectedWeekId,
      state,
    } = mountWorkspaceState({
      selectedWeekEndDate: '2026-06-20',
      selectedWeekId: 'week-explicit',
      weeks: [submittedFallback, matchingSelected],
    })

    expect(state.selectedWeek.value?.id).toBe('week-explicit')

    selectedWeekId.value = 'missing-week'

    expect(state.selectedWeek.value?.id).toBe('week-submitted')
  })

  it('falls back to the preferred visible week for the selected date', () => {
    const emptyDraft = makeWeek({
      id: 'week-empty',
      employeeCardCount: 0,
      status: 'draft',
      weekEndDate: '2026-06-20',
    })
    const populatedDraft = makeWeek({
      id: 'week-populated',
      employeeCardCount: 6,
      status: 'draft',
      weekEndDate: '2026-06-20',
    })
    const submitted = makeWeek({
      id: 'week-submitted',
      employeeCardCount: 1,
      status: 'submitted',
      weekEndDate: '2026-06-20',
    })
    const {
      state,
      weeks,
    } = mountWorkspaceState({
      selectedWeekEndDate: '2026-06-20',
      weeks: [emptyDraft, populatedDraft],
    })

    expect(state.selectedWeek.value?.id).toBe('week-populated')

    weeks.value = [emptyDraft, populatedDraft, submitted]

    expect(state.selectedWeek.value?.id).toBe('week-submitted')
  })

  it('derives selected week start dates from the selected week or selected week ending date', () => {
    const {
      selectedWeekEndDate,
      state,
      weeks,
    } = mountWorkspaceState({
      selectedWeekEndDate: '2026-06-20',
      weeks: [],
    })

    expect(state.selectedWeekStartDate.value).toBe('2026-06-14')

    weeks.value = [makeWeek({
      id: 'week-custom',
      weekEndDate: '2026-06-20',
      weekStartDate: '2026-06-13',
    })]

    expect(state.selectedWeekStartDate.value).toBe('2026-06-13')

    weeks.value = []
    selectedWeekEndDate.value = ''

    expect(state.selectedWeekStartDate.value).toBe('')
  })

  it('filters cards by employee display fields and employees by active searchable records', () => {
    const activeVince = makeEmployee({
      id: 'employee-vince',
      employeeNumber: '5133',
      firstName: 'Vince',
      lastName: 'Hintz',
      occupation: 'Foreman',
    })
    const inactiveMatch = makeEmployee({
      id: 'employee-inactive',
      active: false,
      firstName: 'Inactive',
      lastName: 'Hintz',
    })
    const {
      cardSearchTerm,
      employeeSearchTerm,
      state,
    } = mountWorkspaceState({
      cards: [
        makeCard({ id: 'card-vince', fullName: 'Vince Hintz', occupation: 'Foreman' }),
        makeCard({ id: 'card-cj', fullName: 'CJ Blanchard', employeeNumber: '1001' }),
      ],
      employees: [activeVince, inactiveMatch],
    })

    cardSearchTerm.value = '1001'
    employeeSearchTerm.value = 'hintz'

    expect(state.filteredCards.value.map((card) => card.id)).toEqual(['card-cj'])
    expect(state.availableEmployees.value.map((employee) => employee.id)).toEqual(['employee-vince'])
  })

  it('derives editability from week status, workflow access, and manager permissions', () => {
    const {
      canManageJobTimecards,
      canUseJobTimecardWorkflow,
      state,
      weeks,
    } = mountWorkspaceState({
      selectedWeekEndDate: '2026-06-20',
      weeks: [makeWeek({ id: 'week-draft', status: 'draft' })],
    })

    expect(state.canEditWeek.value).toBe(true)

    canUseJobTimecardWorkflow.value = false

    expect(state.canEditWeek.value).toBe(false)

    canUseJobTimecardWorkflow.value = true
    weeks.value = [makeWeek({ id: 'week-submitted', status: 'submitted' })]

    expect(state.canEditWeek.value).toBe(false)

    canManageJobTimecards.value = true

    expect(state.canEditWeek.value).toBe(true)

    weeks.value = []

    expect(state.canEditWeek.value).toBe(false)
  })

  it('allows creating a selected week only when the job/date are ready and no week exists', () => {
    const {
      ensuringWeek,
      jobId,
      selectedWeekEndDate,
      state,
      weeks,
      weeksLoading,
    } = mountWorkspaceState({
      jobId: 'job-1',
      selectedWeekEndDate: '2026-06-20',
      weeks: [],
      weeksLoading: false,
    })

    expect(state.canCreateSelectedWeek.value).toBe(true)

    weeks.value = [makeWeek({ weekEndDate: '2026-06-20' })]
    expect(state.canCreateSelectedWeek.value).toBe(false)

    weeks.value = []
    weeksLoading.value = true
    expect(state.canCreateSelectedWeek.value).toBe(false)

    weeksLoading.value = false
    ensuringWeek.value = true
    expect(state.canCreateSelectedWeek.value).toBe(false)

    ensuringWeek.value = false
    selectedWeekEndDate.value = ''
    expect(state.canCreateSelectedWeek.value).toBe(false)

    selectedWeekEndDate.value = '2026-06-20'
    jobId.value = null
    expect(state.canCreateSelectedWeek.value).toBe(false)
  })

  it('does not allow reporting-only users to create missing weeks', () => {
    const {
      state,
    } = mountWorkspaceState({
      canUseJobTimecardWorkflow: false,
      jobId: 'job-1',
      selectedWeekEndDate: '2026-06-20',
      weeks: [],
      weeksLoading: false,
    })

    expect(state.canCreateSelectedWeek.value).toBe(false)
  })

  it('uses job burden when present, falls back to the default, and keeps the ten most recent weeks', () => {
    const weeks = Array.from({ length: 12 }, (_, index) => makeWeek({
      id: `week-${index + 1}`,
      weekEndDate: '2026-06-20',
    }))
    const {
      job,
      state,
    } = mountWorkspaceState({
      job: makeJob({ productionBurden: 0.51 }),
      weeks,
    })

    expect(state.burdenValue.value).toBe(0.51)
    expect(state.recentWeeks.value.map((week) => week.id)).toEqual([
      'week-1',
      'week-2',
      'week-3',
      'week-4',
      'week-5',
      'week-6',
      'week-7',
      'week-8',
      'week-9',
      'week-10',
    ])

    job.value = makeJob({ productionBurden: null })

    expect(state.burdenValue.value).toBe(0.33)
  })
})
