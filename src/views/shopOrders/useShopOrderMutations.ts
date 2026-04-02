import { ref } from 'vue'
import { useShopOrderItemActions } from '@/views/shopOrders/useShopOrderItemActions'
import { useShopOrderWorkflowActions } from '@/views/shopOrders/useShopOrderWorkflowActions'
import type {
  ShopOrderMutationState,
  UseShopOrderMutationsOptions,
} from '@/views/shopOrders/shopOrderMutationTypes'

export type { ShopOrderConfirmFn, UseShopOrderMutationsOptions } from '@/views/shopOrders/shopOrderMutationTypes'

export function useShopOrderMutations(options: UseShopOrderMutationsOptions) {
  const state: ShopOrderMutationState = {
    newItemDescription: ref(''),
    newItemCatalogId: ref<string | null>(null),
    newItemQty: ref(''),
    newItemNote: ref(''),
    selectedCatalogItem: ref(null),
    catalogItemQtys: ref<Record<string, number>>({}),
    sendingEmail: ref(false),
    deletingOrderId: ref<string | null>(null),
  }

  const itemActions = useShopOrderItemActions(options, state)
  const workflowActions = useShopOrderWorkflowActions(options, state)

  return {
    newItemDescription: state.newItemDescription,
    newItemQty: state.newItemQty,
    newItemNote: state.newItemNote,
    catalogItemQtys: state.catalogItemQtys,
    sendingEmail: state.sendingEmail,
    deletingOrderId: state.deletingOrderId,
    ...itemActions,
    ...workflowActions,
  }
}
