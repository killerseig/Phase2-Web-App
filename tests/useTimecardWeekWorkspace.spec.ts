import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { ROLES, type Role } from '@/constants/app'
import { useTimecardWeekWorkspace } from '@/composables/timecards/useTimecardWeekWorkspace'
import { useAuthStore } from '@/stores/auth'

const {
  ensureWeekTimecardsForActiveRosterMock,
  getForemanTimecardWorkspaceMock,
  subscribeRosterEmployeesMock,
  watchWorkspaceTimecardsByWeekMock,
} = vi.hoisted(() => ({
  ensureWeekTimecardsForActiveRosterMock: vi.fn(),
  getForemanTimecardWorkspaceMock: vi.fn(),
  subscribeRosterEmployeesMock: vi.fn(),
  watchWorkspaceTimecardsByWeekMock: vi.fn(),
}))

vi.mock('@/services/JobRoster', () => ({
  subscribeRosterEmployees: subscribeRosterEmployeesMock,
}))

vi.mock('@/services/Timecards', () => ({
  ensureWeekTimecardsForActiveRoster: ensureWeekTimecardsForActiveRosterMock,
  watchWorkspaceTimecardsByWeek: watchWorkspaceTimecardsByWeekMock,
}))

vi.mock('@/services/ForemanTimecards', () => ({
  getForemanTimecardWorkspace: getForemanTimecardWorkspaceMock,
}))

