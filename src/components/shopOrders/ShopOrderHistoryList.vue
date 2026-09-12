<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListButton from '@/components/common/AppListButton.vue'
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
    panel
    class="shop-orders-pane__empty shop-orders-pane__empty--compact"
    message="No shop orders exist for this job yet."
  />

  <div v-else class="app-history-list shop-orders-history-list">
    <AppListButton
      v-for="order in orders"
      :key="order.id"
      class="app-history-row shop-orders-history-row"
      :active="selectedOrderId === order.id"
      :aria-pressed="selectedOrderId === order.id"
      @click="emit('select', order.id)"
    >
      <div class="app-history-row__main">
        <strong>{{ getShopOrderDisplayLabel(order) }}</strong>
        <div class="app-history-row__meta">
          <span>{{ getShopOrderNumberLabel(order) }}</span>
          <span>{{ formatShopOrderTimestamp(order.submittedAt || order.updatedAt || order.createdAt) }}</span>
          <span>{{ order.items.length }} {{ order.items.length === 1 ? 'item' : 'items' }}</span>
          <span>{{ order.deliveryDate || 'No delivery date' }}</span>
        </div>
      </div>
      <AppBadge class="app-history-row__badge" tone="accent">
        {{ getShopOrderStatusLabel(order) }}
      </AppBadge>
    </AppListButton>
  </div>
</template>

<style src="../common/history-list.css"></style>

<style scoped>
.shop-orders-pane__empty--compact {
  --app-empty-state-min-height: 6rem;
}
</style>
