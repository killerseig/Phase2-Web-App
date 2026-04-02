import type { ComputedRef, Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import type { ShopOrder } from '@/services'
import type { ConfirmVariant } from '@/stores/confirm'
import type { CatalogOrderSelection } from '@/types/shopOrders'

export type ShopOrderConfirmFn = (
  message: string,
  options?: {
    title?: string
    confirmText?: string
    variant?: ConfirmVariant
  },
) => Promise<boolean>

export type UseShopOrderMutationsOptions = {
  jobId: ComputedRef<string>
  orders: Ref<ShopOrder[]>
  selected: ComputedRef<ShopOrder | null>
  selectedId: Ref<string | null>
  shopOrderRecipients: Ref<string[]>
  toast?: ToastNotifier
  confirm?: ShopOrderConfirmFn
}

export type ShopOrderMutationState = {
  newItemDescription: Ref<string>
  newItemCatalogId: Ref<string | null>
  newItemQty: Ref<string>
  newItemNote: Ref<string>
  selectedCatalogItem: Ref<CatalogOrderSelection | null>
  catalogItemQtys: Ref<Record<string, number>>
  sendingEmail: Ref<boolean>
  deletingOrderId: Ref<string | null>
}
