import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useShopCatalogArchiveActions } from '@/features/shopCatalog/useShopCatalogArchiveActions'
import { useShopCatalogDeleteActions } from '@/features/shopCatalog/useShopCatalogDeleteActions'
import {
  deleteShopCatalogItem,
  deleteShopCategory,
  updateShopCatalogItem,
  updateShopCategory,
} from '@/services/shopCatalog'
import type { ShopCatalogConfirmAction } from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

vi.mock('@/services/shopCatalog', () => ({
  deleteShopCatalogItem: vi.fn(),
  deleteShopCategory: vi.fn(),
  updateShopCatalogItem: vi.fn(),
  updateShopCategory: vi.fn(),
}))

const deleteShopCatalogItemMock = vi.mocked(deleteShopCatalogItem)
const deleteShopCategoryMock = vi.mocked(deleteShopCategory)
const updateShopCatalogItemMock = vi.mocked(updateShopCatalogItem)
const updateShopCategoryMock = vi.mocked(updateShopCategory)

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
    price: 12.5,
    sku: 'DR-1',
    ...overrides,
  }
}

function groupCategories(categories: readonly ShopCategoryRecord[]) {
  const grouped = new Map<string | null, ShopCategoryRecord[]>()
  for (const category of categories) {
    const parentId = category.parentId ?? null
    grouped.set(parentId, [...(grouped.get(parentId) ?? []), category])
  }
  return grouped
}

function mountArchiveDelete(options: {
  categories?: ShopCategoryRecord[]
  items?: ShopCatalogItemRecord[]
  selectedCategoryId?: string | null
  selectedCategoryHasChildren?: boolean
  selectedItemId?: string | null
  showArchived?: boolean
} = {}) {
  const categories = ref(options.categories ?? [
    makeCategory({ id: 'cat-tools', name: 'Tools' }),
    makeCategory({ id: 'cat-bits', name: 'Bits', parentId: 'cat-tools' }),
    makeCategory({ id: 'cat-nested', name: 'Nested', parentId: 'cat-bits' }),
    makeCategory({ id: 'cat-other', name: 'Other' }),
  ])
  const items = ref(options.items ?? [
    makeItem({ id: 'item-drill', description: 'Cordless Drill', categoryId: 'cat-tools' }),
    makeItem({ id: 'item-bit', description: 'Bit Set', categoryId: 'cat-bits', sku: null, price: null }),
    makeItem({ id: 'item-other', description: 'Other Item', categoryId: 'cat-other' }),
  ])
  const activeFolderId = ref<string | null>('cat-tools')
  const catalogConfirmAction = ref<ShopCatalogConfirmAction | null>(null)
  const deleteLoading = ref(false)
  const saveLoading = ref(false)
  const selectedInspectorKey = ref('category:cat-tools')
  const showArchived = ref(options.showArchived ?? false)
  const resetDetailMessages = vi.fn()
  const selectFolder = vi.fn()
  const inspectItem = vi.fn()
  const detailErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const detailErrorMessages: string[] = []
  const detailInfos: string[] = []
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
  const childCategoriesByParent = computed(() => groupCategories(categories.value))
  const selectedCategory = computed(() => (
    options.selectedCategoryId === null
      ? null
      : categories.value.find((category) => category.id === (options.selectedCategoryId ?? 'cat-tools')) ?? null
  ))
  const selectedItem = computed(() => (
    options.selectedItemId === null
      ? null
      : items.value.find((item) => item.id === (options.selectedItemId ?? 'item-drill')) ?? null
  ))
  const selectedCategoryHasChildren = computed(() => options.selectedCategoryHasChildren ?? false)

  const archive = useShopCatalogArchiveActions({
    activeFolderId,
    catalogConfirmAction,
    categoriesById,
    childCategoriesByParent,
    inspectItem,
    items,
    resetDetailMessages,
    saveLoading,
    selectFolder,
    selectedCategory,
    selectedInspectorKey,
    selectedItem,
    setDetailError: (error, fallbackMessage) => {
      detailErrors.push({ error, fallbackMessage })
    },
    setDetailInfo: (message) => {
      detailInfos.push(message)
    },
    showArchived,
  })
  const deleteActions = useShopCatalogDeleteActions({
    activeFolderId,
    catalogConfirmAction,
    deleteLoading,
    resetDetailMessages,
    selectedCategory,
    selectedCategoryHasChildren,
    selectedInspectorKey,
    selectedItem,
    setDetailError: (error, fallbackMessage) => {
      detailErrors.push({ error, fallbackMessage })
    },
    setDetailErrorMessage: (message) => {
      detailErrorMessages.push(message)
    },
  })

  return {
    activeFolderId,
    archive,
    catalogConfirmAction,
    deleteActions,
    deleteLoading,
    detailErrorMessages,
    detailErrors,
    detailInfos,
    inspectItem,
    items,
    resetDetailMessages,
    saveLoading,
    selectFolder,
    selectedInspectorKey,
    showArchived,
  }
}

