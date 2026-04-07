import { ref, type Ref } from 'vue'
import type { ShopCatalogItem } from '@/services'

type UseAdminCatalogCreateFormsOptions = {
  inlineDraftItem: Ref<ShopCatalogItem | null>
  editingItemId: Ref<string | null>
  editingCategoryId: Ref<string | null>
  expandNodePath: (nodeId: string) => void
  createCategoryRecord: (name: string, parentId: string | null) => Promise<void>
  createCatalogItem: (description: string, categoryId?: string, sku?: string, price?: number) => Promise<void>
}

function createInlineDraftItem(categoryId: string): ShopCatalogItem {
  return {
    id: `draft-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    categoryId,
    active: true,
    sku: undefined,
    price: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function useAdminCatalogCreateForms(options: UseAdminCatalogCreateFormsOptions) {
  const newCategoryName = ref('')
  const newItemDesc = ref('')
  const newItemSku = ref('')
  const newItemPrice = ref('')
  const showAddCategory = ref(false)
  const showAddItemForm = ref(false)
  const parentId = ref<string | null>(null)

  function resetTopLevelItemForm() {
    newItemDesc.value = ''
    newItemSku.value = ''
    newItemPrice.value = ''
    showAddItemForm.value = false
  }

  function openAddCategoryDialog(id: string | null = null) {
    parentId.value = id
    newCategoryName.value = ''
    showAddCategory.value = true
  }

  function closeAddCategoryDialog() {
    showAddCategory.value = false
  }

  function openAddItemDialog(id: string | null = null) {
    if (!id) {
      resetTopLevelItemForm()
      showAddItemForm.value = true
      return
    }

    options.inlineDraftItem.value = createInlineDraftItem(id)
    options.editingItemId.value = options.inlineDraftItem.value.id
    options.editingCategoryId.value = null
    options.expandNodePath(id)
  }

  async function createCategory() {
    const name = newCategoryName.value.trim()
    if (!name) return

    const nextParentId = parentId.value
    newCategoryName.value = ''
    showAddCategory.value = false

    if (nextParentId) {
      options.expandNodePath(nextParentId)
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
  }
}
