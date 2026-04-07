import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import { useAdminCatalogTreeActions } from '@/composables/adminCatalog/useAdminCatalogTreeActions'

function createHarness() {
  const allItems = ref<ShopCatalogItem[]>([])
  const categories = ref<ShopCategory[]>([])
  const inlineDraftItem = ref<ShopCatalogItem | null>(null)
  const editingItemId = ref<string | null>(null)
  const editingCategoryId = ref<string | null>('editing-category')
  const editCategoryName = ref('')
  const expandedNodes = ref<Set<string>>(new Set())

  const updateExpandedNodes = (mutator: (nextExpanded: Set<string>) => void) => {
    const nextExpanded = new Set(expandedNodes.value)
    mutator(nextExpanded)
    expandedNodes.value = nextExpanded
  }

  const createCategoryRecord = vi.fn(async () => {})
  const createCatalogItem = vi.fn(async () => {})

  const actions = useAdminCatalogTreeActions({
    allItems,
    categories,
    inlineDraftItem,
    editingItemId,
    editingCategoryId,
    editCategoryName,
    toggleExpand: vi.fn((nodeId: string) => {
      updateExpandedNodes((nextExpanded) => {
        nextExpanded.add(nodeId)
      })
    }),
    updateExpandedNodes,
    createCategoryRecord,
    createCatalogItem,
    archiveCategory: vi.fn(async () => {}),
    reactivateCategory: vi.fn(async () => {}),
    deleteCategory: vi.fn(async () => {}),
    editItem: vi.fn(),
    saveItemFromTree: vi.fn(async () => {}),
    deleteItem: vi.fn(async () => {}),
    editCategory: vi.fn(),
    saveCategoryEdit: vi.fn(async () => {}),
    cancelCategoryEdit: vi.fn(),
    cancelItemEdit: vi.fn(),
    archiveItem: vi.fn(async () => {}),
    reactivateItem: vi.fn(async () => {}),
  })

  return {
    allItems,
    categories,
    inlineDraftItem,
    editingItemId,
    editingCategoryId,
    editCategoryName,
    expandedNodes,
    createCategoryRecord,
    createCatalogItem,
    actions,
  }
}

describe('useAdminCatalogTreeActions', () => {
  it('creates inline draft items and expands their category path', () => {
    const { allItems, categories, inlineDraftItem, editingItemId, editingCategoryId, expandedNodes, actions } = createHarness()

    allItems.value = [
      {
        id: 'root-item',
        description: 'Root Item',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]
    categories.value = [
      { id: 'fasteners', name: 'Fasteners', parentId: 'root-item', active: true },
    ]

    actions.openAddItemDialog('fasteners')

    expect(inlineDraftItem.value?.categoryId).toBe('fasteners')
    expect(editingItemId.value).toBe(inlineDraftItem.value?.id)
    expect(editingCategoryId.value).toBeNull()
    expect(expandedNodes.value.has('fasteners')).toBe(true)
    expect(expandedNodes.value.has('item-root-item')).toBe(true)
  })

  it('creates nested categories and expands the parent path before saving', async () => {
    const { actions, expandedNodes, createCategoryRecord } = createHarness()

    actions.openAddCategoryDialog('category-a')
    actions.newCategoryName.value = '  Anchors  '
    await actions.createCategory()

    expect(actions.showAddCategory.value).toBe(false)
    expect(actions.newCategoryName.value).toBe('')
    expect(expandedNodes.value.has('category-a')).toBe(true)
    expect(createCategoryRecord).toHaveBeenCalledWith('Anchors', 'category-a')
  })

  it('updates the shared category name ref through the tree listener map', () => {
    const { editCategoryName, actions } = createHarness()

    actions.treeListeners['update:editCategoryName']('New Name')

    expect(editCategoryName.value).toBe('New Name')
  })

  it('creates top-level items with trimmed values and resets the form state', async () => {
    const { actions, createCatalogItem } = createHarness()

    actions.openAddItemDialog()
    actions.newItemDesc.value = '  Cable Tie Gun  '
    actions.newItemSku.value = '  SKU-42  '
    actions.newItemPrice.value = '12.50'

    await actions.createItem()

    expect(actions.showAddItemForm.value).toBe(false)
    expect(actions.newItemDesc.value).toBe('')
    expect(actions.newItemSku.value).toBe('')
    expect(actions.newItemPrice.value).toBe('')
    expect(createCatalogItem).toHaveBeenCalledWith('Cable Tie Gun', undefined, 'SKU-42', 12.5)
  })
})
