import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUsersStore } from '@/stores/users'
import { ROLES } from '@/constants/app'

vi.mock('@/services', () => ({
  assignJobToForeman: vi.fn(),
  createUserByAdmin: vi.fn(),
  deleteUser: vi.fn(),
  getMyUserProfile: vi.fn(),
  listUsers: vi.fn(),
  removeJobFromForeman: vi.fn(),
  setForemanJobs: vi.fn(),
  subscribeUserProfile: vi.fn(),
  subscribeUsers: vi.fn(),
  syncForemanAssignmentsForJob: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logError: vi.fn(),
}))

import {
  createUserByAdmin as createUserByAdminService,
  listUsers as listUsersService,
} from '@/services'

const createUserByAdminMock = createUserByAdminService as unknown as ReturnType<typeof vi.fn>
const listUsersMock = listUsersService as unknown as ReturnType<typeof vi.fn>

describe('users store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates a user and refreshes the user list', async () => {
    const store = useUsersStore()
    createUserByAdminMock.mockResolvedValue({ success: true, message: 'ok', uid: 'user-1' })
    listUsersMock.mockResolvedValue([
      {
        id: 'user-1',
        email: 'casey@example.com',
        firstName: 'Casey',
        lastName: 'Stone',
        role: ROLES.ADMIN,
        active: true,
        assignedJobIds: [],
      },
    ])

    const result = await store.createUser('casey@example.com', 'Casey', 'Stone', ROLES.ADMIN)

    expect(result).toMatchObject({ uid: 'user-1', success: true })
    expect(createUserByAdminMock).toHaveBeenCalledWith('casey@example.com', 'Casey', 'Stone', ROLES.ADMIN)
    expect(listUsersMock).toHaveBeenCalled()
    expect(store.users).toHaveLength(1)
    expect(store.users[0]).toMatchObject({
      email: 'casey@example.com',
      role: ROLES.ADMIN,
    })
    expect(store.error).toBeNull()
  })

  it('stores an error and rethrows when create fails', async () => {
    const store = useUsersStore()
    createUserByAdminMock.mockRejectedValue(new Error('permission denied'))

    await expect(store.createUser('casey@example.com', 'Casey', 'Stone', ROLES.ADMIN)).rejects.toThrow('permission denied')

    expect(store.error).toBe('permission denied')
    expect(listUsersMock).not.toHaveBeenCalled()
  })
})