describe('useShopCatalogArchiveActions', () => {
  beforeEach(() => {
    deleteShopCatalogItemMock.mockReset()
    deleteShopCategoryMock.mockReset()
    updateShopCatalogItemMock.mockReset()
    updateShopCategoryMock.mockReset()
    deleteShopCatalogItemMock.mockResolvedValue(undefined)
    deleteShopCategoryMock.mockResolvedValue(undefined)
    updateShopCatalogItemMock.mockResolvedValue(undefined)
    updateShopCategoryMock.mockResolvedValue(undefined)
  })

  it('starts folder archive confirmation from the selected folder', () => {
    const { archive, catalogConfirmAction, resetDetailMessages } = mountArchiveDelete()

    archive.handleArchiveCategory(false)

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(catalogConfirmAction.value).toEqual({
      kind: 'archive-category',
      categoryId: 'cat-tools',
      label: 'Tools',
      nextActive: false,
      showInspector: true,
    })
  })

  it('starts selected folder archive or restore requests from the folder active state', () => {
    const activeFolder = mountArchiveDelete({
      categories: [makeCategory({ active: true, id: 'cat-active', name: 'Active Folder' })],
      selectedCategoryId: 'cat-active',
    })
    const archivedFolder = mountArchiveDelete({
      categories: [makeCategory({ active: false, id: 'cat-archived', name: 'Archived Folder' })],
      selectedCategoryId: 'cat-archived',
    })
    const noSelection = mountArchiveDelete({ selectedCategoryId: null })

    activeFolder.archive.handleSelectedCategoryArchiveRequest()
    archivedFolder.archive.handleSelectedCategoryArchiveRequest()
    noSelection.archive.handleSelectedCategoryArchiveRequest()

    expect(activeFolder.catalogConfirmAction.value).toEqual({
      kind: 'archive-category',
      categoryId: 'cat-active',
      label: 'Active Folder',
      nextActive: false,
      showInspector: true,
    })
    expect(archivedFolder.catalogConfirmAction.value).toEqual({
      kind: 'archive-category',
      categoryId: 'cat-archived',
      label: 'Archived Folder',
      nextActive: true,
      showInspector: true,
    })
    expect(noSelection.catalogConfirmAction.value).toBeNull()
  })

  it('archives a folder, descendant folders, and nested items with hidden-archive fallback selection', async () => {
    const {
      activeFolderId,
      archive,
      catalogConfirmAction,
      detailInfos,
      saveLoading,
      selectedInspectorKey,
      selectFolder,
    } = mountArchiveDelete()
    catalogConfirmAction.value = {
      kind: 'archive-category',
      categoryId: 'cat-tools',
      label: 'Tools',
      nextActive: false,
      showInspector: false,
    }

    await archive.confirmArchiveCategory(catalogConfirmAction.value)

    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-tools', {
      name: 'Tools',
      parentId: null,
      active: false,
    })
    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-bits', {
      name: 'Bits',
      parentId: 'cat-tools',
      active: false,
    })
    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-nested', {
      name: 'Nested',
      parentId: 'cat-bits',
      active: false,
    })
    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-drill', {
      description: 'Cordless Drill',
      categoryId: 'cat-tools',
      sku: 'DR-1',
      price: 12.5,
      active: false,
    })
    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-bit', {
      description: 'Bit Set',
      categoryId: 'cat-bits',
      sku: null,
      price: null,
      active: false,
    })
    expect(updateShopCatalogItemMock).not.toHaveBeenCalledWith('item-other', expect.anything())
    expect(activeFolderId.value).toBeNull()
    expect(selectedInspectorKey.value).toBe('root')
    expect(selectFolder).not.toHaveBeenCalled()
    expect(detailInfos).toEqual(['Folder archived.'])
    expect(saveLoading.value).toBe(false)
    expect(catalogConfirmAction.value).toBeNull()
  })

  it('restores a folder and reselects it when archived records are visible', async () => {
    const { archive, catalogConfirmAction, selectFolder } = mountArchiveDelete({
      showArchived: true,
    })
    catalogConfirmAction.value = {
      kind: 'archive-category',
      categoryId: 'cat-tools',
      label: 'Tools',
      nextActive: true,
      showInspector: false,
    }

    await archive.confirmArchiveCategory(catalogConfirmAction.value)

    expect(updateShopCategoryMock).toHaveBeenCalledWith('cat-tools', expect.objectContaining({ active: true }))
    expect(selectFolder).toHaveBeenCalledWith('cat-tools', { showInspector: false })
  })

  it('starts item archive confirmation and archives hidden items back to their folder', async () => {
    const {
      activeFolderId,
      archive,
      catalogConfirmAction,
      detailInfos,
      selectedInspectorKey,
    } = mountArchiveDelete()

    archive.handleArchiveItem(false, 'item-drill', { showInspector: false })
    expect(catalogConfirmAction.value).toEqual({
      kind: 'archive-item',
      itemId: 'item-drill',
      label: 'Cordless Drill',
      nextActive: false,
      showInspector: false,
    })

    await archive.confirmArchiveItem(catalogConfirmAction.value as Extract<ShopCatalogConfirmAction, { kind: 'archive-item' }>)

    expect(updateShopCatalogItemMock).toHaveBeenCalledWith('item-drill', {
      description: 'Cordless Drill',
      categoryId: 'cat-tools',
      sku: 'DR-1',
      price: 12.5,
      active: false,
    })
    expect(activeFolderId.value).toBe('cat-tools')
    expect(selectedInspectorKey.value).toBe('category:cat-tools')
    expect(detailInfos).toEqual(['Item archived.'])
    expect(catalogConfirmAction.value).toBeNull()
  })

  it('starts selected item archive or restore requests from the item active state', () => {
    const activeItem = mountArchiveDelete({
      items: [makeItem({ active: true, description: 'Active Item', id: 'item-active' })],
      selectedItemId: 'item-active',
    })
    const archivedItem = mountArchiveDelete({
      items: [makeItem({ active: false, description: 'Archived Item', id: 'item-archived' })],
      selectedItemId: 'item-archived',
    })
    const noSelection = mountArchiveDelete({ selectedItemId: null })

    activeItem.archive.handleSelectedItemArchiveRequest()
    archivedItem.archive.handleSelectedItemArchiveRequest()
    noSelection.archive.handleSelectedItemArchiveRequest()

    expect(activeItem.catalogConfirmAction.value).toEqual({
      kind: 'archive-item',
      itemId: 'item-active',
      label: 'Active Item',
      nextActive: false,
      showInspector: true,
    })
    expect(archivedItem.catalogConfirmAction.value).toEqual({
      kind: 'archive-item',
      itemId: 'item-archived',
      label: 'Archived Item',
      nextActive: true,
      showInspector: true,
    })
    expect(noSelection.catalogConfirmAction.value).toBeNull()
  })

  it('restores an item and keeps it visible in the inspector', async () => {
    const { archive, catalogConfirmAction, inspectItem } = mountArchiveDelete({
      showArchived: true,
    })
    catalogConfirmAction.value = {
      kind: 'archive-item',
      itemId: 'item-drill',
      label: 'Cordless Drill',
      nextActive: true,
      showInspector: true,
    }

    await archive.confirmArchiveItem(catalogConfirmAction.value)

    expect(inspectItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-drill',
        active: true,
      }),
      { showInspector: true },
    )
  })

  it('reports archive failures without leaving loading or confirm state stuck', async () => {
    const error = new Error('No write access')
    updateShopCatalogItemMock.mockRejectedValueOnce(error)
    const { archive, catalogConfirmAction, detailErrors, saveLoading } = mountArchiveDelete()
    catalogConfirmAction.value = {
      kind: 'archive-item',
      itemId: 'item-drill',
      label: 'Cordless Drill',
      nextActive: false,
      showInspector: true,
    }

    await archive.confirmArchiveItem(catalogConfirmAction.value)

    expect(detailErrors).toEqual([{ error, fallbackMessage: 'Failed to archive item.' }])
    expect(saveLoading.value).toBe(false)
    expect(catalogConfirmAction.value).toBeNull()
  })
})

