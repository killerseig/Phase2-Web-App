import { describe, expect, it, vi, beforeEach } from 'vitest'

import { useShopCatalogRecords } from '@/features/shopCatalog/useShopCatalogRecords'
import { subscribeShopCatalogItems, subscribeShopCategories } from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

vi.mock('@/services/shopCatalog', () => ({
  subscribeShopCatalogItems: vi.fn(),
  subscribeShopCategories: vi.fn(),
}))

const subscribeShopCatalogItemsMock = vi.mocked(subscribeShopCatalogItems)
const subscribeShopCategoriesMock = vi.mocked(subscribeShopCategories)

type CategoryUpdate = (categories: ShopCategoryRecord[]) => void
type ItemUpdate = (items: ShopCatalogItemRecord[]) => void
type ErrorCallback = (error: unknown) => void

function makeCategory(overrides: Partial<ShopCategoryRecord> = {}): ShopCategoryRecord {
  return {
    active: true,
    id: 'cat-tools',
    name: 'Tools',
    parentId: null,
    ...overrides,
  }
}

function makeItem(overrides: Partial<ShopCatalogItemRecord> = {}): ShopCatalogItemRecord {
  return {
    active: true,
    categoryId: 'cat-tools',
    description: 'Cordless Drill',
    id: 'item-drill',
    price: null,
    sku: null,
    ...overrides,
  }
}

function installSubscriptionMocks() {
  const categoryUnsubscribes: ReturnType<typeof vi.fn>[] = []
  const itemUnsubscribes: ReturnType<typeof vi.fn>[] = []
  const categoryUpdates: CategoryUpdate[] = []
  const itemUpdates: ItemUpdate[] = []
  const categoryErrors: ErrorCallback[] = []
  const itemErrors: ErrorCallback[] = []

  subscribeShopCategoriesMock.mockImplementation((onUpdate, onError) => {
    categoryUpdates.push(onUpdate)
    categoryErrors.push(onError ?? (() => undefined))
    const unsubscribe = vi.fn()
    categoryUnsubscribes.push(unsubscribe)
    return unsubscribe
  })

  subscribeShopCatalogItemsMock.mockImplementation((onUpdate, onError) => {
    itemUpdates.push(onUpdate)
    itemErrors.push(onError ?? (() => undefined))
    const unsubscribe = vi.fn()
    itemUnsubscribes.push(unsubscribe)
    return unsubscribe
  })

  return {
    categoryErrors,
    categoryUnsubscribes,
    categoryUpdates,
    itemErrors,
    itemUnsubscribes,
    itemUpdates,
  }
}

describe('useShopCatalogRecords', () => {
  beforeEach(() => {
    subscribeShopCatalogItemsMock.mockReset()
    subscribeShopCategoriesMock.mockReset()
  })

  it('subscribes to folders and items with all-record loading semantics', () => {
    const mock = installSubscriptionMocks()
    const records = useShopCatalogRecords()

    records.subscribeCatalogRecords()

    expect(records.loading.value).toBe(true)
    expect(records.error.value).toBe('')
    expect(subscribeShopCategoriesMock).toHaveBeenCalledTimes(1)
    expect(subscribeShopCatalogItemsMock).toHaveBeenCalledTimes(1)

    mock.categoryUpdates[0]!([makeCategory()])
    expect(records.categories.value).toEqual([makeCategory()])
    expect(records.loading.value).toBe(true)

    mock.itemUpdates[0]!([makeItem()])
    expect(records.items.value).toEqual([makeItem()])
    expect(records.loading.value).toBe(false)
  })

  it('supports category-or-items loading for shared catalog browser pages', () => {
    const mock = installSubscriptionMocks()
    const records = useShopCatalogRecords({
      loadingMode: 'category-or-items',
    })

    records.subscribeCatalogRecords()
    mock.categoryUpdates[0]!([makeCategory()])

    expect(records.loading.value).toBe(false)
  })

  it('keeps category-or-items loading until items arrive when the first folder update is empty', () => {
    const mock = installSubscriptionMocks()
    const records = useShopCatalogRecords({
      loadingMode: 'category-or-items',
    })

    records.subscribeCatalogRecords()
    mock.categoryUpdates[0]!([])
    expect(records.loading.value).toBe(true)

    mock.itemUpdates[0]!([])
    expect(records.loading.value).toBe(false)
  })

  it('stops existing listeners before starting a replacement subscription', () => {
    const mock = installSubscriptionMocks()
    const records = useShopCatalogRecords()

    records.subscribeCatalogRecords()
    records.subscribeCatalogRecords()

    expect(mock.categoryUnsubscribes[0]).toHaveBeenCalledTimes(1)
    expect(mock.itemUnsubscribes[0]).toHaveBeenCalledTimes(1)
    expect(subscribeShopCategoriesMock).toHaveBeenCalledTimes(2)
    expect(subscribeShopCatalogItemsMock).toHaveBeenCalledTimes(2)
  })

  it('stops active listeners idempotently', () => {
    const mock = installSubscriptionMocks()
    const records = useShopCatalogRecords()

    records.subscribeCatalogRecords()
    records.stopCatalogRecords()
    records.stopCatalogRecords()

    expect(mock.categoryUnsubscribes[0]).toHaveBeenCalledTimes(1)
    expect(mock.itemUnsubscribes[0]).toHaveBeenCalledTimes(1)
  })

  it('normalizes category and item listener errors with custom fallback copy', () => {
    const mock = installSubscriptionMocks()
    const records = useShopCatalogRecords({
      categoryErrorMessage: 'Could not load folders.',
      itemErrorMessage: 'Could not load items.',
    })

    records.subscribeCatalogRecords()
    mock.categoryErrors[0]!(new Error('Denied folders'))

    expect(records.error.value).toBe('Denied folders')
    expect(records.loading.value).toBe(false)

    records.subscribeCatalogRecords()
    mock.itemErrors[1]!({})

    expect(records.error.value).toBe('Could not load items.')
    expect(records.loading.value).toBe(false)
  })

  it('normalizes synchronous subscription startup failures and leaves no loading state stuck', () => {
    subscribeShopCategoriesMock.mockImplementation(() => {
      throw new Error('Firestore unavailable')
    })

    const records = useShopCatalogRecords({
      fallbackErrorMessage: 'Catalog startup failed.',
    })

    records.subscribeCatalogRecords()

    expect(records.error.value).toBe('Firestore unavailable')
    expect(records.loading.value).toBe(false)
    expect(subscribeShopCatalogItemsMock).not.toHaveBeenCalled()
  })
})
