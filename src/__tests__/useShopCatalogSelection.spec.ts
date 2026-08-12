import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useShopCatalogSelection } from '@/features/shopCatalog/useShopCatalogSelection'
import { useShopCatalogSelectionSync } from '@/features/shopCatalog/useShopCatalogSelectionSync'
import {
  getShopCatalogSelectedCategoryId,
  getShopCatalogSelectedItemId,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

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

function mountSelection(options: {
  categories?: ShopCategoryRecord[]
  items?: ShopCatalogItemRecord[]
} = {}) {
  const categories = ref(options.categories ?? [makeCategory()])
  const items = ref(options.items ?? [makeItem()])
  const cancelInlineCreate = vi.fn()
  const ensureExpandedToCategory = vi.fn()
  const showInspectorPanel = vi.fn()
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))

  const selection = useShopCatalogSelection({
    cancelInlineCreate,
    categoriesById,
    ensureExpandedToCategory,
    items,
    showInspectorPanel,
  })

  return {
    cancelInlineCreate,
    categories,
    ensureExpandedToCategory,
    items,
    selection,
    showInspectorPanel,
  }
}

function mountSelectionSync(options: {
  categories?: ShopCategoryRecord[]
  items?: ShopCatalogItemRecord[]
  selectedInspectorKey?: string
} = {}) {
  const activeFolderId = ref<string | null>(null)
  const categories = ref(options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-tools' }),
  ])
  const items = ref(options.items ?? [makeItem()])
  const selectedInspectorKey = ref(options.selectedInspectorKey ?? 'root')
  const selectedCategoryId = computed(() => getShopCatalogSelectedCategoryId(selectedInspectorKey.value))
  const selectedItemId = computed(() => getShopCatalogSelectedItemId(selectedInspectorKey.value))
  const selectedCategory = computed(() => (
    selectedCategoryId.value
      ? categories.value.find((category) => category.id === selectedCategoryId.value) ?? null
      : null
  ))
  const selectedItem = computed(() => (
    selectedItemId.value
      ? items.value.find((item) => item.id === selectedItemId.value) ?? null
      : null
  ))
  const treeInitialized = ref(false)
  const applySelectedCategoryToForm = vi.fn()
  const applySelectedItemToForm = vi.fn()
  const initializeRootCategories = vi.fn()
  const resetCreateCategoryForm = vi.fn()
  const resetCreateItemForm = vi.fn()

  useShopCatalogSelectionSync({
    activeFolderId,
    applySelectedCategoryToForm,
    applySelectedItemToForm,
    categories,
    initializeRootCategories,
    isCreateCategoryMode: computed(() => selectedInspectorKey.value === 'new-category'),
    isCreateItemMode: computed(() => selectedInspectorKey.value === 'new-item'),
    items,
    resetCreateCategoryForm,
    resetCreateItemForm,
    selectedCategory,
    selectedCategoryId,
    selectedInspectorKey,
    selectedItem,
    selectedItemId,
    treeInitialized,
  })

  return {
    activeFolderId,
    applySelectedCategoryToForm,
    applySelectedItemToForm,
    categories,
    initializeRootCategories,
    items,
    resetCreateCategoryForm,
    resetCreateItemForm,
    selectedInspectorKey,
    treeInitialized,
  }
}