describe('useShopCatalogDeleteActions', () => {
  beforeEach(() => {
    deleteShopCatalogItemMock.mockReset()
    deleteShopCategoryMock.mockReset()
    updateShopCatalogItemMock.mockReset()
    updateShopCategoryMock.mockReset()
    deleteShopCatalogItemMock.mockResolvedValue(undefined)
    deleteShopCategoryMock.mockResolvedValue(undefined)
  })

  it('blocks deleting folders that still have children', () => {
    const { catalogConfirmAction, deleteActions, detailErrorMessages } = mountArchiveDelete({
      selectedCategoryHasChildren: true,
    })

    deleteActions.handleDeleteCategory()

    expect(detailErrorMessages).toEqual(['Empty the folder before deleting it.'])
    expect(catalogConfirmAction.value).toBeNull()
  })

  it('starts category and item delete confirmations from the selected records', () => {
    const { catalogConfirmAction, deleteActions } = mountArchiveDelete()

    deleteActions.handleDeleteCategory()
    expect(catalogConfirmAction.value).toEqual({
      kind: 'delete-category',
      categoryId: 'cat-tools',
      label: 'Tools',
      parentId: null,
    })

    deleteActions.handleDeleteItem()
    expect(catalogConfirmAction.value).toEqual({
      kind: 'delete-item',
      itemId: 'item-drill',
      label: 'Cordless Drill',
      categoryId: 'cat-tools',
    })
  })

  it('deletes a folder and selects the parent folder afterward', async () => {
    const { activeFolderId, catalogConfirmAction, deleteActions, deleteLoading, selectedInspectorKey } =
      mountArchiveDelete()
    catalogConfirmAction.value = {
      kind: 'delete-category',
      categoryId: 'cat-bits',
      label: 'Bits',
      parentId: 'cat-tools',
    }

    await deleteActions.confirmDeleteCategory(catalogConfirmAction.value)

    expect(deleteShopCategoryMock).toHaveBeenCalledWith('cat-bits')
    expect(selectedInspectorKey.value).toBe('root')
    expect(activeFolderId.value).toBe('cat-tools')
    expect(deleteLoading.value).toBe(false)
    expect(catalogConfirmAction.value).toBeNull()
  })

  it('deletes an item and selects its containing folder afterward', async () => {
    const { activeFolderId, catalogConfirmAction, deleteActions, selectedInspectorKey } = mountArchiveDelete()
    catalogConfirmAction.value = {
      kind: 'delete-item',
      itemId: 'item-drill',
      label: 'Cordless Drill',
      categoryId: 'cat-tools',
    }

    await deleteActions.confirmDeleteItem(catalogConfirmAction.value)

    expect(deleteShopCatalogItemMock).toHaveBeenCalledWith('item-drill')
    expect(selectedInspectorKey.value).toBe('category:cat-tools')
    expect(activeFolderId.value).toBe('cat-tools')
    expect(catalogConfirmAction.value).toBeNull()
  })

  it('reports delete failures without leaving loading or confirm state stuck', async () => {
    const error = new Error('Delete denied')
    deleteShopCategoryMock.mockRejectedValueOnce(error)
    const { catalogConfirmAction, deleteActions, deleteLoading, detailErrors } = mountArchiveDelete()
    catalogConfirmAction.value = {
      kind: 'delete-category',
      categoryId: 'cat-tools',
      label: 'Tools',
      parentId: null,
    }

    await deleteActions.confirmDeleteCategory(catalogConfirmAction.value)

    expect(detailErrors).toEqual([{ error, fallbackMessage: 'Failed to delete folder.' }])
    expect(deleteLoading.value).toBe(false)
    expect(catalogConfirmAction.value).toBeNull()
  })
})
