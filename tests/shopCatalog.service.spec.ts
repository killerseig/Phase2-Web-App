import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  archiveCategory,
  createCatalogItem,
  listCatalog,
  updateCatalogItem,
} from '@/services/ShopCatalog'
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => {
  const addDoc = vi.fn()
  const getDocs = vi.fn()
  const updateDoc = vi.fn()
  const deleteDoc = vi.fn()
  const orderBy = vi.fn((field: string, dir?: any) => ({ field, dir }))
  const where = vi.fn((field: string, op: any, value: any) => ({ field, op, value }))
  const collection = vi.fn((_db: any, path: string) => ({ path }))
  const doc = vi.fn((_db: any, path: string, id?: string) => ({ path, id }))
  const query = vi.fn((col: any, ...constraints: any[]) => ({ col, constraints }))
  const serverTimestamp = vi.fn(() => 'ts')

  return {
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    orderBy,
    where,
    collection,
    doc,
    query,
    serverTimestamp,
  }
})

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>

const snap = (docs: Array<{ id: string; data: any }>) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
})

describe('ShopCatalog service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists catalog with active-only filter', async () => {
    getDocsMock.mockResolvedValue(
      snap([
        { id: '1', data: { description: 'A', active: true } },
      ])
    )

    const items = await listCatalog(true)

    expect(getDocsMock).toHaveBeenCalledTimes(1)
    const constraints = (query as any).mock.calls[0].slice(1)
    expect(constraints.some((c: any) => c.field === 'active')).toBe(true)
    expect(items[0].id).toBe('1')
  })

  it('creates catalog item with trims and timestamps', async () => {
    addDocMock.mockResolvedValue({ id: 'cat-1' })

    const id = await createCatalogItem('  Widget  ', 'cat', '  SKU  ', 10)

    expect(id).toBe('cat-1')
    const [, payload] = addDocMock.mock.calls[0]
    expect(payload).toMatchObject({ description: 'Widget', categoryId: 'cat', sku: 'SKU', price: 10, active: true })
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('filters undefined fields on update and stamps updatedAt', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateCatalogItem('item-1', { description: 'New', sku: undefined })

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ description: 'New', updatedAt: 'ts' })
    expect(payload).not.toHaveProperty('sku')
  })

  it('archives category by setting active false', async () => {
    await archiveCategory('cat-1')

    const [, payload] = updateDocMock.mock.calls[0]
    expect(payload).toMatchObject({ active: false, updatedAt: 'ts' })
  })
})
