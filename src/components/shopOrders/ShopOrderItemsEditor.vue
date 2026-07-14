<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'
import { readInputValue } from '@/utils/domEvents'
import { getShopOrderItemDisplayName } from '@/utils/shopOrders'

const props = defineProps<{
  canEdit: boolean
  itemActionLoading: boolean
  items: ShopOrderItemRecord[]
  noteDrafts: Record<string, string>
  ordersCount: number
  ordersLoading: boolean
  selectedOrder: ShopOrderRecord | null
}>()

const emit = defineEmits<{
  remove: [itemId: string]
  saveNote: [itemId: string]
  updateNoteDraft: [itemId: string, value: string]
  updateQuantity: [itemId: string, value: string]
}>()

function getOrderItemKey(item: ShopOrderItemRecord) {
  return item.catalogItemId || item.id
}

function getOrderItemNoteInputValue(item: ShopOrderItemRecord) {
  return props.noteDrafts[item.id] ?? item.note ?? ''
}
</script>

<template>
  <div v-if="ordersLoading && ordersCount === 0" class="shop-orders-pane__empty">
    Loading orders...
  </div>

  <div v-else-if="!selectedOrder" class="shop-orders-pane__empty" data-testid="shoporder-empty">
    Add a catalog item or custom item to start a new order.
  </div>

  <div v-else-if="selectedOrder.items.length === 0" class="shop-orders-pane__empty" data-testid="shoporder-empty">
    Nothing has been added to this order yet. Use the catalog browser or custom item form to build it.
  </div>

  <div v-else class="shop-orders-items-list">
    <div
      class="shop-orders-items-head"
      :class="{ 'shop-orders-items-head--readonly': !canEdit }"
    >
      <span>Description</span>
      <span>Qty</span>
      <span>Note</span>
      <span v-if="canEdit"></span>
    </div>

    <article
      v-for="item in items"
      :key="item.id"
      class="shop-orders-item-card shop-orders-item-card--line"
      :data-testid="`shoporder-order-item-${getOrderItemKey(item)}`"
      :class="{ 'shop-orders-item-card--readonly': !canEdit }"
    >
      <div class="shop-orders-item-card__main">
        <strong class="shop-orders-item-card__name">{{ getShopOrderItemDisplayName(item) }}</strong>
        <span
          v-if="item.sourceType !== 'catalog' || item.sku"
          class="shop-orders-item-card__meta"
        >
          <template v-if="item.sourceType !== 'catalog'">Custom</template>
          <template v-if="item.sourceType !== 'catalog' && item.sku"> - </template>
          <template v-if="item.sku">SKU {{ item.sku }}</template>
        </span>
      </div>

      <AppTextInput
        v-if="canEdit"
        class="shop-orders-item-card__qty-input"
        :model-value="String(item.quantity ?? 1)"
        :data-testid="`shoporder-order-item-qty-${getOrderItemKey(item)}`"
        type="number"
        min="1"
        step="1"
        inputmode="numeric"
        aria-label="Quantity"
        :disabled="!canEdit"
        @change="emit('updateQuantity', item.id, readInputValue($event))"
      />
      <div
        v-else
        class="shop-orders-readonly-value shop-orders-readonly-value--centered"
        :data-testid="`shoporder-order-item-qty-readonly-${getOrderItemKey(item)}`"
      >
        {{ item.quantity ?? 1 }}
      </div>

      <AppTextInput
        v-if="canEdit"
        class="shop-orders-item-card__note-input"
        :model-value="getOrderItemNoteInputValue(item)"
        :data-testid="`shoporder-order-item-note-${getOrderItemKey(item)}`"
        type="text"
        autocomplete="off"
        aria-label="Note"
        :disabled="!canEdit"
        placeholder="Optional note"
        @update:model-value="emit('updateNoteDraft', item.id, $event)"
        @blur="emit('saveNote', item.id)"
      />
      <div
        v-else
        class="shop-orders-readonly-value shop-orders-readonly-value--multiline"
        :data-testid="`shoporder-order-item-note-readonly-${getOrderItemKey(item)}`"
      >
        {{ item.note || '-' }}
      </div>

      <AppButton
        v-if="canEdit"
        class="shop-orders-item-card__danger"
        variant="danger"
        :data-testid="`shoporder-order-item-remove-${getOrderItemKey(item)}`"
        aria-label="Remove item"
        title="Remove item"
        :disabled="!canEdit || itemActionLoading"
        @click="emit('remove', item.id)"
      >
        X
      </AppButton>
    </article>
  </div>
</template>

<style scoped>
.shop-orders-items-list {
  display: grid;
  align-content: start;
  gap: 0;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.15rem;
}

.shop-orders-items-head {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) 4rem minmax(9rem, 1fr) 2.55rem;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.15rem 0.18rem;
  border-bottom: 1px solid var(--shop-line-soft);
  color: var(--text-soft);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-items-head--readonly {
  grid-template-columns: minmax(0, 1.35fr) 4rem minmax(9rem, 1fr);
}

.shop-orders-items-head span:nth-child(2),
.shop-orders-items-head span:nth-child(4) {
  text-align: center;
}

.shop-orders-item-card {
  display: grid;
  width: 100%;
  color: var(--text);
  text-align: left;
}

.shop-orders-item-card--line {
  grid-template-columns: minmax(0, 1.35fr) 4rem minmax(9rem, 1fr) 2.55rem;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.15rem;
  border: 0;
  border-bottom: 1px solid rgba(140, 162, 186, 0.05);
  border-radius: 0;
  background: transparent;
}

.shop-orders-item-card--readonly {
  grid-template-columns: minmax(0, 1.35fr) 4rem minmax(9rem, 1fr);
}

.shop-orders-item-card__main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.16rem 0.45rem;
  min-width: 0;
}

.shop-orders-item-card__main strong {
  line-height: 1.2;
  font-size: 0.87rem;
  font-weight: 600;
}

.shop-orders-item-card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-orders-item-card__meta {
  flex: 0 0 auto;
  font-size: 0.7rem;
  white-space: nowrap;
  opacity: 0.82;
}

.shop-orders-item-card__qty-input,
.shop-orders-item-card__note-input {
  --app-text-input-min-height: var(--shop-control-height);
  --app-text-input-padding-x: 0.6rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}

.shop-orders-item-card__qty-input {
  text-align: center;
}

.shop-orders-item-card__danger {
  min-height: var(--shop-control-height);
  padding: 0 0.62rem;
  border-radius: var(--shop-radius-md);
  font-size: 0.92rem;
}

.shop-orders-readonly-value {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--shop-line-soft);
  border-radius: var(--shop-radius-md);
  background: rgba(255, 255, 255, 0.015);
  color: var(--text);
  line-height: 1.2;
}

.shop-orders-readonly-value--multiline {
  min-height: 2rem;
  white-space: normal;
}

.shop-orders-readonly-value--centered {
  justify-content: center;
  padding: 0 0.5rem;
}

.shop-orders-pane__empty {
  display: grid;
  place-content: center;
  min-height: 8.5rem;
  padding: 0.85rem;
  border: 1px dashed rgba(140, 162, 186, 0.1);
  border-radius: 12px;
  color: var(--text-muted);
  text-align: center;
}

@media (max-width: 820px) {
  .shop-orders-items-head,
  .shop-orders-item-card--line {
    grid-template-columns: 1fr;
    align-items: start;
  }
}
</style>
