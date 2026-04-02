import { ref, type Ref } from 'vue'
import type { ShopCatalogItem } from '@/services'
import type { ShopCategory } from '@/stores/shopCategories'
import {
  createCatalogItemNodeId,
  getCatalogItemIdFromNodeId,
  isCatalogItemNodeId,
} from '@/utils/catalogNode'
import type {
  AdminCatalogCategoryUpdates,
  AdminCatalogItemUpdates,
  AdminCatalogTreeListeners,
} from '@/views/admin/adminCatalogTreeTypes'

type MaybePromiseVoid = void | Promise<void>

type UseAdminCatalogTreeActionsOptions = {
  allItems: Ref<ShopCatalogItem[]>
  categories: Ref<ShopCategory[]>
  inlineDraftItem: Ref<ShopCatalogItem | null>
  editingItemId: Ref<string | null>
  editingCategoryId: Ref<string | null>
  editCategoryName: Ref<string>
  toggleExpand: (nodeId: string) => void
  updateExpandedNodes: (mutator: (nextExpanded: Set<string>) => void) => void
  createCategoryRecord: (name: string, parentId: string | null) => Promise<void>
  createCatalogItem: (description: string, categoryId?: string, sku?: string, price?: number) => Promise<void>
  archiveCategory: (id: string) => MaybePromiseVoid
  reactivateCategory: (id: string) => MaybePromiseVoid
  deleteCategory: (id: string) => MaybePromiseVoid
  editItem: (item: ShopCatalogItem) => void
  saveItemFromTree: (itemId: string, updates: AdminCatalogItemUpdates) => MaybePromiseVoid
  deleteItem: (item: ShopCatalogItem) => MaybePromiseVoid
  editCategory: (id: string) => void
  saveCategoryEdit: (id: string, updates: AdminCatalogCategoryUpdates) => MaybePromiseVoid
  cancelCategoryEdit: () => void
  cancelItemEdit: () => void
  archiveItem: (item: ShopCatalogItem) => MaybePromiseVoid
  reactivateItem: (item: ShopCatalogItem) => MaybePromiseVoid
}

export function resolveAdminCatalogParentNodeId(
  nextParentId: string,
  allItems: ShopCatalogItem[],
): string {
  if (isCatalogItemNodeId(nextParentId)) return nextParentId

  return allItems.some((item) => item.id === nextParentId)
    ? createCatalogItemNodeId(nextParentId)
    : nextParentId
}

export function expandAdminCatalogAncestorNodes(
  nodeId: string,
  expandedNodes: Set<string>,
  categories: ShopCategory[],
  allItems: ShopCatalogItem[],
  depth = 0,
) {
  if (depth > 50) return

  if (isCatalogItemNodeId(nodeId)) {
    const itemId = getCatalogItemIdFromNodeId(nodeId)
    if (!itemId) return
    const item = allItems.find((entry) => entry.id === itemId)
    if (!item?.categoryId) return

    expandedNodes.add(item.categoryId)
    expandAdminCatalogAncestorNodes(item.categoryId, expandedNodes, categories, allItems, depth + 1)
    return
  }

  const category = categories.find((entry) => entry.id === nodeId)
  if (!category?.parentId) return

  const parentNodeId = resolveAdminCatalogParentNodeId(category.parentId, allItems)
  expandedNodes.add(parentNodeId)
  expandAdminCatalogAncestorNodes(parentNodeId, expandedNodes, categories, allItems, depth + 1)
}

export function useAdminCatalogTreeActions(options: UseAdminCatalogTreeActionsOptions) {
  const newCategoryName = ref('')
  const newItemDesc = ref('')
  const newItemSku = ref('')
  const newItemPrice = ref('')
  const showAddCategory = ref(false)
  const showAddItemForm = ref(false)
  const parentId = ref<string | null>(null)

  function expandNodePath(nodeId: string) {
    const resolvedNodeId = resolveAdminCatalogParentNodeId(nodeId, options.allItems.value)
    options.updateExpandedNodes((nextExpanded) => {
      nextExpanded.add(resolvedNodeId)
      expandAdminCatalogAncestorNodes(
        resolvedNodeId,
        nextExpanded,
        options.categories.value,
        options.allItems.value,
      )
    })
  }

  function openAddCategoryDialog(id: string | null = null) {
    parentId.value = id
    newCategoryName.value = ''
    showAddCategory.value = true
  }

  function closeAddCategoryDialog() {
    showAddCategory.value = false
  }

  function resetTopLevelItemForm() {
    newItemDesc.value = ''
    newItemSku.value = ''
    newItemPrice.value = ''
    showAddItemForm.value = false
  }

  function openAddItemDialog(id: string | null = null) {
    if (!id) {
      newItemDesc.value = ''
      newItemSku.value = ''
      newItemPrice.value = ''
      showAddItemForm.value = true
      return
    }

    options.inlineDraftItem.value = {
      id: `draft-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      description: '',
      categoryId: id,
      active: true,
      sku: undefined,
      price: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    options.editingItemId.value = options.inlineDraftItem.value.id
    options.editingCategoryId.value = null

    expandNodePath(id)
  }

  async function createCategory() {
    const name = newCategoryName.value.trim()
    if (!name) return

    const nextParentId = parentId.value
    newCategoryName.value = ''
    showAddCategory.value = false

    if (nextParentId) {
      expandNodePath(nextParentId)
    }

    await options.createCategoryRecord(name, nextParentId)
  }

  async function createItem() {
    const description = newItemDesc.value.trim()
    if (!description) return

    const sku = newItemSku.value.trim() || undefined
    const price = newItemPrice.value ? parseFloat(newItemPrice.value) : undefined

    resetTopLevelItemForm()
    await options.createCatalogItem(description, undefined, sku, price)
  }

  function cancelAddItem() {
    resetTopLevelItemForm()
  }

  const treeListeners: AdminCatalogTreeListeners = {
    'toggle-expand': options.toggleExpand,
    'add-child': openAddCategoryDialog,
    'add-item': openAddItemDialog,
    'edit-item': options.editItem,
    'save-item': options.saveItemFromTree,
    'delete-item': options.deleteItem,
    'archive-item': options.archiveItem,
    'reactivate-item': options.reactivateItem,
    'edit-category': options.editCategory,
    'save-category': options.saveCategoryEdit,
    'cancel-category-edit': options.cancelCategoryEdit,
    'cancel-item-edit': options.cancelItemEdit,
    archive: options.archiveCategory,
    reactivate: options.reactivateCategory,
    'delete-category': options.deleteCategory,
    'update:editCategoryName': (name: string) => {
      options.editCategoryName.value = name
    },
  }

  return {
    newCategoryName,
    newItemDesc,
    newItemSku,
    newItemPrice,
    showAddCategory,
    showAddItemForm,
    parentId,
    openAddCategoryDialog,
    closeAddCategoryDialog,
    openAddItemDialog,
    createCategory,
    createItem,
    cancelAddItem,
    treeListeners,
  }
}
