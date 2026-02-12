import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assignJobToForeman,
  createUserByAdmin,
  updateUser,
} from '@/services/Users'
import {
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'

vi.mock('@/firebase', () => ({ db: {}, functions: {} }))

vi.mock('firebase/firestore', () => {
  const getDoc = vi.fn()
  const updateDoc = vi.fn()
  const doc = vi.fn((_db: any, path: string, id?: string) => ({ path, id }))
  return { getDoc, updateDoc, doc }
})

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}))

vi.mock('@/services/serviceGuards', () => ({
  requireUser: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const getDocMock = getDoc as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn
const httpsCallableMock = httpsCallable as unknown as MockFn

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Users service', () => {
  it('updates only provided user fields', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateUser('u1', { firstName: 'Jane', active: false })

    expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), {
      firstName: 'Jane',
      active: false,
    })
  })

  it('assigns job to foreman by appending when missing', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ assignedJobIds: ['a'] }) })
    updateDocMock.mockResolvedValue(undefined)

    await assignJobToForeman('f1', 'b')

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload.assignedJobIds).toEqual(['a', 'b'])
  })

  it('calls cloud function to create user', async () => {
    const callable = vi.fn().mockResolvedValue({ data: { success: true, uid: 'u1', message: 'ok' } })
    httpsCallableMock.mockReturnValue(callable)

    const result = await createUserByAdmin('a@b.com', 'A', 'B', 'admin')

    expect(httpsCallableMock).toHaveBeenCalled()
    expect(callable).toHaveBeenCalledWith({ email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'admin' })
    expect(result.uid).toBe('u1')
  })
})
