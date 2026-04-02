import { computed, ref, watch } from 'vue'
import type { ShopCatalogItem } from '@/services'

export type CatalogTreeItemSaveUpdates = {
  description: string
  sku?: string | null
  price?: number | null
}

type UseCatalogTreeItemRowOptions = {
  hasChildren: boolean
  isEditingItem: boolean
  item: ShopCatalogItem
}

export function useCatalogTreeItemRow(options: UseCatalogTreeItemRowOptions) {
  const editDesc = ref('')
  const editSku = ref('')
  const editPrice = ref('')
  const editSkuOriginal = ref('')
  const editPriceOriginal = ref('')
  const isSaving = ref(false)
  const showActions = ref(false)

  const showItemPurchasingFields = computed(() => !options.hasChildren)

  function syncItemEditFields() {
    editDesc.value = options.item.description
    editSku.value = options.item.sku || ''
    editPrice.value = options.item.price?.toString() || ''
    editSkuOriginal.value = editSku.value
    editPriceOriginal.value = editPrice.value
  }

  watch(() => options.isEditingItem, (editing) => {
    if (editing) {
      syncItemEditFields()
      return
    }

    isSaving.value = false
    showActions.value = false
  }, { immediate: true })

  function toggleActions() {
    showActions.value = !showActions.value
  }

  function createSaveUpdates(): CatalogTreeItemSaveUpdates | null {
    const description = editDesc.value.trim()
    if (!description) {
      return null
    }

    isSaving.value = true

    const updates: CatalogTreeItemSaveUpdates = { description }

    if (showItemPurchasingFields.value) {
      const skuValue = editSku.value.trim()
      if (skuValue !== editSkuOriginal.value.trim()) {
        updates.sku = skuValue || null
      }

      if (editPrice.value !== editPriceOriginal.value) {
        updates.price = editPrice.value ? parseFloat(editPrice.value) : null
      }
    }

    return updates
  }

  function stopEditingState() {
    isSaving.value = false
  }

  return {
    editDesc,
    editSku,
    editPrice,
    isSaving,
    showActions,
    showItemPurchasingFields,
    syncItemEditFields,
    toggleActions,
    createSaveUpdates,
    stopEditingState,
  }
}