function createWorkspace(role: Role = ROLES.ADMIN) {
  const auth = useAuthStore()
  auth.role = role

  const subscriptions = {
    replace: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  }

  const workspace = useTimecardWeekWorkspace({
    jobId: computed(() => 'job-1'),
    weekEndingDate: computed(() => '2026-02-28'),
    subscriptions,
    recalcTotals: vi.fn(),
  })

  return {
    subscriptions,
    workspace,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

beforeEach(() => {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.role = ROLES.ADMIN
})

describe('useTimecardWeekWorkspace', () => {
  it('subscribes to roster + workspace timecards and selects the first active employee', async () => {
    subscribeRosterEmployeesMock.mockImplementation((_jobId, onUpdate) => {
      onUpdate([
        {
          id: 'roster-1',
          jobId: 'job-1',
          employeeNumber: '8060',
          firstName: 'Anselmo',
          lastName: 'Gutierrez',
          occupation: 'Framer',
          contractor: { name: 'TERM', category: 'Labor' },
          active: true,
        },
        {
          id: 'roster-2',
          jobId: 'job-1',
          employeeNumber: '9000',
          firstName: 'Inactive',
          lastName: 'Person',
          occupation: 'Laborer',
          active: false,
        },
      ])
      return vi.fn()
    })
    watchWorkspaceTimecardsByWeekMock.mockImplementation((_jobId, _weekEnding, onUpdate) => {
      onUpdate([
        {
          id: 'tc-1',
          jobId: 'job-1',
          weekStartDate: '2026-02-22',
          weekEndingDate: '2026-02-28',
          status: 'draft',
          createdByUid: 'u1',
          employeeRosterId: 'roster-1',
          employeeNumber: '8060',
          employeeName: 'Anselmo Gutierrez',
          firstName: 'Anselmo',
          lastName: 'Gutierrez',
          occupation: 'Framer',
          employeeWage: 30,
          subcontractedEmployee: true,
          jobs: [],
          days: [],
          totals: {
            hours: [0, 0, 0, 0, 0, 0, 0],
            production: [0, 0, 0, 0, 0, 0, 0],
            hoursTotal: 16,
            productionTotal: 39,
            lineTotal: 0,
          },
          notes: '',
          archived: false,
        },
      ])
      return vi.fn()
    })
    ensureWeekTimecardsForActiveRosterMock.mockResolvedValue({
      activeEmployeeCount: 1,
      existingTimecardCount: 1,
      createdIds: [],
    })

    const { workspace, subscriptions } = createWorkspace()
    await workspace.init()

    expect(subscriptions.replace).toHaveBeenCalledTimes(4)
    expect(subscriptions.replace).toHaveBeenNthCalledWith(1, 'timecard-week-workspace-roster', null)
    expect(subscriptions.replace).toHaveBeenNthCalledWith(2, 'timecard-week-workspace-cards', null)
    expect(ensureWeekTimecardsForActiveRosterMock).toHaveBeenCalledWith('job-1', '2026-02-28')
    expect(workspace.employeeItems.value).toHaveLength(1)
    expect(workspace.employeeItems.value[0]).toMatchObject({
      employeeId: 'roster-1',
      timecardId: 'tc-1',
      status: 'draft',
      subcontractedEmployee: true,
      hoursTotal: 16,
      productionTotal: 39,
    })
    expect(workspace.selectedEmployeeId.value).toBe('roster-1')
    expect(workspace.selectedTimecard.value?.id).toBe('tc-1')
    expect(workspace.loading.value).toBe(false)
  })

  it('filters by search term and marks missing cards before coverage completes', async () => {
    subscribeRosterEmployeesMock.mockImplementation((_jobId, onUpdate) => {
      onUpdate([
        {
          id: 'roster-1',
          jobId: 'job-1',
          employeeNumber: '8060',
          firstName: 'Anselmo',
          lastName: 'Gutierrez',
          occupation: 'Framer',
          active: true,
        },
        {
          id: 'roster-2',
          jobId: 'job-1',
          employeeNumber: '8123',
          firstName: 'Juan',
          lastName: 'Aranda',
          occupation: 'Rocker',
          active: true,
        },
      ])
      return vi.fn()
    })
    watchWorkspaceTimecardsByWeekMock.mockImplementation((_jobId, _weekEnding, onUpdate) => {
      onUpdate([])
      return vi.fn()
    })
    ensureWeekTimecardsForActiveRosterMock.mockResolvedValue({
      activeEmployeeCount: 2,
      existingTimecardCount: 0,
      createdIds: ['tc-1', 'tc-2'],
    })

    const { workspace } = createWorkspace()
    await workspace.init()

    expect(workspace.employeeItems.value.map((item) => item.status)).toEqual(['missing', 'missing'])

    workspace.searchTerm.value = 'aranda'
    expect(workspace.filteredEmployeeItems.value).toHaveLength(1)
    expect(workspace.filteredEmployeeItems.value[0]?.employeeId).toBe('roster-2')
    expect(workspace.selectedEmployeeId.value).toBe('roster-2')
  })

  it('re-runs coverage when the active roster changes and a new employee is missing a card', async () => {
    let pushRoster: ((employees: Array<Record<string, unknown>>) => void) | null = null

    subscribeRosterEmployeesMock.mockImplementation((_jobId, onUpdate) => {
      pushRoster = onUpdate
      onUpdate([
        {
          id: 'roster-1',
          jobId: 'job-1',
          employeeNumber: '8060',
          firstName: 'Anselmo',
          lastName: 'Gutierrez',
          occupation: 'Framer',
          active: true,
        },
      ])
      return vi.fn()
    })

    watchWorkspaceTimecardsByWeekMock.mockImplementation((_jobId, _weekEnding, onUpdate) => {
      onUpdate([
        {
          id: 'tc-1',
          jobId: 'job-1',
          weekStartDate: '2026-02-22',
          weekEndingDate: '2026-02-28',
          status: 'draft',
          createdByUid: 'u1',
          employeeRosterId: 'roster-1',
          employeeNumber: '8060',
          employeeName: 'Anselmo Gutierrez',
          firstName: 'Anselmo',
          lastName: 'Gutierrez',
          occupation: 'Framer',
          employeeWage: 30,
          subcontractedEmployee: false,
          jobs: [],
          days: [],
          totals: {
            hours: [0, 0, 0, 0, 0, 0, 0],
            production: [0, 0, 0, 0, 0, 0, 0],
            hoursTotal: 0,
            productionTotal: 0,
            lineTotal: 0,
          },
          notes: '',
          archived: false,
        },
      ])
      return vi.fn()
    })

    ensureWeekTimecardsForActiveRosterMock.mockResolvedValue({
      activeEmployeeCount: 1,
      existingTimecardCount: 1,
      createdIds: [],
    })

    const { workspace } = createWorkspace()
    await workspace.init()

    expect(ensureWeekTimecardsForActiveRosterMock).toHaveBeenCalledTimes(1)

    const pushRosterUpdate = pushRoster as ((employees: Array<Record<string, unknown>>) => void) | null
    if (pushRosterUpdate) {
      pushRosterUpdate([
        {
          id: 'roster-1',
          jobId: 'job-1',
          employeeNumber: '8060',
          firstName: 'Anselmo',
          lastName: 'Gutierrez',
          occupation: 'Framer',
          active: true,
        },
        {
          id: 'roster-2',
          jobId: 'job-1',
          employeeNumber: '9001',
          firstName: 'Mateo',
          lastName: 'Silva',
          occupation: 'Laborer',
          active: true,
        },
      ])
    }

    await nextTick()
    await Promise.resolve()

    expect(ensureWeekTimecardsForActiveRosterMock).toHaveBeenCalledTimes(2)
    expect(ensureWeekTimecardsForActiveRosterMock).toHaveBeenLastCalledWith('job-1', '2026-02-28')
  })

  it('loads the sanitized callable workspace for foremen instead of subscribing to Firestore', async () => {
    getForemanTimecardWorkspaceMock.mockResolvedValue({
      rosterEmployees: [
        {
          id: 'roster-1',
          jobId: 'job-1',
          employeeNumber: '9001',
          firstName: 'Mateo',
          lastName: 'Silva',
          occupation: 'Laborer',
          active: true,
        },
      ],
      timecards: [
        {
          id: 'tc-1',
          jobId: 'job-1',
          weekStartDate: '2026-02-22',
          weekEndingDate: '2026-02-28',
          status: 'draft',
          createdByUid: '',
          employeeRosterId: 'roster-1',
          employeeNumber: '9001',
          employeeName: 'Mateo Silva',
          firstName: 'Mateo',
          lastName: 'Silva',
          occupation: 'Laborer',
          employeeWage: null,
          subcontractedEmployee: false,
          jobs: [],
          days: [],
          totals: {
            hours: [0, 0, 0, 0, 0, 0, 0],
            production: [0, 0, 0, 0, 0, 0, 0],
            hoursTotal: 0,
            productionTotal: 0,
            lineTotal: 0,
          },
          notes: '',
          archived: false,
        },
      ],
    })

    const { workspace, subscriptions } = createWorkspace(ROLES.FOREMAN)
    await workspace.init()

    expect(getForemanTimecardWorkspaceMock).toHaveBeenCalledWith('job-1', '2026-02-28')
    expect(subscriptions.replace).toHaveBeenNthCalledWith(1, 'timecard-week-workspace-roster', null)
    expect(subscriptions.replace).toHaveBeenNthCalledWith(2, 'timecard-week-workspace-cards', null)
    expect(subscribeRosterEmployeesMock).not.toHaveBeenCalled()
    expect(watchWorkspaceTimecardsByWeekMock).not.toHaveBeenCalled()
    expect(ensureWeekTimecardsForActiveRosterMock).not.toHaveBeenCalled()
    expect(workspace.employeeItems.value[0]).toMatchObject({
      employeeId: 'roster-1',
      timecardId: 'tc-1',
      status: 'draft',
    })
  })
})
