import { computed } from 'vue'
import {
  getShopOrderItemCount,
  getShopOrderTotalQuantity,
  getSortedShopOrderItems,
} from '@/features/shopOrders/viewHelpers'
import type { JobRecord, ShopCategoryRecord, ShopOrderRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseShopOrderWorkspaceStateOptions {
  categories: ReadonlyRef<ShopCategoryRecord[]>
  createOrderLoading: ReadonlyRef<boolean>
  itemActionLoading: ReadonlyRef<boolean>
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  orders: ReadonlyRef<ShopOrderRecord[]>
  selectedOrderId: ReadonlyRef<string | null>
}

export function useShopOrderWorkspaceState({
  categories,
  createOrderLoading,
  itemActionLoading,
  job,
  jobId,
  orders,
  selectedOrderId,
}: UseShopOrderWorkspaceStateOptions) {
  const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
  const selectedOrder = computed(() =>
    orders.value.find((order) => order.id === selectedOrderId.value) ?? null,
  )
  const canEditSelectedOrder = computed(() => selectedOrder.value?.status === 'draft')
  const draftOrders = computed(() => orders.value.filter((order) => order.status === 'draft'))
  const submittedOrders = computed(() => orders.value.filter((order) => order.status === 'submitted'))
  const orderMutationDisabled = computed(
    () => itemActionLoading.value || createOrderLoading.value || !jobId.value || !job.value,
  )
  const orderItemCount = computed(() => getShopOrderItemCount(selectedOrder.value))
  const orderTotalQuantity = computed(() => getShopOrderTotalQuantity(selectedOrder.value))
  const sortedSelectedOrderItems = computed(() => getSortedShopOrderItems(selectedOrder.value?.items ?? []))

  return {
    canEditSelectedOrder,
    categoriesById,
    draftOrders,
    orderItemCount,
    orderMutationDisabled,
    orderTotalQuantity,
    selectedOrder,
    sortedSelectedOrderItems,
    submittedOrders,
  }
}