describe('useShopCatalogSelection', () => {
  it('starts on the root inspector with empty selected records', () => {
    const { selection } = mountSelection()

    expect(selection.activeFolderId.value).toBeNull()
    expect(selection.selectedInspectorKey.value).toBe('root')
    expect(selection.selectedCategoryId.value).toBeNull()
    expect(selection.selectedItemId.value).toBeNull()
    expect(selection.selectedCategory.value).toBeNull()
    expect(selection.selectedItem.value).toBeNull()
    expect(selection.isRootInspector.value).toBe(true)
    expect(selection.isCreateCategoryMode.value).toBe(false)
    expect(selection.isCreateItemMode.value).toBe(false)
  })

  it('selects root and cancels inline creation', () => {
    const { cancelInlineCreate, selection } = mountSelection()
    selection.activeFolderId.value = 'cat-tools'
    selection.selectedInspectorKey.value = 'category:cat-tools'

    selection.selectRoot()

    expect(selection.activeFolderId.value).toBeNull()
    expect(selection.selectedInspectorKey.value).toBe('root')
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
  })

  it('selects folders with default inspector and expansion behavior', () => {
    const { cancelInlineCreate, ensureExpandedToCategory, selection, showInspectorPanel } = mountSelection()

    selection.selectFolder('cat-tools')

    expect(selection.activeFolderId.value).toBe('cat-tools')
    expect(selection.selectedInspectorKey.value).toBe('category:cat-tools')
    expect(selection.selectedCategory.value).toEqual(makeCategory())
    expect(showInspectorPanel).toHaveBeenCalledTimes(1)
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
  })

  it('can select folders without opening the inspector or expanding ancestors', () => {
    const { cancelInlineCreate, ensureExpandedToCategory, selection, showInspectorPanel } = mountSelection()

    selection.selectFolder('cat-tools', {
      ensureExpanded: false,
      showInspector: false,
    })

    expect(selection.activeFolderId.value).toBe('cat-tools')
    expect(selection.selectedInspectorKey.value).toBe('category:cat-tools')
    expect(showInspectorPanel).not.toHaveBeenCalled()
    expect(ensureExpandedToCategory).not.toHaveBeenCalled()
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
  })

  it('inspects items by selecting the item and expanding its folder', () => {
    const item = makeItem({ categoryId: 'cat-tools' })
    const { cancelInlineCreate, ensureExpandedToCategory, selection, showInspectorPanel } = mountSelection({
      items: [item],
    })

    selection.inspectItem(item)

    expect(selection.activeFolderId.value).toBe('cat-tools')
    expect(selection.selectedInspectorKey.value).toBe('item:item-drill')
    expect(selection.selectedItem.value).toStrictEqual(item)
    expect(showInspectorPanel).toHaveBeenCalledTimes(1)
    expect(ensureExpandedToCategory).toHaveBeenCalledWith('cat-tools')
    expect(cancelInlineCreate).toHaveBeenCalledTimes(1)
  })

  it('can inspect top-level items without opening the inspector', () => {
    const item = makeItem({ categoryId: null })
    const { ensureExpandedToCategory, selection, showInspectorPanel } = mountSelection({
      items: [item],
    })

    selection.inspectItem(item, { showInspector: false })

    expect(selection.activeFolderId.value).toBeNull()
    expect(selection.selectedInspectorKey.value).toBe('item:item-drill')
    expect(showInspectorPanel).not.toHaveBeenCalled()
    expect(ensureExpandedToCategory).toHaveBeenCalledWith(null)
  })
})

describe('useShopCatalogSelectionSync', () => {
  it('hydrates selected folder and item forms as inspector selection changes', async () => {
    const sync = mountSelectionSync()

    sync.selectedInspectorKey.value = 'category:cat-tools'
    await nextTick()
    sync.selectedInspectorKey.value = 'item:item-drill'
    await nextTick()

    expect(sync.applySelectedCategoryToForm).toHaveBeenCalledWith(makeCategory({
      id: 'cat-tools',
      name: 'Tools',
    }))
    expect(sync.applySelectedItemToForm).toHaveBeenCalledWith(makeItem())
  })

  it('resets create forms when entering create modes from selected records', async () => {
    const sync = mountSelectionSync()

    sync.selectedInspectorKey.value = 'category:cat-tools'
    await nextTick()
    sync.selectedInspectorKey.value = 'new-category'
    await nextTick()
    sync.selectedInspectorKey.value = 'item:item-drill'
    await nextTick()
    sync.selectedInspectorKey.value = 'new-item'
    await nextTick()

    expect(sync.resetCreateCategoryForm).toHaveBeenCalledTimes(1)
    expect(sync.resetCreateItemForm).toHaveBeenCalledTimes(1)
  })

  it('initializes root folders once when category records first change', async () => {
    const sync = mountSelectionSync()

    sync.categories.value = [...sync.categories.value, makeCategory({ id: 'cat-root-2', name: 'Root 2' })]
    await nextTick()
    sync.categories.value = [...sync.categories.value, makeCategory({ id: 'cat-root-3', name: 'Root 3' })]
    await nextTick()

    expect(sync.initializeRootCategories).toHaveBeenCalledTimes(1)
    expect(sync.initializeRootCategories).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 'cat-tools' }),
      expect.objectContaining({ id: 'cat-root-2' }),
    ]))
    expect(sync.treeInitialized.value).toBe(true)
  })

  it('clears stale active folders and selected folders when category records disappear', async () => {
    const sync = mountSelectionSync()
    sync.activeFolderId.value = 'cat-tools'
    sync.selectedInspectorKey.value = 'category:cat-tools'
    await nextTick()

    sync.categories.value = [makeCategory({ id: 'cat-bits', name: 'Bits' })]
    await nextTick()

    expect(sync.activeFolderId.value).toBeNull()
    expect(sync.selectedInspectorKey.value).toBe('root')
  })

  it('falls back to the active folder when a selected item disappears', async () => {
    const sync = mountSelectionSync()
    sync.activeFolderId.value = 'cat-tools'
    sync.selectedInspectorKey.value = 'item:item-drill'
    await nextTick()

    sync.items.value = []
    await nextTick()

    expect(sync.selectedInspectorKey.value).toBe('category:cat-tools')
  })

  it('falls back to root when a selected top-level item disappears', async () => {
    const sync = mountSelectionSync({
      items: [makeItem({ categoryId: null })],
    })
    sync.activeFolderId.value = null
    sync.selectedInspectorKey.value = 'item:item-drill'
    await nextTick()

    sync.items.value = []
    await nextTick()

    expect(sync.selectedInspectorKey.value).toBe('root')
  })
})
