import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUserService } from '@/services/useUserService'
import { httpsCallable } from 'firebase/functions'

vi.mock('@/firebase', () => ({ functions: {} }))

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

const httpsCallableMock = httpsCallable as unknown as ReturnType<typeof vi.fn>

describe('useUserService', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy?.mockRestore()
    consoleErrorSpy = null
  })

  it('creates a user via callable', async () => {
    const createFn = vi.fn().mockResolvedValue({ data: { success: true, message: 'ok', uid: 'u123' } })
    httpsCallableMock.mockReturnValue(createFn)

    const { createUserByAdmin, isLoading, error } = useUserService()
    const result = await createUserByAdmin({ email: 'a@test.com', firstName: 'A', lastName: 'B', role: 'employee' })

    expect(result).toEqual({ success: true, message: 'ok', uid: 'u123' })
    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'createUserByAdmin')
    expect(createFn).toHaveBeenCalledWith({
      email: 'a@test.com',
      firstName: 'A',
      lastName: 'B',
      role: 'employee',
    })
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('propagates create user errors', async () => {
    const createFn = vi.fn().mockRejectedValue(new Error('fail'))
    httpsCallableMock.mockReturnValue(createFn)

    const { createUserByAdmin, isLoading, error } = useUserService()

    await expect(createUserByAdmin({ email: 'a@test.com', firstName: 'A', lastName: 'B' })).rejects.toThrow('fail')
    expect(error.value).toBe('fail')
    expect(isLoading.value).toBe(false)
  })

  it('deletes a user via callable', async () => {
    const deleteFn = vi.fn().mockResolvedValue({ data: { success: true, message: 'deleted' } })
    httpsCallableMock.mockReturnValue(deleteFn)

    const { deleteUser, isLoading, error } = useUserService()
    const result = await deleteUser('u1')

    expect(result).toEqual({ success: true, message: 'deleted' })
    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'deleteUser')
    expect(deleteFn).toHaveBeenCalledWith({ uid: 'u1' })
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('propagates delete user errors', async () => {
    const deleteFn = vi.fn().mockRejectedValue(new Error('remove-fail'))
    httpsCallableMock.mockReturnValue(deleteFn)

    const { deleteUser, error, isLoading } = useUserService()

    await expect(deleteUser('u2')).rejects.toThrow('remove-fail')
    expect(error.value).toBe('remove-fail')
    expect(isLoading.value).toBe(false)
  })
})
