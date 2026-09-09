<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import type { ShopOrderRecord } from '@/types/domain'
import {
  formatShopOrderTimestamp,
  getShopOrderDisplayLabel,
  getShopOrderNumberLabel,
  getShopOrderStatusLabel,
} from '@/utils/shopOrders'

defineProps<{
  orders: ShopOrderRecord[]
  selectedOrderId: string | null
}>()

const emit = defineEmits<{
  select: [orderId: string]
}>()
</script>

<template>
  <AppEmptyState
    v-if="orders.length === 0"
    class="shop-orders-pane__empty shop-orders-pane__empty--compact"
    message="No shop orders exist for this job yet."
  />

  <div v-else class="shop-orders-history-list">
    <button
      v-for="order in orders"
      :key="order.id"
      type="button"
      class="shop-orders-history-row"
      :class="{ 'shop-orders-history-row--active': selectedOrderId === order.id }"
      @click="emit('select', order.id)"
    >
      <div class="shop-orders-history-row__main">
        <strong>{{ getShopOrderDisplayLabel(order) }}</strong>
        <div class="shop-orders-history-row__meta">
          <span>{{ getShopOrderNumberLabel(order) }}</span>
          <span>{{ formatShopOrderTimestamp(order.submittedAt || order.updatedAt || order.createdAt) }}</span>
          <span>{{ order.items.length }} items</span>
          <span>{{ order.deliveryDate || 'No delivery date' }}</span>
        </div>
      </div>
      <AppBadge class="shop-orders-badge" tone="accent">
        {{ getShopOrderStatusLabel(order) }}
      </AppBadge>
    </button>
  </div>
</template>

<style scoped>
.shop-orders-history-list {
  display: grid;
  align-content: start;
  gap: 0;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0;
  border-top: 1px solid var(--shop-line-soft);
}

.shop-orders-history-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.25rem;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.42rem 0.15rem;
  border: 0;
  border-bottom: 1px solid var(--shop-line-soft);
  border-radius: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.shop-orders-history-row:hover {
  background: var(--field-hover);
}

.shop-orders-history-row--active,
.shop-orders-history-row--active:hover {
  border-color: var(--border-strong);
  background: var(--bg-accent);
}

.shop-orders-history-row:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.shop-orders-history-row__main {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.shop-orders-history-row__main strong {
  font-size: 0.88rem;
  font-weight: 600;
}

.shop-orders-history-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.14rem 0.65rem;
}

.shop-orders-history-row__main span,
.shop-orders-history-row__meta span {
  color: var(--text-muted);
  font-size: 0.76rem;
}

.shop-orders-badge {
  --app-badge-flex: 0 0 auto;
  --app-badge-padding: 0 0.5rem;
  --app-badge-white-space: nowrap;
  justify-content: center;
}

.shop-orders-pane__empty {
  display: grid;
  place-content: center;
  min-height: 8.5rem;
  padding: 0.85rem;
  border: 1px dashed rgba(140, 162, 186, 0.1);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  text-align: center;
}

.shop-orders-pane__empty--compact {
  min-height: 6rem;
}

</style>
