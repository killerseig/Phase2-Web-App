import { computed, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type TimecardExportCreateForemanOption,
  type TimecardExportCustomCardFormState,
  type TimecardExportFilterState,
  type TimecardExportJobOption,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportCreateActions } from '@/features/timecards/useTimecardExportCreateActions'
import { createTimecardCard, ensureTimecardWeek } from '@/services/timecards'
import type { EmployeeRecord, TimecardWeekRecord } from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  createTimecardCard: vi.fn(),
  ensureTimecardWeek: vi.fn(),
}))

const createTimecardCardMock = vi.mocked(createTimecardCard)
const ensureTimecardWeekMock = vi.mocked(ensureTimecardWeek)

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

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'foreman-cj',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeFilters(overrides: Partial<TimecardExportFilterState> = {}): TimecardExportFilterState {
  return reactive({
    cardSearch: '',
    dateMode: 'single',
    foreman: 'all',
    rangeEndDate: '2026-06-20',
    rangeStartDate: '2026-06-20',
    selectedJobIds: [],
    singleWeekEndDate: '2026-06-20',
    status: 'all',
    weekSearch: '',
    ...overrides,
  })
}

function makeCustomCardForm(overrides: Partial<TimecardExportCustomCardFormState> = {}): TimecardExportCustomCardFormState {
  return reactive({
    employeeNumber: '9001',
    firstName: '  Rocky  ',
    isContractor: true,
    lastName: '  Rodriguez  ',
    occupation: '  Foreman  ',
    wageRate: '42.50',
    ...overrides,
  })
}

function mountCreateActions(options: {
  canEditWeek?: boolean
  canUseTimecardExport?: boolean
  createCardForemanId?: string
  createCardForemanOptions?: TimecardExportCreateForemanOption[]
  createCardJobId?: string
  createCardJobOptions?: TimecardExportJobOption[]
  customCardForm?: TimecardExportCustomCardFormState
  employeeSearchTerm?: string
  filters?: TimecardExportFilterState
  targetCreateWeek?: TimecardWeekRecord | null
} = {}) {
  const actionLoading = ref(false)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const canUseTimecardExport = ref(options.canUseTimecardExport ?? true)
  const createCardForemanId = ref(options.createCardForemanId ?? 'foreman-cj')
  const createCardForemanOptions = ref<TimecardExportCreateForemanOption[]>(options.createCardForemanOptions ?? [
    { id: 'foreman-cj', label: 'CJ Blanchard' },
  ])
  const createCardJobId = ref(options.createCardJobId ?? 'job-shop')
  const createCardJobOptions = ref<TimecardExportJobOption[]>(options.createCardJobOptions ?? [
    { id: 'job-shop', code: '736', name: 'Shop', label: '736 - Shop' },
  ])
  const customCardForm = options.customCardForm ?? makeCustomCardForm()
  const employeeSearchTerm = ref(options.employeeSearchTerm ?? 'cj')
  const filters = options.filters ?? makeFilters()
  const targetCreateWeek = ref<TimecardWeekRecord | null>(
    options.targetCreateWeek === undefined ? makeWeek() : options.targetCreateWeek,
  )
  const calls: string[] = []
  const closeCreateTray = vi.fn(() => {
    calls.push('close-tray')
  })
  const expandAndSelectCard = vi.fn((cardId: string) => {
    calls.push(`expand:${cardId}`)
  })
  const getNextSortIndexForWeek = vi.fn((weekId: string) => {
    calls.push(`sort-index:${weekId}`)
    return 7
  })
  const resetCustomCardForm = vi.fn(() => {
    calls.push('reset-custom')
  })
  const resetPageAndSaveMessages = vi.fn(() => {
    calls.push('reset-messages')
  })
  const scrollCardIntoView = vi.fn((cardId: string) => {
    calls.push(`scroll:${cardId}`)
  })
  const setCardEditMode = vi.fn((cardId: string, editable: boolean) => {
    calls.push(`edit:${cardId}:${editable}`)
  })
  const setPageError = vi.fn()
  const setPageErrorMessage = vi.fn((message: string) => {
    calls.push(`error-message:${message}`)
  })
  const actions = useTimecardExportCreateActions({
    actionLoading,
    canEditWeek: computed(() => canEditWeek.value),
    closeCreateTray,
    createCardForemanId,
    createCardForemanOptions: computed(() => createCardForemanOptions.value),
    createCardJobId,
    createCardJobOptions: computed(() => createCardJobOptions.value),
    customCardForm,
    employeeSearchTerm,
    expandAndSelectCard,
    filters,
    getCanUseTimecardExport: () => canUseTimecardExport.value,
    getNextSortIndexForWeek,
    resetCustomCardForm,
    resetPageAndSaveMessages,
    scrollCardIntoView,
    setCardEditMode,
    setPageError,
    setPageErrorMessage,
    targetCreateWeek: computed(() => targetCreateWeek.value),
  })

  return {
    actionLoading,
    actions,
    calls,
    canEditWeek,
    canUseTimecardExport,
    closeCreateTray,
    createCardForemanId,
    createCardForemanOptions,
    createCardJobId,
    createCardJobOptions,
    customCardForm,
    employeeSearchTerm,
    expandAndSelectCard,
    filters,
    getNextSortIndexForWeek,
    resetCustomCardForm,
    resetPageAndSaveMessages,
    scrollCardIntoView,
    setCardEditMode,
    setPageError,
    setPageErrorMessage,
    targetCreateWeek,
  }
}

