<script setup lang="ts">
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { ShopOrderRecord } from '@/types/domain'
import { getShopOrderDisplayNumber } from '@/utils/shopOrders'

defineProps<{
  canEdit: boolean
  comments: string
  deliveryDate: string
  itemCount: number
  minDeliveryDate: string
  order: ShopOrderRecord
  totalQuantity: number
}>()

const emit = defineEmits<{
  applyThursdayDelivery: []
  'update:comments': [value: string]
  'update:deliveryDate': [value: string]
}>()

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatOrderTimestamp(value: unknown) {
  const millis = toMillis(value)
  if (!millis) return 'Unknown date'

  return new Date(millis).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getOrderStatusLabel(order: ShopOrderRecord) {
  return order.status === 'submitted' ? 'Submitted' : 'Draft'
}

function getOrderDisplayLabel(order: ShopOrderRecord) {
  const createdLabel = formatOrderTimestamp(order.createdAt)
  if (order.deliveryDate) {
    return `${getOrderStatusLabel(order)} / Due ${order.deliveryDate}`
  }

  return `${getOrderStatusLabel(order)} / ${createdLabel}`
}

function getOrderNumberLabel(order: ShopOrderRecord) {
  return `Order #${getShopOrderDisplayNumber(order)}`
}

function isThursdayDeliveryValue(value: string | null | undefined) {
  if (!value) return false
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false
  return new Date(year, month - 1, day).getDay() === 4
}
</script>

<template>
  <section class="shop-order-selected-panel">
    <header class="shop-order-selected-panel__header">
      <div class="shop-order-selected-panel__identity shop-orders-workspace-strip__identity">
        <span class="shop-order-selected-panel__eyebrow">
          {{ getOrderNumberLabel(order) }}
        </span>
        <strong class="shop-order-selected-panel__label">{{ getOrderDisplayLabel(order) }}</strong>
      </div>

      <div class="shop-order-selected-panel__status">
        <span class="shop-order-selected-panel__badge">{{ getOrderStatusLabel(order) }}</span>
        <span class="shop-order-selected-panel__badge">{{ itemCount }} items</span>
        <span class="shop-order-selected-panel__badge">{{ totalQuantity }} total qty</span>
      </div>
    </header>

    <div class="shop-order-selected-panel__controls">
      <label class="shop-order-selected-panel__field shop-order-selected-panel__field--delivery">
        <span>Delivery Date</span>
        <AppTextInput
          v-if="canEdit"
          :model-value="deliveryDate"
          data-testid="shoporder-delivery-date"
          type="date"
          :min="minDeliveryDate"
          :disabled="!canEdit"
          @update:model-value="emit('update:deliveryDate', $event)"
        />
        <div v-else class="shop-order-selected-panel__readonly" data-testid="shoporder-delivery-date-readonly">
          {{ order.deliveryDate || 'No delivery date' }}
        </div>
      </label>

      <div class="shop-order-selected-panel__field shop-order-selected-panel__field--shortcut">
        <span>Shortcut</span>
        <button
          v-if="canEdit"
          type="button"
          class="shop-order-selected-panel__shortcut-button"
          data-testid="shoporder-shortcut"
          :disabled="!canEdit"
          @click="emit('applyThursdayDelivery')"
        >
          Thursday Delivery
        </button>
        <div v-else class="shop-order-selected-panel__readonly" data-testid="shoporder-shortcut-readonly">
          {{ isThursdayDeliveryValue(order.deliveryDate) ? 'Thursday Delivery' : '-' }}
        </div>
      </div>

      <label class="shop-order-selected-panel__field shop-order-selected-panel__field--comments">
        <span>Comments</span>
        <AppTextInput
          v-if="canEdit"
          :model-value="comments"
          data-testid="shoporder-comments"
          type="text"
          :disabled="!canEdit"
          placeholder="Add delivery notes or special instructions."
          @update:model-value="emit('update:comments', $event)"
        />
        <div
          v-else
          class="shop-order-selected-panel__readonly shop-order-selected-panel__readonly--multiline"
          data-testid="shoporder-comments-readonly"
        >
          {{ order.comments || 'No comments' }}
        </div>
      </label>
    </div>

    <div class="shop-order-selected-panel__meta">
      <span>Created {{ formatOrderTimestamp(order.createdAt) }}</span>
      <span>{{ order.foremanName || 'Unknown owner' }}</span>
      <span v-if="order.submittedAt">Submitted {{ formatOrderTimestamp(order.submittedAt) }}</span>
    </div>
  </section>
</template>

<style scoped>
.shop-order-selected-panel {
  display: grid;
  gap: 0.28rem;
  min-width: 0;
  min-height: 0;
  padding: 0.05rem 0 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-order-selected-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.4rem;
  min-height: 1.4rem;
}

.shop-order-selected-panel__identity {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.shop-order-selected-panel__eyebrow {
  display: inline-flex;
  color: var(--accent-strong);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.shop-order-selected-panel__label {
  line-height: 1.2;
  font-size: 0.94rem;
  font-weight: 600;
}

.shop-order-selected-panel__status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: flex-end;
  min-width: 0;
}

.shop-order-selected-panel__badge {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 1.55rem;
  padding: 0 0.5rem;
  border: 1px solid rgba(99, 199, 230, 0.25);
  border-radius: 999px;
  background: rgba(30, 83, 100, 0.3);
  color: var(--accent);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.shop-order-selected-panel__controls {
  display: grid;
  grid-template-columns: minmax(9rem, 10.5rem) minmax(9rem, 10.5rem) minmax(12rem, 1fr);
  gap: 0.45rem;
  align-items: center;
}

.shop-order-selected-panel__field {
  --app-text-input-min-height: var(--shop-control-height);
  --app-text-input-padding-x: 0.8rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 5px 12px rgba(3, 10, 16, 0.08);
  display: grid;
  gap: 0.3rem;
  color: var(--text-muted);
}

.shop-order-selected-panel__field > span,
.shop-order-selected-panel__meta span {
  color: var(--text-muted);
}

.shop-order-selected-panel__field > span {
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-order-selected-panel__field--delivery,
.shop-order-selected-panel__field--shortcut {
  align-content: start;
}

.shop-order-selected-panel__field--comments {
  --app-text-input-min-height: 2rem;
}

.shop-order-selected-panel__field--comments :deep(.app-text-input) {
  min-height: 2rem;
}

.shop-order-selected-panel__shortcut-button {
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--shop-radius-md);
  background: var(--shop-field);
  color: var(--text);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 5px 12px rgba(3, 10, 16, 0.08);
}

.shop-order-selected-panel__readonly {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--shop-line-soft);
  border-radius: var(--shop-radius-md);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text);
}

.shop-order-selected-panel__readonly--multiline {
  min-height: 2rem;
  white-space: pre-wrap;
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

.shop-order-selected-panel__shortcut-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.95rem;
  line-height: 1;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.shop-order-selected-panel__shortcut-button:hover:not(:disabled) {
  border-color: rgba(145, 220, 255, 0.28);
  background: var(--shop-surface-soft);
  transform: none;
}

.shop-order-selected-panel__shortcut-button:disabled {
  opacity: 0.65;
}

@media (max-width: 980px) {
  .shop-order-selected-panel__controls,
  .shop-order-selected-panel__meta {
    grid-template-columns: 1fr;
  }
}
</style>
