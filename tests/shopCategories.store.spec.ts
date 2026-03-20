import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShopCategoriesStore } from '@/stores/shopCategories'

vi.mock('@/services', () => ({
  archiveCategory: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getAllCategories: vi.fn(),
  reactivateCategory: vi.fn(),
  subscribeCategories: vi.fn(),
  updateCategory: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logError: vi.fn(),
}))

import {
  archiveCategory as archiveCategoryService,
  createCategory as createCategoryService,
  deleteCategory as deleteCategoryService,
  reactivateCategory as reactivateCategoryService,
  updateCategory as updateCategoryService,
} from '@/services'

const archiveCategoryMock = archiveCategoryService as unknown as ReturnType<typeof vi.fn>
const createCategoryMock = createCategoryService as unknown as ReturnType<typeof vi.fn>
const deleteCategoryMock = deleteCategoryService as unknown as ReturnType<typeof vi.fn>
const reactivateCategoryMock = reactivateCategoryService as unknown as ReturnType<typeof vi.fn>
const updateCategoryMock = updateCategoryService as unknown as ReturnType<typeof vi.fn>

function createDeferred() {
  let resolve!: () => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('shopCategories store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('returns descendants recursively for a normal tree', () => {
    const store = useShopCategoriesStore()
    store.categories = [
      { id: 'a', name: 'A', parentId: null, active: true },
      { id: 'b', name: 'B', parentId: 'a', active: true },
      { id: 'c', name: 'C', parentId: 'b', active: true },
      { id: 'd', name: 'D', parentId: 'a', active: true },
    ]

    const descendants = store.getDescendants('a').map((category) => category.id)
    expect(descendants.sort()).toEqual(['b', 'c', 'd'])
  })

  it('handles cyclic parent links without infinite recursion', () => {
    const store = useShopCategoriesStore()
    store.categories = [
      { id: 'a', name: 'A', parentId: 'b', active: true },
      { id: 'b', name: 'B', parentId: 'a', active: true },
      { id: 'c', name: 'C', parentId: 'a', active: true },
    ]

    const descendants = store.getDescendants('a').map((category) => category.id)
    expect(descendants).toContain('b')
    expect(descendants).toContain('c')
    expect(descendants.length).toBeLessThanOrEqual(3)
  })

  it('builds breadcrumb safely even with cycles', () => {
    const store = useShopCategoriesStore()
    store.categories = [
      { id: 'a', name: 'A', parentId: 'b', active: true },
      { id: 'b', name: 'B', parentId: 'a', active: true },
    ]

    const breadcrumb = store.getBreadcrumb('a').map((category) => category.id)
    expect(breadcrumb.length).toBeGreaterThan(0)
    expect(breadcrumb.length).toBeLessThanOrEqual(2)
  })

  it('shows a created category immediately and swaps to the persisted id once create resolves', async () => {
    const store = useShopCategoriesStore()
    const deferred = createDeferred()
    createCategoryMock.mockReturnValue(
      deferred.promise.then(() => ({ id: 'cat-1', name: 'Screws', parentId: 'parent-1', active: true }))
    )

    const creating = store.createCategory('Screws', 'parent-1')

    expect(store.categories).toHaveLength(1)
    expect(store.categories[0]!).toMatchObject({
      name: 'Screws',
      parentId: 'parent-1',
      active: true,
    })
    expect(store.categories[0]!.id).toContain('temp-category-')

    deferred.resolve()
    const created = await creating

    expect(created).toEqual({ id: 'cat-1', name: 'Screws', parentId: 'parent-1', active: true })
    expect(store.categories).toEqual([{ id: 'cat-1', name: 'Screws', parentId: 'parent-1', active: true }])
  })

  it('removes an optimistic category create when create fails', async () => {
    const store = useShopCategoriesStore()
    const deferred = createDeferred()
    createCategoryMock.mockReturnValue(deferred.promise)

    const creating = store.createCategory('Screws')

    expect(store.categories).toHaveLength(1)

    deferred.reject(new Error('create failed'))
    await expect(creating).rejects.toThrow('create failed')
    expect(store.categories).toEqual([])
  })

  it('updates a category immediately and rolls back if the update fails', async () => {
    const store = useShopCategoriesStore()
    store.categories = [{ id: 'cat-1', name: 'Screws', parentId: null, active: true }]

    const deferred = createDeferred()
    updateCategoryMock.mockReturnValue(deferred.promise)

    const updating = store.updateCategory('cat-1', { name: 'Self Tapping' })

    expect(store.categories[0]!.name).toBe('Self Tapping')

    deferred.reject(new Error('update failed'))
    await expect(updating).rejects.toThrow('update failed')
    expect(store.categories[0]!.name).toBe('Screws')
  })

  it('archives categories immediately and rolls back if the archive fails', async () => {
    const store = useShopCategoriesStore()
    store.categories = [
      { id: 'cat-1', name: 'Screws', parentId: null, active: true },
      { id: 'cat-2', name: 'Self Tapping', parentId: 'cat-1', active: true },
    ]

    const deferred = createDeferred()
    archiveCategoryMock.mockReturnValue(deferred.promise)

    const archiving = store.archiveCategory('cat-1')

    expect(store.categories.every((category) => category.active === false)).toBe(true)

    deferred.reject(new Error('archive failed'))
    await expect(archiving).rejects.toThrow('archive failed')
    expect(store.categories.every((category) => category.active === true)).toBe(true)
  })

  it('reactivates a category immediately and rolls back if the request fails', async () => {
    const store = useShopCategoriesStore()
    store.categories = [{ id: 'cat-1', name: 'Screws', parentId: null, active: false }]

    const deferred = createDeferred()
    reactivateCategoryMock.mockReturnValue(deferred.promise)

    const reactivating = store.reactivateCategory('cat-1')

    expect(store.categories[0]!.active).toBe(true)

    deferred.reject(new Error('reactivate failed'))
    await expect(reactivating).rejects.toThrow('reactivate failed')
    expect(store.categories[0]!.active).toBe(false)
  })

  it('optimistically removes a category while delete is in flight', async () => {
    const store = useShopCategoriesStore()
    const existingCategory = { id: 'cat-1', name: 'Screws', parentId: null, active: true }
    store.categories = [existingCategory]

    const deferred = createDeferred()
    deleteCategoryMock.mockReturnValue(deferred.promise)

    const deleting = store.deleteCategory(existingCategory.id)

    expect(store.categories).toEqual([])

    deferred.resolve()
    await deleting

    expect(store.categories).toEqual([])
  })

  it('restores an optimistically deleted category when delete fails', async () => {
    const store = useShopCategoriesStore()
    const existingCategory = { id: 'cat-1', name: 'Screws', parentId: null, active: true }
    store.categories = [existingCategory]

    const deferred = createDeferred()
    deleteCategoryMock.mockReturnValue(deferred.promise)

    const deleting = store.deleteCategory(existingCategory.id)

    expect(store.categories).toEqual([])

    deferred.reject(new Error('delete failed'))
    await expect(deleting).rejects.toThrow('delete failed')
    expect(store.categories).toEqual([existingCategory])
  })
})
