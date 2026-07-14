import { reactive, type Ref } from 'vue'
import {
  createEmptyShopCatalogCategoryForm,
  createEmptyShopCatalogItemForm,
  formatShopCatalogPriceInputValue as formatPriceInputValue,
  hydrateShopCatalogCategoryForm,
  hydrateShopCatalogItemForm,
  parseShopCatalogPrice as parsePrice,
  resetShopCatalogCategoryForm,
  resetShopCatalogItemForm,
  sanitizeShopCatalogPriceInput as sanitizePriceInput,
  type ShopCatalogCategoryFormState,
  type ShopCatalogItemFormState,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import { readInputValue } from '@/utils/domEvents'

interface UseShopCatalogFormsOptions {
  activeFolderId: Ref<string | null>
  createError: Ref<string>
  detailError: Ref<string>
  detailInfo: Ref<string>
}

export function useShopCatalogForms({
  activeFolderId,
  createError,
  detailError,
  detailInfo,
}: UseShopCatalogFormsOptions) {
  const createCategoryForm = reactive<ShopCatalogCategoryFormState>(createEmptyShopCatalogCategoryForm())
  const createItemForm = reactive<ShopCatalogItemFormState>(createEmptyShopCatalogItemForm())
  const detailCategoryForm = reactive<ShopCatalogCategoryFormState>(createEmptyShopCatalogCategoryForm())
  const detailItemForm = reactive<ShopCatalogItemFormState>(createEmptyShopCatalogItemForm())

  function resetCreateCategoryForm() {
    resetShopCatalogCategoryForm(createCategoryForm, activeFolderId.value)
    createError.value = ''
  }

  function resetCreateItemForm() {
    resetShopCatalogItemForm(createItemForm, activeFolderId.value)
    createError.value = ''
  }

  function prepareCreateItemForm(parentId: string | null) {
    resetShopCatalogItemForm(createItemForm, parentId)
    createError.value = ''
  }

  function applySelectedCategoryToForm(category: ShopCategoryRecord | null) {
    detailError.value = ''
    detailInfo.value = ''
    hydrateShopCatalogCategoryForm(detailCategoryForm, category)
  }

  function applySelectedItemToForm(item: ShopCatalogItemRecord | null) {
    detailError.value = ''
    detailInfo.value = ''
    hydrateShopCatalogItemForm(detailItemForm, item)
  }

  function handlePriceInput(form: ShopCatalogItemFormState, event: Event) {
    form.price = sanitizePriceInput(readInputValue(event))
  }

  function handlePriceFocus(form: ShopCatalogItemFormState) {
    const parsed = parsePrice(form.price)
    form.price = parsed == null ? sanitizePriceInput(form.price) : parsed.toFixed(2)
  }

  function handlePriceBlur(form: ShopCatalogItemFormState) {
    const parsed = parsePrice(form.price)
    form.price = parsed == null ? '' : formatPriceInputValue(parsed)
  }

  return {
    applySelectedCategoryToForm,
    applySelectedItemToForm,
    createCategoryForm,
    createItemForm,
    detailCategoryForm,
    detailItemForm,
    handlePriceBlur,
    handlePriceFocus,
    handlePriceInput,
    prepareCreateItemForm,
    resetCreateCategoryForm,
    resetCreateItemForm,
  }
}
