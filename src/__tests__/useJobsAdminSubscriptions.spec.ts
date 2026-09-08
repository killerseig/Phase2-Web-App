import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobsAdminSubscriptions } from '@/features/jobs/useJobsAdminSubscriptions'
import { subscribeGlobalNotificationRecipients } from '@/services/jobs'
import { subscribeAssignableUsers } from '@/services/users'
import type { GlobalNotificationRecipients, UserProfile } from '@/types/domain'

vi.mock('@/services/jobs', () => ({
  subscribeGlobalNotificationRecipients: vi.fn(),
}))

vi.mock('@/services/users', () => ({
  subscribeAssignableUsers: vi.fn(),
}))

const subscribeGlobalNotificationRecipientsMock = vi.mocked(subscribeGlobalNotificationRecipients)
const subscribeAssignableUsersMock = vi.mocked(subscribeAssignableUsers)

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    active: true,
    assignedJobIds: [],
    email: 'foreman@example.com',
    firstName: 'Chris',
    id: 'user-1',
    lastName: 'Foreman',
    role: 'foreman',
    ...overrides,
  }
}

function makeRecipients(
  overrides: Partial<GlobalNotificationRecipients> = {},
): GlobalNotificationRecipients {
  return {
    dailyLogs: ['daily@example.com'],
    shopOrders: ['shop@example.com'],
    timecards: ['time@example.com'],
    newJobs: ['jobs@example.com'],
    fieldUserAssignments: ['assignments@example.com'],
    ...overrides,
  }
}

function mountAdminSubscriptions(
  options: {
    canLoadAssignableUsers?: boolean
    canManageGlobalRecipients?: boolean
  } = {},
) {
  const canLoadAssignableUsers = ref(options.canLoadAssignableUsers ?? true)
  const canManageGlobalRecipients = ref(options.canManageGlobalRecipients ?? true)
  const detailErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const subscriptions = useJobsAdminSubscriptions({
    getCanLoadAssignableUsers: () => canLoadAssignableUsers.value,
    getCanManageGlobalRecipients: () => canManageGlobalRecipients.value,
    setDetailError: (error, fallbackMessage) => detailErrors.push({ error, fallbackMessage }),
  })

  return {
    canLoadAssignableUsers,
    canManageGlobalRecipients,
    detailErrors,
    subscriptions,
  }
}

