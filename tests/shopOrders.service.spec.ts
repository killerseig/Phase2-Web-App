import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createShopOrder,
  listShopOrders,
  updateShopOrderItems,
  updateShopOrderStatus,
} from '@/services/ShopOrders'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { requireUser } from '@/services/serviceGuards'
import { makeQuerySnapshot } from './helpers/firestoreMocks'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn
const requireUserMock = requireUser as unknown as MockFn

describe('ShopOrders service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockReturnValue({ uid: 'user-1' })
  })

  it('merges orders across scopes and sorts by orderDate desc', async () => {
    getDocsMock
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          { id: 'draft', data: { uid: 'scope:employee', orderDate: { toMillis: () => 100 } } },
        ])
      )
      .mockResolvedValueOnce(
        makeQuerySnapshot([
          { id: 'admin', data: { uid: 'scope:admin', orderDate: { toMillis: () => 200 } } },
        ])
      )

    const result = await listShopOrders('job-1', ['scope:employee', 'scope:admin'])

    expect(result.map((o) => o.id)).toEqual(['admin', 'draft'])
    expect(getDocsMock).toHaveBeenCalledTimes(2)
  })

  it('creates a shop order with scope and owner', async () => {
    addDocMock.mockResolvedValue({ id: 'order-1' })

    const id = await createShopOrder('job-1', 'scope:shop')

    expect(id).toBe('order-1')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({
      jobId: 'job-1',
      uid: 'scope:shop',
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