describe('useTimecardExportCreateActions', () => {
  beforeEach(() => {
    createTimecardCardMock.mockReset()
    createTimecardCardMock.mockResolvedValue('card-new')
    ensureTimecardWeekMock.mockReset()
    ensureTimecardWeekMock.mockResolvedValue('week-created')
  })

  it('adds an employee card to an existing target week and syncs the export filters', async () => {
    const {
      actionLoading,
      actions,
      calls,
      employeeSearchTerm,
      filters,
      getNextSortIndexForWeek,
      resetPageAndSaveMessages,
    } = mountCreateActions({
      employeeSearchTerm: 'blanchard',
      filters: makeFilters({ dateMode: 'single', selectedJobIds: ['old-job'], status: 'submitted' }),
      targetCreateWeek: makeWeek({
        id: 'week-shop',
        jobId: 'job-shop',
        ownerForemanName: 'CJ Blanchard',
        weekEndDate: '2026-06-20',
        weekStartDate: '2026-06-14',
      }),
    })

    await actions.handleAddEmployee(makeEmployee({
      id: 'employee-cj',
      employeeNumber: '5133',
      firstName: 'CJ',
      isContractor: false,
      lastName: 'Blanchard',
      occupation: 'Shop Foreman',
    }))

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(ensureTimecardWeekMock).not.toHaveBeenCalled()
    expect(getNextSortIndexForWeek).toHaveBeenCalledWith('week-shop')
    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-shop',
      '2026-06-14',
      {
        employeeId: 'employee-cj',
        employeeNumber: '5133',
        firstName: 'CJ',
        isContractor: false,
        lastName: 'Blanchard',
        occupation: 'Shop Foreman',
        wageRate: null,
      },
      7,
      '736',
    )
    expect(filters).toMatchObject({
      dateMode: 'single',
      foreman: 'CJ Blanchard',
      rangeEndDate: '2026-06-20',
      rangeStartDate: '2026-06-20',
      selectedJobIds: ['job-shop'],
      singleWeekEndDate: '2026-06-20',
      status: 'all',
    })
    expect(employeeSearchTerm.value).toBe('')
    expect(calls).toEqual([
      'reset-messages',
      'sort-index:week-shop',
      'expand:card-new',
      'edit:card-new:true',
      'close-tray',
      'scroll:card-new',
    ])
    expect(actionLoading.value).toBe(false)
  })

  it('ensures a synthetic target week before adding an employee card', async () => {
    const {
      actions,
      filters,
    } = mountCreateActions({
      createCardJobId: 'job-lucky',
      createCardJobOptions: [{ id: 'job-lucky', code: '5229', name: 'Lucky 3 Ranch', label: '5229 - Lucky 3 Ranch' }],
      createCardForemanId: 'foreman-vince',
      createCardForemanOptions: [{ id: 'foreman-vince', label: 'Vince Hintz' }],
      targetCreateWeek: makeWeek({
        id: '',
        jobCode: '5229',
        jobId: 'job-lucky',
        jobName: 'Lucky 3 Ranch',
        ownerForemanName: 'Current User',
        ownerForemanUserId: 'current-user',
        weekEndDate: '2026-06-27',
        weekStartDate: '2026-06-21',
      }),
    })

    await actions.handleAddEmployee(makeEmployee())

    expect(ensureTimecardWeekMock).toHaveBeenCalledWith({
      jobCode: '5229',
      jobId: 'job-lucky',
      jobName: 'Lucky 3 Ranch',
      ownerForemanName: 'Vince Hintz',
      ownerForemanUserId: 'foreman-vince',
      weekEndDate: '2026-06-27',
    })
    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-created',
      '2026-06-21',
      expect.objectContaining({ employeeNumber: '5133' }),
      7,
      '5229',
    )
    expect(filters.foreman).toBe('Vince Hintz')
    expect(filters.singleWeekEndDate).toBe('2026-06-27')
    expect(filters.selectedJobIds).toEqual(['job-lucky'])
  })

  it('guards employee creation for read-only, missing job, missing job number, and invalid target states', async () => {
    const readOnly = mountCreateActions({ canEditWeek: false })
    await readOnly.actions.handleAddEmployee(makeEmployee())
    expect(readOnly.resetPageAndSaveMessages).not.toHaveBeenCalled()

    const missingJob = mountCreateActions({ createCardJobId: '' })
    await missingJob.actions.handleAddEmployee(makeEmployee())
    expect(missingJob.setPageErrorMessage).toHaveBeenCalledWith('Select the linked job.')

    const missingJobNumber = mountCreateActions({
      createCardJobOptions: [{ id: 'job-shop', code: '', name: '', label: 'Shop' }],
    })
    await missingJobNumber.actions.handleAddEmployee(makeEmployee())
    expect(missingJobNumber.setPageErrorMessage).toHaveBeenCalledWith('Select a linked job with a job number.')

    const rangeMode = mountCreateActions({ filters: makeFilters({ dateMode: 'range' }) })
    await rangeMode.actions.handleAddEmployee(makeEmployee())
    expect(rangeMode.setPageErrorMessage).toHaveBeenCalledWith('Switch Date Mode to Single before creating cards.')

    expect(createTimecardCardMock).not.toHaveBeenCalled()
  })

  it('adds a trimmed custom card to an existing week and resets the custom form', async () => {
    const {
      actions,
      calls,
      customCardForm,
      resetCustomCardForm,
    } = mountCreateActions()

    await actions.handleAddCustomCard()

    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      {
        employeeNumber: '9001',
        firstName: 'Rocky',
        isContractor: true,
        lastName: 'Rodriguez',
        occupation: 'Foreman',
        wageRate: 42.5,
      },
      7,
      '736',
    )
    expect(resetCustomCardForm).toHaveBeenCalledTimes(1)
    expect(calls).toEqual([
      'reset-messages',
      'sort-index:week-1',
      'expand:card-new',
      'edit:card-new:true',
      'reset-custom',
      'close-tray',
      'scroll:card-new',
    ])
    expect(customCardForm.firstName).toBe('  Rocky  ')
  })

  it('validates custom card required fields, linked job, foreman owner, and wage rules', async () => {
    const missingName = mountCreateActions({
      customCardForm: makeCustomCardForm({ firstName: '   ', lastName: '   ' }),
    })
    await missingName.actions.handleAddCustomCard()
    expect(missingName.setPageErrorMessage).toHaveBeenCalledWith('Enter the card name.')

    const missingForeman = mountCreateActions({
      createCardForemanId: '',
      targetCreateWeek: makeWeek({ id: '' }),
    })
    await missingForeman.actions.handleAddCustomCard()
    expect(missingForeman.setPageErrorMessage).toHaveBeenCalledWith('Select the foreman owner.')

    const invalidWage = mountCreateActions({
      customCardForm: makeCustomCardForm({ wageRate: 'not a number' }),
    })
    await invalidWage.actions.handleAddCustomCard()
    expect(invalidWage.setPageErrorMessage).toHaveBeenCalledWith('Enter a wage amount.')

    const noExportPermission = mountCreateActions({
      canUseTimecardExport: false,
      customCardForm: makeCustomCardForm({ wageRate: 'not a number' }),
    })
    await noExportPermission.actions.handleAddCustomCard()
    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      expect.objectContaining({ wageRate: null }),
      7,
      '736',
    )

    createTimecardCardMock.mockClear()
    const blankWage = mountCreateActions({
      customCardForm: makeCustomCardForm({ wageRate: '   ' }),
    })
    await blankWage.actions.handleAddCustomCard()
    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      expect.objectContaining({ wageRate: null }),
      7,
      '736',
    )
  })

  it('reports employee and custom card creation failures and clears loading state', async () => {
    createTimecardCardMock.mockRejectedValueOnce(new Error('Employee create denied'))
    const employeeCase = mountCreateActions()

    await employeeCase.actions.handleAddEmployee(makeEmployee())

    let [errorArg, fallback] = employeeCase.setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Employee create denied')
    expect(fallback).toBe('Failed to add the employee card.')
    expect(employeeCase.actionLoading.value).toBe(false)

    createTimecardCardMock.mockRejectedValueOnce(new Error('Custom create denied'))
    const customCase = mountCreateActions()

    await customCase.actions.handleAddCustomCard()

    ;[errorArg, fallback] = customCase.setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Custom create denied')
    expect(fallback).toBe('Failed to add the one-off timecard.')
    expect(customCase.actionLoading.value).toBe(false)
  })
})
