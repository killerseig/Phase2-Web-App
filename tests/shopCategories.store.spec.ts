import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShopCategoriesStore } from '@/stores/shopCategories'

vi.mock('@/services', () => ({
  archiveCategory: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getAllCategories: vi.fn(),
  reactivateCategory: vi.fn(),
  updateCategory: vi.fn(),
}))

describe('shopCategories store recursive helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
})
