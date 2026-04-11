<script setup lang="ts">
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListCard from '@/components/common/AppListCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import ShopOrderStatusBadge from '@/components/shopOrders/ShopOrderStatusBadge.vue'
import { getShopOrderDisplayNumber, type ShopOrder } from '@/services'
import { summarizeShopOrderItems } from '@/utils/shopOrderItems'

defineOptions({
  name: 'ShopOrderListCard',
})

interface Props {
  orders: ShopOrder[]
  loading: boolean
  selectedId?: string | null
  deletingOrderId?: string | null
  formatDate: (ts: unknown) => string
}

withDefaults(defineProps<Props>(), {
  selectedId: null,
  deletingOrderId: null,
})

const emit = defineEmits<{
  select: [orderId: string]
  delete: [orderId: string]
}>()

function handleOrderSelect(orderId: string) {
  emit('select', orderId)
}

function handleDeleteOrderClick(event: MouseEvent, orderId: string) {
  event.stopPropagation()
  emit('delete', orderId)
}

function canDeleteOrder(order: ShopOrder): boolean {
  return order.status === 'draft'
}

function getReceiptSummary(order: ShopOrder): string {
  const summary = summarizeShopOrderItems(order.items)
  if (summary.orderedQuantity <= 0) return 'No items'

  return `${summary.receivedQuantity}/${summary.orderedQuantity} received`
}
</script>

<template>
  <AppListCard
    title="Orders"
    icon="bi bi-bag"
    :badge-label="orders.length"
    muted
  >
    <div v-if="loading" class="text-center py-5"><div class="spinner-border spinner-border-sm"></div></div>
    <AppEmptyState
      v-else-if="!orders.length"
      icon="bi bi-inbox"
      icon-class="fs-4"
      title="No orders yet"
      message="Create one to get started"
      message-class="small mb-0"
    />
    <div v-else class="list-group list-group-flush">
      <AppSelectableListItem
        v-for="order in orders"
        :key="order.id"
        class="order-list-item text-start d-flex justify-content-between align-items-start gap-3"
        :selected="selectedId === order.id"
        @activate="handleOrderSelect(order.id)"
      >
        <div class="me-2">
          <div class="fw-semibold">{{ formatDate(order.orderDate) }}</div>
          <div class="app-selectable-list-meta small">Order #{{ getShopOrderDisplayNumber(order) }}</div>
          <div class="small mt-1 app-selectable-list-meta">{{ order.items.length }} item(s)</div>
          <div class="small app-selectable-list-meta">{{ getReceiptSummary(order) }}</div>
          <div
            v-if="order.requestedDeliveryDate"
            class="small app-selectable-list-meta"
          >
            Requested {{ order.requestedDeliveryDate }}
          </div>
        </div>
        <div class="d-flex flex-column align-items-end gap-2">
          <ShopOrderStatusBadge :status="order.status" />
          <button
            v-if="canDeleteOrder(order)"
            type="button"
            class="btn btn-sm btn-outline-danger order-delete-btn"
            :disabled="deletingOrderId === order.id"
            @click="handleDeleteOrderClick($event, order.id)"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </AppSelectableListItem>
    </div>
  </AppListCard>
</template>
