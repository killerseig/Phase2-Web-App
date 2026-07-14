import { computed, ref } from 'vue'
import {
  getShopCatalogConfirmLabel,
  getShopCatalogConfirmMessage,
  getShopCatalogConfirmTitle,
  isShopCatalogConfirmDestructive,
  type ShopCatalogConfirmAction,
} from '@/features/shopCatalog/adminViewHelpers'

interface ReadonlyRef<T> {
  readonly value: T
}

export function useShopCatalogConfirmDialog(isBusy: ReadonlyRef<boolean>) {
  const catalogConfirmAction = ref<ShopCatalogConfirmAction | null>(null)

  const catalogConfirmTitle = computed(() => getShopCatalogConfirmTitle(catalogConfirmAction.value))
  const catalogConfirmMessage = computed(() => getShopCatalogConfirmMessage(catalogConfirmAction.value))
  const catalogConfirmLabel = computed(() => getShopCatalogConfirmLabel(catalogConfirmAction.value))
  const catalogConfirmDestructive = computed(() => isShopCatalogConfirmDestructive(catalogConfirmAction.value))

  function handleCatalogConfirmOpenUpdate(open: boolean) {
    if (open || isBusy.value) return
    catalogConfirmAction.value = null
  }

  return {
    catalogConfirmAction,
    catalogConfirmDestructive,
    catalogConfirmLabel,
    catalogConfirmMessage,
    catalogConfirmTitle,
    handleCatalogConfirmOpenUpdate,
  }
}
