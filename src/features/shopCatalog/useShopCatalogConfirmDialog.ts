import { useActionConfirmDialog } from '@/composables/useActionConfirmDialog'
import {
  getShopCatalogConfirmLabel,
  getShopCatalogConfirmMessage,
  getShopCatalogConfirmTitle,
  isShopCatalogConfirmDestructive,
  type ShopCatalogConfirmAction,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ReadonlyRef } from '@/types/reactivity'

export function useShopCatalogConfirmDialog(isBusy: ReadonlyRef<boolean>) {
  const {
    confirmAction: catalogConfirmAction,
    confirmDestructive: catalogConfirmDestructive,
    confirmLabel: catalogConfirmLabel,
    confirmMessage: catalogConfirmMessage,
    confirmTitle: catalogConfirmTitle,
    handleConfirmOpenUpdate: handleCatalogConfirmOpenUpdate,
  } = useActionConfirmDialog<ShopCatalogConfirmAction>({
    getLabel: getShopCatalogConfirmLabel,
    getMessage: getShopCatalogConfirmMessage,
    getTitle: getShopCatalogConfirmTitle,
    isBusy,
    isDestructive: isShopCatalogConfirmDestructive,
  })

  return {
    catalogConfirmAction,
    catalogConfirmDestructive,
    catalogConfirmLabel,
    catalogConfirmMessage,
    catalogConfirmTitle,
    handleCatalogConfirmOpenUpdate,
  }
}
