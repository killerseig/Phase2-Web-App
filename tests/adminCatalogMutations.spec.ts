import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { useAdminCatalogMutations } from '@/views/admin/useAdminCatalogMutations'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

function createMutationHarness() {
  const categories = ref<ShopCategory[]>([])
  const allItems = ref<ShopCatalogItem[]>([])

  const categoriesStore = {
    createCategory: vi.fn(),
    getCategoryById: vi.fn((id: string) => categories.value.find((category) => category.id === id) ?? null),
    updateCategory: vi.fn(),
    archiveCategory: vi.fn(),
    reactivateCategory: vi.fn(),
    beginOptimisticDelete: vi.fn(() => ({
      commit: vi.fn(),
      rollback: vi.fn(),
    })),
  }

  const catalogStore = {
    createItem: vi.fn(),
    updateItem: vi.fn(),
    setItemActive: vi.fn(),
    beginOptimisticDelete: vi.fn(() => ({
      commit: vi.fn(),
      rollback: vi.fn(),
    })),
  }

  const confirm = vi.fn(async () => true)
  const toast = { show: vi.fn() }

  return {
    categories,
    allItems,
    categoriesStore,
    catalogStore,
    confirm,
    toast,
    mutations: useAdminCatalogMutations({
      categoriesStore: categoriesStore as never,
      catalogStore: catalogStore as never,
      categories,
      allItems,
      getChildIds: () => new Map(),
      confirm,
      toast,
    }),
  }
}

describe('useAdminCatalogMutations', () => {
  it('creates inline draft items from the tree and clears edit state on success', async () => {
    const { catalogStore, mutations } = createMutationHarness()

    mutations.inlineDraftItem.value = {
      id: 'draft-item-1',
      description: '',
      categoryId: 'category-a',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mutations.editingItemId.value = 'draft-item-1'

    await mutations.saveItemFromTree('draft-item-1', {
      description: 'Anchor Kit',
      sku: 'AK-1',
      price: 12.5,
    })

    expect(catalogStore.createItem).toHaveBeenCalledWith('Anchor Kit', 'category-a', 'AK-1', 12.5)
    expect(mutations.inlineDraftItem.value).toBeNull()
    expect(mutations.editingItemId.value).toBeNull()
  })

  it('restores inline draft edit state when saving a new tree item fails', async () => {
    const { catalogStore, toast, mutations } = createMutationHarness()

    catalogStore.createItem.mockRejectedValue(new Error('save failed'))
    mutations.inlineDraftItem.value = {
      id: 'draft-item-1',
      description: '',
      categoryId: 'category-a',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mutations.editingItemId.value = 'draft-item-1'

    await mutations.saveItemFromTree('draft-item-1', {
      description: 'Anchor Kit',
      sku: 'AK-1',
      price: 12.5,
    })

    expect(mutations.inlineDraftItem.value?.id).toBe('draft-item-1')
    expect(mutations.editingItemId.value).toBe('draft-item-1')
    expect(toast.show).toHaveBeenCalledWith('Failed to add item: save failed', 'error')
  })

  it('skips category updates when the edited name did not change', async () => {
    const { categories, categoriesStore, mutations } = createMutationHarness()

    categories.value = [
      { id: 'category-a', name: 'Anchors', parentId: null, active: true },
    ]

    mutations.editCategory('category-a')
    await mutations.saveCategoryEdit('category-a', { name: 'Anchors' })

    expect(categoriesStore.updateCategory).not.toHaveBeenCalled()
    expect(mutations.editingCategoryId.value).toBeNull()
  })

  it('reactivates an inactive parent item when reactivating a child category', async () => {
    const { categories, allItems, categoriesStore, catalogStore, toast, mutations } = createMutationHarness()

    categories.value = [
      { id: 'category-a', name: 'Anchors', parentId: 'item-parent-item', active: false },
    ]
    allItems.value = [
      {
        id: 'parent-item',
        description: 'Parent Item',
        active: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    await mutations.reactivateCategory('category-a')

    expect(categoriesStore.reactivateCategory).toHaveBeenCalledWith('category-a')
    expect(catalogStore.setItemActive).toHaveBeenCalledWith('parent-item', true)
    expect(toast.show).toHaveBeenCalledWith('Reactivated "Anchors"', 'success')
  })
})
