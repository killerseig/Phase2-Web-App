<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import ShopOrderStatusBadge from '@/components/shopOrders/ShopOrderStatusBadge.vue'
import type { ShopOrder } from '@/services'

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

function handleOrderKeySelect(event: KeyboardEvent, orderId: string) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleOrderSelect(orderId)
}

function handleDeleteOrderClick(event: MouseEvent, orderId: string) {
  event.stopPropagation()
  emit('delete', orderId)
}

function canDeleteOrder(order: ShopOrder): boolean {
  return order.status === 'draft'
}
</script>

<template>
  <div class="card panel-muted app-list-card">
    <div class="card-header panel-header d-flex justify-content-between align-items-center">
      <h5 class="mb-0"><i class="bi bi-bag me-2"></i>Orders</h5>
      <AppBadge :label="orders.length" />
    </div>
    <div v-if="loading" class="card-body text-center py-5"><div class="spinner-border spinner-border-sm"></div></div>
    <AppEmptyState
      v-else-if="!orders.length"
      class="card-body"
      icon="bi bi-inbox"
      icon-class="fs-4"
      title="No orders yet"
      message="Create one to get started"
      message-class="small mb-0"
    />
    <div v-else class="list-group list-group-flush">
      <div
        v-for="order in orders"
        :key="order.id"
        role="button"
        tabindex="0"
        class="list-group-item list-group-item-action text-start order-list-item d-flex justify-content-between align-items-start gap-3"
        :class="{ active: selectedId === order.id }"
        @click="handleOrderSelect(order.id)"
        @keydown="handleOrderKeySelect($event, order.id)"
      >
        <div class="me-2">
          <div class="fw-semibold">{{ formatDate(order.orderDate) }}</div>
          <div class="order-meta small">{{ order.id.slice(0, 8) }}</div>
          <div class="small mt-1 order-meta">{{ order.items.length }} item(s)</div>
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
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.order-list-item {
  background: $surface;
  color: $body-color;
  border-color: rgba($border-color, 0.6);
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background-color: mix($primary, $surface, 12%);
  }
}

.order-meta {
  color: rgba($body-color, 0.72);
}

.order-list-item.active {
  background: linear-gradient(135deg, mix($primary, $surface, 20%), mix($primary, $surface, 28%));
  border-color: mix($primary, $border-color, 55%);
  color: $body-color;
  box-shadow: 0 0 0 1px rgba($primary, 0.35);
}

.order-list-item:focus-visible {
  outline: 2px solid $primary;
  outline-offset: -4px;
}

.order-list-item.active .order-meta {
  color: rgba($body-color, 0.9);
}

.order-list-item:active {
  background-color: mix($primary, $surface, 16%);
}

.order-delete-btn {
  line-height: 1;
  padding: 0.2rem 0.4rem;
}
</style>
