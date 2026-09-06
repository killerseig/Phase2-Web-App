import { computed, reactive, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyJobTimecardCustomCardForm } from '@/features/timecards/jobViewHelpers'
import { useJobTimecardCreateActions } from '@/features/timecards/useJobTimecardCreateActions'
import { createTimecardCard } from '@/services/timecards'
import type {
  EmployeeRecord,
  TimecardCardRecord,
  TimecardWeekRecord,
} from '@/types/domain'

vi.mock('@/services/timecards', () => ({
  createTimecardCard: vi.fn(),
}))

const createTimecardCardMock = vi.mocked(createTimecardCard)

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
    ownerForemanUserId: 'user-1',
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
    sortIndex: 4,
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

function mountCreateActions(options: {
  canEditWeek?: boolean
  canManageJobTimecards?: boolean
  cards?: TimecardCardRecord[]
  linkedJobNumber?: string
  selectedWeek?: TimecardWeekRecord | null
  selectedWeekStartDate?: string
} = {}) {
  const actionLoading = ref(false)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [])
  const customCardForm = reactive(createEmptyJobTimecardCustomCardForm())
  const employeeSearchTerm = ref('vince')
  const linkedJobNumber = ref(options.linkedJobNumber ?? '5229')
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const selectedWeekStartDate = ref(options.selectedWeekStartDate ?? '2026-06-14')
  const closeCreateTray = vi.fn()
  const expandAndSelectCard = vi.fn()
  const resetCustomCardForm = vi.fn(() => {
    Object.assign(customCardForm, createEmptyJobTimecardCustomCardForm())
  })
  const resetPageAndSaveMessages = vi.fn()
  const scrollCardIntoView = vi.fn()
  const setPageError = vi.fn()
  const setPageErrorMessage = vi.fn()

  const actions = useJobTimecardCreateActions({
    actionLoading,
    canEditWeek: computed(() => canEditWeek.value),
    cards: computed(() => cards.value),
    closeCreateTray,
    customCardForm,
    employeeSearchTerm,
    expandAndSelectCard,
    getCanManageJobTimecards: () => options.canManageJobTimecards ?? false,
    linkedJobNumber: computed(() => linkedJobNumber.value),
    resetCustomCardForm,
    resetPageAndSaveMessages,
    scrollCardIntoView,
    selectedWeek: computed(() => selectedWeek.value),
    selectedWeekStartDate: computed(() => selectedWeekStartDate.value),
    setPageError,
    setPageErrorMessage,
  })

  return {
    actionLoading,
    actions,
    canEditWeek,
    cards,
    closeCreateTray,
    customCardForm,
    employeeSearchTerm,
    expandAndSelectCard,
    linkedJobNumber,
    resetCustomCardForm,
    resetPageAndSaveMessages,
    scrollCardIntoView,
    selectedWeek,
    selectedWeekStartDate,
    setPageError,
    setPageErrorMessage,
  }
}

