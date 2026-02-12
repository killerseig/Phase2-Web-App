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

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => {
  const addDoc = vi.fn()
  const getDocs = vi.fn()
  const updateDoc = vi.fn()
  const orderBy = vi.fn((field: string, dir?: any) => ({ field, dir }))
  const where = vi.fn((field: string, op: any, value: any) => ({ field, op, value }))
  const collection = vi.fn((_db: any, path: string, jobId?: string, coll?: string) => ({ path, jobId, coll }))
  const doc = vi.fn((_db: any, path: string, jobId?: string, coll?: string, id?: string) => ({ path, jobId, coll, id }))
  const query = vi.fn((col: any, ...constraints: any[]) => ({ col, constraints }))
  const limit = vi.fn((n: number) => ({ limit: n }))
  const serverTimestamp = vi.fn(() => 'ts')

  return {
    addDoc,
    getDocs,
    updateDoc,
    orderBy,
    where,
    collection,
    doc,
    query,
    limit,
    serverTimestamp,
  }
})

vi.mock('@/services/serviceGuards', () => ({
  assertJobAccess: vi.fn(),
  requireUser: vi.fn(),
}))

type MockFn = ReturnType<typeof vi.fn>
const addDocMock = addDoc as unknown as MockFn
const getDocsMock = getDocs as unknown as MockFn
const updateDocMock = updateDoc as unknown as MockFn
const requireUserMock = requireUser as unknown as MockFn

const snap = (docs: Array<{ id: string; data: any }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
})

describe('ShopOrders service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserMock.mockReturnValue({ uid: 'user-1' })
  })

  it('merges orders across scopes and sorts by orderDate desc', async () => {
    getDocsMock
      .mockResolvedValueOnce(
        snap([
          { id: 'draft', data: { uid: 'scope:employee', orderDate: { toMillis: () => 100 } } },
        ])
      )
      .mockResolvedValueOnce(
        snap([
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
    const [, payload] = addDocMock.mock.calls[0]
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
    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ items: [{ description: 'Item', quantity: 1 }], updatedAt: 'ts' })
  })

  it('updates status and stamps updatedAt', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateShopOrderStatus('job-1', 'order-1', 'order')

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ status: 'order', updatedAt: 'ts' })
  })
})
