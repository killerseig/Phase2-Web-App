import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import { createCategory as createCategoryService } from '@/services'

vi.mock('@/services', () => ({
  archiveCategory: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getAllCategories: vi.fn(),
  reactivateCategory: vi.fn(),
  subscribeCategories: vi.fn(),
  updateCategory: vi.fn(),
}))

const createCategoryMock = createCategoryService as unknown as ReturnType<typeof vi.fn>

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

    const descendants = store.getDescendants('a').map(d => d.id)
    expect(descendants.sort()).toEqual(['b', 'c', 'd'])
  })

  it('handles cyclic parent links without infinite recursion', () => {
    const store = useShopCategoriesStore()
    store.categories = [
      { id: 'a', name: 'A', parentId: 'b', active: true },
      { id: 'b', name: 'B', parentId: 'a', active: true },
      { id: 'c', name: 'C', parentId: 'a', active: true },
    ]

    const descendants = store.getDescendants('a').map(d => d.id)
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

    const breadcrumb = store.getBreadcrumb('a').map(c => c.id)
    expect(breadcrumb.length).toBeGreaterThan(0)
    expect(breadcrumb.length).toBeLessThanOrEqual(2)
  })

  it('does not duplicate a category already present from a live snapshot after create', async () => {
    const store = useShopCategoriesStore()
    const existingCategory = { id: 'cat-1', name: 'Screws', parentId: 'parent-1', active: true }

    store.categories = [existingCategory]
    createCategoryMock.mockResolvedValue(existingCategory)

    const created = await store.createCategory('Screws', 'parent-1')

    expect(created).toEqual(existingCategory)
    expect(store.categories).toEqual([existingCategory])
  })

  it('adds a newly created category once when it is not already cached', async () => {
    const store = useShopCategoriesStore()
    const newCategory = { id: 'cat-2', name: 'Self Tapping', parentId: 'cat-1', active: true }

    createCategoryMock.mockResolvedValue(newCategory)

    const created = await store.createCategory('Self Tapping', 'cat-1')

    expect(created).toEqual(newCategory)
    expect(store.categories).toEqual([newCategory])
  })
})