describe('useJobTimecardCreateActions', () => {
  beforeEach(() => {
    createTimecardCardMock.mockReset()
    createTimecardCardMock.mockResolvedValue('created-card')
  })

  it('adds an employee card even when that employee already has a card for the week', async () => {
    const existingEmployeeCard = makeCard({
      employeeId: 'employee-1',
      employeeNumber: '5133',
      sortIndex: 7,
    })
    const {
      actionLoading,
      actions,
      closeCreateTray,
      employeeSearchTerm,
      expandAndSelectCard,
      resetPageAndSaveMessages,
      scrollCardIntoView,
    } = mountCreateActions({
      cards: [makeCard({ id: 'older-card', sortIndex: 2 }), existingEmployeeCard],
      linkedJobNumber: '5229',
    })

    await actions.handleAddEmployee(makeEmployee())

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      {
        employeeId: 'employee-1',
        firstName: 'Vince',
        isContractor: false,
        lastName: 'Hintz',
        employeeNumber: '5133',
        occupation: 'Foreman',
        wageRate: null,
      },
      8,
      '5229',
    )
    expect(expandAndSelectCard).toHaveBeenCalledWith('created-card')
    expect(employeeSearchTerm.value).toBe('')
    expect(closeCreateTray).toHaveBeenCalledTimes(1)
    expect(scrollCardIntoView).toHaveBeenCalledWith('created-card')
    expect(actionLoading.value).toBe(false)
  })

  it('does not add employee cards without an editable selected week', async () => {
    const noWeek = mountCreateActions({ selectedWeek: null })
    await noWeek.actions.handleAddEmployee(makeEmployee())

    const readOnly = mountCreateActions({ canEditWeek: false })
    await readOnly.actions.handleAddEmployee(makeEmployee())

    expect(createTimecardCardMock).not.toHaveBeenCalled()
    expect(noWeek.resetPageAndSaveMessages).not.toHaveBeenCalled()
    expect(readOnly.resetPageAndSaveMessages).not.toHaveBeenCalled()
  })

  it('reports employee card creation failures and resets loading state', async () => {
    createTimecardCardMock.mockRejectedValueOnce(new Error('Create denied'))
    const {
      actionLoading,
      actions,
      setPageError,
    } = mountCreateActions()

    await actions.handleAddEmployee(makeEmployee())

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Create denied')
    expect(fallbackMessage).toBe('Failed to add the employee card.')
    expect(actionLoading.value).toBe(false)
  })

  it('validates custom card fields before persistence', async () => {
    const {
      actions,
      resetPageAndSaveMessages,
      setPageErrorMessage,
    } = mountCreateActions()

    await actions.handleAddCustomCard()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(setPageErrorMessage).toHaveBeenCalledWith('Enter the card name.')
    expect(createTimecardCardMock).not.toHaveBeenCalled()
  })

  it('validates custom wage input only for users who can manage job timecards', async () => {
    const manager = mountCreateActions({ canManageJobTimecards: true })
    Object.assign(manager.customCardForm, {
      firstName: 'Custom',
      lastName: 'Worker',
      employeeNumber: 'C-1',
      occupation: 'Helper',
      wageRate: '-1',
    })

    await manager.actions.handleAddCustomCard()

    expect(manager.setPageErrorMessage).toHaveBeenCalledWith('Enter a valid wage amount.')
    expect(createTimecardCardMock).not.toHaveBeenCalled()

    const fieldUser = mountCreateActions({ canManageJobTimecards: false })
    Object.assign(fieldUser.customCardForm, {
      firstName: 'Custom',
      lastName: 'Worker',
      employeeNumber: 'C-1',
      occupation: 'Helper',
      wageRate: '-1',
    })

    await fieldUser.actions.handleAddCustomCard()

    expect(createTimecardCardMock).toHaveBeenCalledTimes(1)
  })

  it('adds a valid custom card with normalized wage, resets the form, and selects the card', async () => {
    const {
      actionLoading,
      actions,
      closeCreateTray,
      customCardForm,
      expandAndSelectCard,
      resetCustomCardForm,
      resetPageAndSaveMessages,
      scrollCardIntoView,
    } = mountCreateActions({
      cards: [makeCard({ sortIndex: 0 }), makeCard({ id: 'card-2', sortIndex: 5 })],
      canManageJobTimecards: true,
      linkedJobNumber: '736',
    })
    Object.assign(customCardForm, {
      firstName: 'Rocky',
      lastName: 'Rodriguez',
      employeeNumber: 'TEMP-1',
      occupation: 'Installer',
      wageRate: ' 42.50 ',
      isContractor: true,
    })

    await actions.handleAddCustomCard()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      {
        firstName: 'Rocky',
        lastName: 'Rodriguez',
        employeeNumber: 'TEMP-1',
        occupation: 'Installer',
        wageRate: 42.5,
        isContractor: true,
      },
      6,
      '736',
    )
    expect(expandAndSelectCard).toHaveBeenCalledWith('created-card')
    expect(resetCustomCardForm).toHaveBeenCalledTimes(1)
    expect(closeCreateTray).toHaveBeenCalledTimes(1)
    expect(scrollCardIntoView).toHaveBeenCalledWith('created-card')
    expect(actionLoading.value).toBe(false)
  })

  it('adds a minimal custom card without requiring employee-only fields', async () => {
    const {
      actions,
      customCardForm,
    } = mountCreateActions({
      canManageJobTimecards: false,
      linkedJobNumber: '736',
    })
    Object.assign(customCardForm, {
      firstName: 'Overflow',
      lastName: '',
      employeeNumber: '',
      occupation: '',
      wageRate: '',
      isContractor: false,
    })

    await actions.handleAddCustomCard()

    expect(createTimecardCardMock).toHaveBeenCalledWith(
      'week-1',
      '2026-06-14',
      {
        firstName: 'Overflow',
        lastName: '',
        employeeNumber: '',
        occupation: '',
        wageRate: null,
        isContractor: false,
      },
      0,
      '736',
    )
  })

  it('does not add custom cards without an editable selected week', async () => {
    const noWeek = mountCreateActions({ selectedWeek: null })
    Object.assign(noWeek.customCardForm, {
      firstName: 'Custom',
      lastName: 'Worker',
      employeeNumber: 'C-1',
      occupation: 'Helper',
    })

    await noWeek.actions.handleAddCustomCard()

    const readOnly = mountCreateActions({ canEditWeek: false })
    Object.assign(readOnly.customCardForm, {
      firstName: 'Custom',
      lastName: 'Worker',
      employeeNumber: 'C-1',
      occupation: 'Helper',
    })

    await readOnly.actions.handleAddCustomCard()

    expect(createTimecardCardMock).not.toHaveBeenCalled()
  })

  it('reports custom card creation failures and resets loading state', async () => {
    createTimecardCardMock.mockRejectedValueOnce(new Error('Custom denied'))
    const {
      actionLoading,
      actions,
      customCardForm,
      setPageError,
    } = mountCreateActions()
    Object.assign(customCardForm, {
      firstName: 'Custom',
      lastName: 'Worker',
      employeeNumber: 'C-1',
      occupation: 'Helper',
    })

    await actions.handleAddCustomCard()

    const [errorArg, fallbackMessage] = setPageError.mock.calls[0]!
    expect(errorArg).toBeInstanceOf(Error)
    expect((errorArg as Error).message).toBe('Custom denied')
    expect(fallbackMessage).toBe('Failed to add the one-off timecard.')
    expect(actionLoading.value).toBe(false)
  })
})