describe('useJobsAdminSubscriptions', () => {
  beforeEach(() => {
    subscribeGlobalNotificationRecipientsMock.mockReset()
    subscribeAssignableUsersMock.mockReset()
  })

  it('does not start editor subscriptions when the user cannot use job setup', () => {
    const { subscriptions } = mountAdminSubscriptions({
      canLoadAssignableUsers: false,
      canManageGlobalRecipients: false,
    })

    subscriptions.startAdminSubscriptions()

    expect(subscribeAssignableUsersMock).not.toHaveBeenCalled()
    expect(subscribeGlobalNotificationRecipientsMock).not.toHaveBeenCalled()
    expect(subscriptions.usersLoading.value).toBe(false)
  })

  it('can load assignable users without loading all-jobs recipient defaults', () => {
    const stopUsers = vi.fn()
    subscribeAssignableUsersMock.mockReturnValue(stopUsers)
    const { subscriptions } = mountAdminSubscriptions({
      canLoadAssignableUsers: true,
      canManageGlobalRecipients: false,
    })

    subscriptions.startAdminSubscriptions()

    expect(subscribeAssignableUsersMock).toHaveBeenCalledTimes(1)
    expect(subscribeGlobalNotificationRecipientsMock).not.toHaveBeenCalled()
  })

  it('starts user and all-jobs recipient listeners for full job managers and accepts updates', () => {
    const stopUsers = vi.fn()
    const stopRecipients = vi.fn()
    let emitUsers: (users: UserProfile[]) => void = () => {}
    let emitRecipients: (recipients: GlobalNotificationRecipients) => void = () => {}
    subscribeAssignableUsersMock.mockImplementation((next) => {
      emitUsers = next
      return stopUsers
    })
    subscribeGlobalNotificationRecipientsMock.mockImplementation((next) => {
      emitRecipients = next
      return stopRecipients
    })
    const { subscriptions } = mountAdminSubscriptions()

    expect(subscriptions.usersLoading.value).toBe(false)

    subscriptions.startAdminSubscriptions()

    expect(subscribeAssignableUsersMock).toHaveBeenCalledTimes(1)
    expect(subscribeGlobalNotificationRecipientsMock).toHaveBeenCalledTimes(1)
    expect(subscriptions.usersLoading.value).toBe(true)

    emitUsers([makeUser({ id: 'user-cj', email: 'cj@example.com' })])
    emitRecipients(makeRecipients({ shopOrders: ['shop-orders@example.com'] }))

    expect(subscriptions.users.value).toEqual([
      expect.objectContaining({ id: 'user-cj', email: 'cj@example.com' }),
    ])
    expect(subscriptions.usersLoading.value).toBe(false)
    expect(subscriptions.usersError.value).toBe('')
    expect(subscriptions.globalNotificationRecipients.value).toEqual({
      dailyLogs: ['daily@example.com'],
      fieldUserAssignments: ['assignments@example.com'],
      newJobs: ['jobs@example.com'],
      shopOrders: ['shop-orders@example.com'],
      timecards: ['time@example.com'],
    })
    expect(stopUsers).not.toHaveBeenCalled()
    expect(stopRecipients).not.toHaveBeenCalled()
  })

  it('stops active listeners and replaces them cleanly on restart', () => {
    const firstStopUsers = vi.fn()
    const secondStopUsers = vi.fn()
    const firstStopRecipients = vi.fn()
    const secondStopRecipients = vi.fn()
    subscribeAssignableUsersMock
      .mockReturnValueOnce(firstStopUsers)
      .mockReturnValueOnce(secondStopUsers)
    subscribeGlobalNotificationRecipientsMock
      .mockReturnValueOnce(firstStopRecipients)
      .mockReturnValueOnce(secondStopRecipients)
    const { subscriptions } = mountAdminSubscriptions()

    subscriptions.startAdminSubscriptions()
    subscriptions.startAdminSubscriptions()

    expect(firstStopUsers).toHaveBeenCalledTimes(1)
    expect(firstStopRecipients).toHaveBeenCalledTimes(1)
    expect(secondStopUsers).not.toHaveBeenCalled()
    expect(secondStopRecipients).not.toHaveBeenCalled()

    subscriptions.stopAdminSubscriptions()

    expect(secondStopUsers).toHaveBeenCalledTimes(1)
    expect(secondStopRecipients).toHaveBeenCalledTimes(1)
  })

  it('normalizes user listener errors and forwards global recipient listener errors to detail messages', () => {
    const recipientError = new Error('All-jobs listener failed')
    const permissionError = new Error('Permission denied') as Error & { code: string }
    permissionError.code = 'firestore/permission-denied'
    let emitUserError: (error: unknown) => void = () => {}
    let emitRecipientError: (error: unknown) => void = () => {}
    subscribeAssignableUsersMock.mockImplementation((_next, error) => {
      emitUserError = error ?? (() => {})
      return vi.fn()
    })
    subscribeGlobalNotificationRecipientsMock.mockImplementation((_next, error) => {
      emitRecipientError = error ?? (() => {})
      return vi.fn()
    })
    const { detailErrors, subscriptions } = mountAdminSubscriptions()

    subscriptions.startAdminSubscriptions()
    emitUserError(permissionError)
    emitRecipientError(recipientError)

    expect(subscriptions.usersError.value).toBe(
      'Permission denied. Your account may not have access yet, or Firestore rules may still need to be deployed.',
    )
    expect(subscriptions.usersLoading.value).toBe(false)
    expect(detailErrors).toEqual([
      { error: recipientError, fallbackMessage: 'Failed to load all-jobs recipients.' },
    ])
    expect(subscriptions.globalNotificationRecipients.value).toEqual({
      dailyLogs: [],
      fieldUserAssignments: [],
      newJobs: [],
      shopOrders: [],
      timecards: [],
    })
  })
})
