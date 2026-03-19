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
  listCatalog as listCatalogService,
} from '@/services'

const createCatalogItemMock = createCatalogItemService as unknown as ReturnType<typeof vi.fn>
const listCatalogMock = listCatalogService as unknown as ReturnType<typeof vi.fn>

describe('shopCatalog store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('does not duplicate an item already present from a live snapshot after create', async () => {
    const store = useShopCatalogStore()
    const existingItem = { id: 'item-1', description: 'Widget', active: true }

    store.items = [existingItem]
    createCatalogItemMock.mockResolvedValue('item-1')
    listCatalogMock.mockResolvedValue([existingItem])

    const created = await store.createItem('Widget')

    expect(created).toEqual(existingItem)
    expect(store.items).toEqual([existingItem])
  })

  it('adds a newly created item once when it is not already cached', async () => {
    const store = useShopCatalogStore()
    const newItem = { id: 'item-2', description: 'Bolt', active: true }

    createCatalogItemMock.mockResolvedValue('item-2')
    listCatalogMock.mockResolvedValue([newItem])

    const created = await store.createItem('Bolt')

    expect(created).toEqual(newItem)
    expect(store.items).toEqual([newItem])
  })
})
