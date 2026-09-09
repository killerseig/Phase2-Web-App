<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppEntityHeader from '@/components/common/AppEntityHeader.vue'
import ShopOrderMetaForm from '@/components/shopOrders/ShopOrderMetaForm.vue'
import type { ShopOrderRecord } from '@/types/domain'
import {
  formatShopOrderTimestamp,
  getShopOrderDisplayLabel,
  getShopOrderNumberLabel,
  getShopOrderStatusLabel,
} from '@/utils/shopOrders'

defineProps<{
  canEdit: boolean
  comments: string
  deliveryDate: string
  itemCount: number
  minDeliveryDate: string
  order: ShopOrderRecord
  orderEstimatedTotal: number | null
  totalQuantity: number
}>()

const emit = defineEmits<{
  applyThursdayDelivery: []
  'update:comments': [value: string]
  'update:deliveryDate': [value: string]
}>()
</script>

<template>
  <section class="shop-order-selected-panel">
    <AppEntityHeader
      class="shop-order-selected-panel__header"
      :eyebrow="getShopOrderNumberLabel(order)"
      identity-class="shop-order-selected-panel__identity shop-orders-workspace-strip__identity"
      :title="getShopOrderDisplayLabel(order)"
    >
      <template #actions>
        <div class="shop-order-selected-panel__status">
          <AppBadge class="shop-order-selected-panel__badge" tone="accent">
            {{ getShopOrderStatusLabel(order) }}
          </AppBadge>
          <AppBadge class="shop-order-selected-panel__badge" tone="accent">
            {{ itemCount }} items
          </AppBadge>
          <AppBadge class="shop-order-selected-panel__badge" tone="accent">
            {{ totalQuantity }} total qty
          </AppBadge>
        </div>
      </template>
    </AppEntityHeader>

    <ShopOrderMetaForm
      :can-edit="canEdit"
      :comments="comments"
      :delivery-date="deliveryDate"
      :min-delivery-date="minDeliveryDate"
      :readonly-comments="order.comments"
      :readonly-delivery-date="order.deliveryDate"
      @update:delivery-date="emit('update:deliveryDate', $event)"
      @update:comments="emit('update:comments', $event)"
      @apply-thursday-delivery="emit('applyThursdayDelivery')"
    />

    <div class="shop-order-selected-panel__meta">
      <span>Created {{ formatShopOrderTimestamp(order.createdAt) }}</span>
      <span>{{ order.foremanName || 'Unknown owner' }}</span>
      <span v-if="order.submittedAt">Submitted {{ formatShopOrderTimestamp(order.submittedAt) }}</span>
    </div>
  </section>
</template>

<style scoped>
.shop-order-selected-panel {
  --app-entity-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-entity-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-entity-header-title-font-size: 0.94rem;
  --app-entity-header-title-font-weight: 600;
  --app-entity-header-title-line-height: 1.2;
  --app-entity-header-actions-gap: 0.35rem;
  display: grid;
  gap: 0.28rem;
  min-width: 0;
  min-height: 0;
  padding: 0.05rem 0 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-order-selected-panel__status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
  min-width: 0;
}

.shop-order-selected-panel__badge {
  --app-badge-flex: 0 0 auto;
  --app-badge-min-height: 1.55rem;
  --app-badge-padding: 0 0.5rem;
  --app-badge-white-space: nowrap;
  --app-badge-accent-border-color: var(--border);
  --app-badge-accent-background: var(--field);
}

.shop-order-selected-panel__meta span {
  color: var(--text-muted);
}

.shop-order-selected-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.18rem 0.7rem;
  padding: 0.08rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
}

.shop-order-selected-panel__meta span {
  font-size: 0.74rem;
  line-height: 1.18;
  letter-spacing: 0.02em;
}

@media (max-width: 820px) {
  .shop-order-selected-panel {
    gap: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .shop-order-selected-panel__header {
    --app-entity-header-actions-width: 100%;
  }

  .shop-order-selected-panel__status {
    justify-content: flex-start;
  }

  .shop-order-selected-panel__badge {
    --app-badge-min-height: 1.42rem;
    --app-badge-padding: 0 0.42rem;
  }
}

</style>
