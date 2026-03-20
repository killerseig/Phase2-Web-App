import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useShopCatalogStore } from '@/stores/shopCatalog'

vi.mock('@/services', () => ({
  createCatalogItem: vi.fn(),
  deleteCatalogItem: vi.fn(),
  listCatalog: vi.fn(),
  setCatalogItemActive: vi.fn(),
  subscribeCatalog: vi.fn(),
  updateCatalogItem: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logError: vi.fn(),
}))

import {
  createCatalogItem as createCatalogItemService,
  deleteCatalogItem as deleteCatalogItemService,
  setCatalogItemActive as setCatalogItemActiveService,
  updateCatalogItem as updateCatalogItemService,
} from '@/services'

const createCatalogItemMock = createCatalogItemService as unknown as ReturnType<typeof vi.fn>
const deleteCatalogItemMock = deleteCatalogItemService as unknown as ReturnType<typeof vi.fn>
const setCatalogItemActiveMock = setCatalogItemActiveService as unknown as ReturnType<typeof vi.fn>
const updateCatalogItemMock = updateCatalogItemService as unknown as ReturnType<typeof vi.fn>

function createDeferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('shopCatalog store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows a created item immediately and swaps to the persisted id once create resolves', async () => {
    const store = useShopCatalogStore()
    const deferred = createDeferred()
    createCatalogItemMock.mockReturnValue(deferred.promise.then(() => 'item-1'))

    const creating = store.createItem('Widget', 'cat-1', 'SKU-1', 10)

    expect(store.items).toHaveLength(1)
    expect(store.items[0]!).toMatchObject({
      description: 'Widget',
      categoryId: 'cat-1',
      sku: 'SKU-1',
      price: 10,
      active: true,
    })
    expect(store.items[0]!.id).toContain('temp-item-')

    deferred.resolve()
    const created = await creating

    expect(created).toMatchObject({
      id: 'item-1',
      description: 'Widget',
      categoryId: 'cat-1',
      sku: 'SKU-1',
      price: 10,
      active: true,
    })
    expect(store.items).toHaveLength(1)
    expect(store.items[0]!.id).toBe('item-1')
  })

  it('removes an optimistic create when create fails', async () => {
    const store = useShopCatalogStore()
    const deferred = createDeferred()
    createCatalogItemMock.mockReturnValue(deferred.promise)

    const creating = store.createItem('Widget')

    expect(store.items).toHaveLength(1)

    deferred.reject(new Error('create failed'))
    await expect(creating).rejects.toThrow('create failed')
    expect(store.items).toEqual([])
  })

  it('updates an item immediately and rolls back if the update fails', async () => {
    const store = useShopCatalogStore()
    store.items = [{ id: 'item-1', description: 'Widget', active: true }]

    const deferred = createDeferred()
    updateCatalogItemMock.mockReturnValue(deferred.promise)

    const updating = store.updateItem('item-1', { description: 'Widget 2' })

    expect(store.items[0]!.description).toBe('Widget 2')

    deferred.reject(new Error('update failed'))
    await expect(updating).rejects.toThrow('update failed')
    expect(store.items[0]!.description).toBe('Widget')
  })

  it('updates item active state immediately and rolls back if the request fails', async () => {
    const store = useShopCatalogStore()
    store.items = [{ id: 'item-1', description: 'Widget', active: true }]

    const deferred = createDeferred()
    setCatalogItemActiveMock.mockReturnValue(deferred.promise)

    const updating = store.setItemActive('item-1', false)

    expect(store.items[0]!.active).toBe(false)

    deferred.reject(new Error('archive failed'))
    await expect(updating).rejects.toThrow('archive failed')
    expect(store.items[0]!.active).toBe(true)
  })

  it('optimistically removes an item while delete is in flight', async () => {
    const store = useShopCatalogStore()
    const existingItem = { id: 'item-1', description: 'Widget', active: true }
    store.items = [existingItem]

    const deferred = createDeferred()
    deleteCatalogItemMock.mockReturnValue(deferred.promise)

    const deleting = store.deleteItem(existingItem.id)

    expect(store.items).toEqual([])

    deferred.resolve()
    await deleting

    expect(store.items).toEqual([])
  })

  it('restores an optimistically deleted item when delete fails', async () => {
    const store = useShopCatalogStore()
    const existingItem = { id: 'item-1', description: 'Widget', active: true }
    store.items = [existingItem]

    const deferred = createDeferred()
    deleteCatalogItemMock.mockReturnValue(deferred.promise)

    const deleting = store.deleteItem(existingItem.id)

    expect(store.items).toEqual([])

    deferred.reject(new Error('delete failed'))
    await expect(deleting).rejects.toThrow('delete failed')
    expect(store.items).toEqual([existingItem])
  })
})
