import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createShopOrder,
  updateShopOrderItems,
  updateShopOrderStatus,
} from '@/services/ShopOrders'
import {
  addDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { requireUser } from '@/services/serviceGuards'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn
const requireUserMock = requireUser as unknown as MockFn

describe('ShopOrders service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockReturnValue({ uid: 'user-1' })
  })

  it('creates a shop order with the legacy scope marker and owner', async () => {
    addDocMock.mockResolvedValue({ id: 'order-1' })

    const id = await createShopOrder('job-1')

    expect(id).toBe('order-1')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({
      jobId: 'job-1',
      uid: 'scope:employee',
      ownerUid: 'user-1',
      status: 'draft',
    })
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('updates items and stamps updatedAt', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateShopOrderItems('job-1', 'order-1', [{ description: 'Item', quantity: 1 }])

    expect(updateDocMock).toHaveBeenCalledTimes(1)
    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({ items: [{ description: 'Item', quantity: 1 }], updatedAt: 'ts' })
  })

  it('updates status and stamps updatedAt', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateShopOrderStatus('job-1', 'order-1', 'order')

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({ status: 'order', updatedAt: 'ts' })
  })
})


