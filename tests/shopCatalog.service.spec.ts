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
import { makeQuerySnapshot } from './helpers/firestoreMocks'


vi.mock('@/firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', async () => (await import('./helpers/firestoreMocks')).createFirestoreMocks())

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>

describe('ShopCatalog service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists catalog with active-only filter', async () => {
    getDocsMock.mockResolvedValue(
      makeQuerySnapshot([
        { id: '1', data: { description: 'A', active: true } },
      ])
    )

    const items = await listCatalog(true)

    expect(getDocsMock).toHaveBeenCalledTimes(1)
    const queryMock = query as unknown as ReturnType<typeof vi.fn>
    const constraints = (queryMock.mock.calls[0] ?? []).slice(1) as Array<{ field?: string }>
    expect(constraints.some((c) => c.field === 'active')).toBe(true)
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('1')
  })

  it('creates catalog item with trims and timestamps', async () => {
    addDocMock.mockResolvedValue({ id: 'cat-1' })

    const id = await createCatalogItem('  Widget  ', 'cat', '  SKU  ', 10)

    expect(id).toBe('cat-1')
    const addDocCall = addDocMock.mock.calls[0]
    expect(addDocCall).toBeDefined()
    const [, payload] = addDocCall!
    expect(payload).toMatchObject({ description: 'Widget', categoryId: 'cat', sku: 'SKU', price: 10, active: true })
    expect(serverTimestamp).toHaveBeenCalled()
  })

  it('filters undefined fields on update and stamps updatedAt', async () => {
    updateDocMock.mockResolvedValue(undefined)

    await updateCatalogItem('item-1', { description: 'New', sku: undefined })

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({ description: 'New', updatedAt: 'ts' })
    expect(payload).not.toHaveProperty('sku')
  })

  it('archives category by setting active false', async () => {
    await archiveCategory('cat-1')

    const updateCall = updateDocMock.mock.calls[0]
    expect(updateCall).toBeDefined()
    const [, payload] = updateCall!
    expect(payload).toMatchObject({ active: false, updatedAt: 'ts' })
  })
})


