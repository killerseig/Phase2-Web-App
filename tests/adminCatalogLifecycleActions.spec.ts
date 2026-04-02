import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'

vi.mock('@/services', () => ({
  deleteCatalogItem: vi.fn(),
  deleteCategory: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logError: vi.fn(),
}))

import {
  deleteCatalogItem as deleteCatalogItemService,
  deleteCategory as deleteCategoryService,
} from '@/services'
import { useAdminCatalogLifecycleActions } from '@/views/admin/useAdminCatalogLifecycleActions'

const deleteCatalogItemMock = deleteCatalogItemService as unknown as ReturnType<typeof vi.fn>
const deleteCategoryMock = deleteCategoryService as unknown as ReturnType<typeof vi.fn>

function createOptimisticHandle() {
  return {
    commit: vi.fn(),
    rollback: vi.fn(),
  }
}

function createLifecycleHarness({
  categories = [],
  allItems = [],
  childIds = new Map<string, readonly string[]>(),
}: {
  categories?: ShopCategory[]
  allItems?: ShopCatalogItem[]
  childIds?: Map<string, readonly string[]>
} = {}) {
  const categoriesRef = ref(categories)
  const allItemsRef = ref(allItems)
  const itemDeleteHandles: Array<ReturnType<typeof createOptimisticHandle>> = []
  const categoryDeleteHandles: Array<ReturnType<typeof createOptimisticHandle>> = []

  const categoriesStore = {
    getCategoryById: vi.fn((id: string) => categoriesRef.value.find((category) => category.id === id)),
    archiveCategory: vi.fn(),
    reactivateCategory: vi.fn(),
    beginOptimisticDelete: vi.fn(() => {
      const handle = createOptimisticHandle()
      categoryDeleteHandles.push(handle)
      return handle
    }),
  }

  const catalogStore = {
    setItemActive: vi.fn(),
    beginOptimisticDelete: vi.fn(() => {
      const handle = createOptimisticHandle()
      itemDeleteHandles.push(handle)
      return handle
    }),
  }

  const confirm = vi.fn(async () => true)
  const toast = { show: vi.fn() }

  const state = {
    saving: ref(false),
    editingItemId: ref<string | null>(null),
    editingCategoryId: ref<string | null>(null),
    editCategoryName: ref(''),
    editCategoryNameOriginal: ref(''),
    savingCategoryEdit: ref(false),
    inlineDraftItem: ref<ShopCatalogItem | null>(null),
  }

  return {
    state,
    confirm,
    toast,
    categoriesStore,
    catalogStore,
    itemDeleteHandles,
    categoryDeleteHandles,
    lifecycle: useAdminCatalogLifecycleActions(
      {
        categoriesStore: categoriesStore as never,
        catalogStore: catalogStore as never,
        categories: categoriesRef,
        allItems: allItemsRef,
        getChildIds: () => childIds,
        confirm,
        toast,
      },
      state,
    ),
  }
}

describe('useAdminCatalogLifecycleActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteCatalogItemMock.mockResolvedValue(undefined)
    deleteCategoryMock.mockResolvedValue(undefined)
  })

  it('deletes category descendants while ignoring inline draft items in the subtree', async () => {
    const { lifecycle, state, confirm, toast, itemDeleteHandles, categoryDeleteHandles } = createLifecycleHarness({
      categories: [
        { id: 'cat-root', name: 'Root', parentId: null, active: true },
        { id: 'cat-child', name: 'Child', parentId: 'cat-root', active: true },
      ],
      childIds: new Map([
        ['cat-root', ['cat-child']],
        ['cat-child', ['item-draft-item']],
      ]),
    })

    state.inlineDraftItem.value = {
      id: 'draft-item',
      description: '',
      categoryId: 'cat-child',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    state.editingItemId.value = 'draft-item'

    await lifecycle.deleteCategory('cat-root')

    expect(confirm).toHaveBeenCalledWith(
      'Delete "Root" and 1 descendant item(s)/category(ies)? This cannot be undone.',
      {
        title: 'Delete Category',
        confirmText: 'Delete',
        variant: 'danger',
      },
    )
    expect(deleteCatalogItemMock).not.toHaveBeenCalled()
    expect(deleteCategoryMock).toHaveBeenNthCalledWith(1, 'cat-child')
    expect(deleteCategoryMock).toHaveBeenNthCalledWith(2, 'cat-root')
    expect(itemDeleteHandles[0]?.commit).toHaveBeenCalled()
    expect(categoryDeleteHandles[0]?.commit).toHaveBeenCalled()
    expect(state.inlineDraftItem.value).toBeNull()
    expect(state.editingItemId.value).toBeNull()
    expect(toast.show).toHaveBeenCalledWith('Deleted "Root" with 1 descendants', 'success')
  })

  it('rolls back optimistic delete state and restores the inline draft when item deletion fails', async () => {
    const { lifecycle, state, toast, itemDeleteHandles, categoryDeleteHandles } = createLifecycleHarness({
      categories: [
        { id: 'cat-child', name: 'Child', parentId: 'item-parent', active: true },
      ],
      allItems: [
        { id: 'parent', description: 'Parent Item', active: true, createdAt: new Date(), updatedAt: new Date() },
      ],
      childIds: new Map([
        ['item-parent', ['cat-child']],
        ['cat-child', ['item-draft-item']],
      ]),
    })

    state.inlineDraftItem.value = {
      id: 'draft-item',
      description: '',
      categoryId: 'cat-child',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    state.editingItemId.value = 'draft-item'

    deleteCatalogItemMock.mockImplementation(async (itemId: string) => {
      if (itemId === 'parent') {
        throw new Error('delete failed')
      }
    })

    await lifecycle.deleteItem({
      id: 'parent',
      description: 'Parent Item',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    expect(deleteCategoryMock).toHaveBeenCalledWith('cat-child')
    expect(deleteCatalogItemMock).toHaveBeenCalledWith('parent')
    expect(itemDeleteHandles[0]?.rollback).toHaveBeenCalled()
    expect(categoryDeleteHandles[0]?.rollback).toHaveBeenCalled()
    expect(state.inlineDraftItem.value?.id).toBe('draft-item')
    expect(state.editingItemId.value).toBe('draft-item')
    expect(toast.show).toHaveBeenCalledWith('Failed to delete item', 'error')
  })

  it('discards inline draft items locally without calling delete services', async () => {
    const { lifecycle, state, confirm, toast } = createLifecycleHarness()

    const draftItem: ShopCatalogItem = {
      id: 'draft-item',
      description: '',
      categoryId: 'cat-child',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    state.inlineDraftItem.value = draftItem
    state.editingItemId.value = draftItem.id

    await lifecycle.deleteItem(draftItem)

    expect(confirm).not.toHaveBeenCalled()
    expect(deleteCatalogItemMock).not.toHaveBeenCalled()
    expect(deleteCategoryMock).not.toHaveBeenCalled()
    expect(state.inlineDraftItem.value).toBeNull()
    expect(state.editingItemId.value).toBeNull()
    expect(toast.show).not.toHaveBeenCalled()
  })
})
