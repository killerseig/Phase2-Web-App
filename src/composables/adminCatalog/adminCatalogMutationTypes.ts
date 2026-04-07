import type { Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import type { ShopCatalogItem } from '@/services'
import type { ConfirmVariant } from '@/stores/confirm'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { type ShopCategory, useShopCategoriesStore } from '@/stores/shopCategories'
import type { CatalogTreeChildNodeMap } from '@/utils/catalogTree'

export type ConfirmFn = (
  message: string,
  options?: {
    title?: string
    confirmText?: string
    variant?: ConfirmVariant
  },
) => Promise<boolean>

export type UseAdminCatalogMutationsOptions = {
  categoriesStore: ReturnType<typeof useShopCategoriesStore>
  catalogStore: ReturnType<typeof useShopCatalogStore>
  categories: Ref<ShopCategory[]>
  allItems: Ref<ShopCatalogItem[]>
  getChildIds: () => CatalogTreeChildNodeMap
  confirm: ConfirmFn
  toast: ToastNotifier
}

export type AdminCatalogMutationState = {
  saving: Ref<boolean>
  editingItemId: Ref<string | null>
  editingCategoryId: Ref<string | null>
  editCategoryName: Ref<string>
  editCategoryNameOriginal: Ref<string>
  savingCategoryEdit: Ref<boolean>
  inlineDraftItem: Ref<ShopCatalogItem | null>
}
