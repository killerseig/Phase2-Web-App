<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppReadonlyField from '@/components/common/AppReadonlyField.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import AppTextarea from '@/components/common/AppTextarea.vue'
import type { ShopOrderItemRecord, ShopOrderRecord } from '@/types/domain'
import { readInputValue } from '@/utils/domEvents'
import {
  formatShopOrderCurrency,
  getShopOrderItemDisplayName,
  getShopOrderItemLineTotal,
} from '@/utils/shopOrders'

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

function getOrderItemLineTotalLabel(item: ShopOrderItemRecord) {
  return formatShopOrderCurrency(getShopOrderItemLineTotal(item), '-')
}
</script>

<template>
  <AppEmptyState
    v-if="ordersLoading && ordersCount === 0"
    panel
    class="shop-orders-pane__empty"
    message="Loading orders..."
  />

  <AppEmptyState
    v-else-if="!selectedOrder"
    panel
    class="shop-orders-pane__empty"
    data-testid="shoporder-empty"
    message="Add a catalog item or custom item to start a new order."
  />

  <AppEmptyState
    v-else-if="selectedOrder.items.length === 0"
    panel
    class="shop-orders-pane__empty"
    data-testid="shoporder-empty"
    message="Nothing has been added to this order yet. Use the catalog browser or custom item form to build it."
  />

  <div v-else class="shop-orders-items-list">
    <div
      class="shop-orders-items-head"
      :class="{ 'shop-orders-items-head--readonly': !canEdit }"
    >
      <span>Description</span>
      <span class="shop-orders-items-head__price">Price</span>
      <span class="shop-orders-items-head__quantity" aria-label="Quantity">Qty</span>
      <span class="shop-orders-items-head__total">Total</span>
      <span class="shop-orders-items-head__note">Note</span>
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
        <span class="shop-orders-item-card__unit-price">
          {{ formatShopOrderCurrency(item.price) }}<template v-if="item.price != null"> each</template>
        </span>
        <span
          v-if="item.sourceType !== 'catalog' || item.sku"
          class="shop-orders-item-card__meta"
        >
          <template v-if="item.sourceType !== 'catalog'">Custom</template>
          <template v-if="item.sourceType !== 'catalog' && item.sku"> - </template>
          <template v-if="item.sku">SKU {{ item.sku }}</template>
        </span>
      </div>

      <div class="shop-orders-item-card__field shop-orders-item-card__price">
        <span class="shop-orders-item-card__label">Price</span>
        <AppReadonlyField
          class="shop-orders-readonly-value shop-orders-readonly-value--centered"
          :data-testid="`shoporder-order-item-price-${getOrderItemKey(item)}`"
        >
          {{ formatShopOrderCurrency(item.price) }}
        </AppReadonlyField>
      </div>

      <label class="shop-orders-item-card__field shop-orders-item-card__quantity">
        <span class="shop-orders-item-card__label">Quantity</span>
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
          @change="emit('updateQuantity', item.id, readInputValue($event))"
        />
        <AppReadonlyField
          v-else
          class="shop-orders-readonly-value shop-orders-readonly-value--centered"
          :data-testid="`shoporder-order-item-qty-readonly-${getOrderItemKey(item)}`"
        >
          {{ item.quantity ?? 1 }}
        </AppReadonlyField>
      </label>

      <div class="shop-orders-item-card__field shop-orders-item-card__total">
        <span class="shop-orders-item-card__label">Total</span>
        <AppReadonlyField
          class="shop-orders-readonly-value shop-orders-readonly-value--centered"
          :data-testid="`shoporder-order-item-line-total-${getOrderItemKey(item)}`"
        >
          {{ getOrderItemLineTotalLabel(item) }}
        </AppReadonlyField>
      </div>

      <label
        class="shop-orders-item-card__field shop-orders-item-card__note"
        :class="{ 'shop-orders-item-card__note--empty': !canEdit && !item.note }"
      >
        <span class="shop-orders-item-card__label">Note</span>
        <AppTextarea
          v-if="canEdit"
          class="shop-orders-item-card__note-input"
          :model-value="getOrderItemNoteInputValue(item)"
          :data-testid="`shoporder-order-item-note-${getOrderItemKey(item)}`"
          rows="1"
          autocomplete="off"
          aria-label="Note"
          placeholder="Optional note"
          @update:model-value="emit('updateNoteDraft', item.id, $event)"
          @blur="emit('saveNote', item.id)"
        />
        <AppReadonlyField
          v-else
          multiline
          class="shop-orders-readonly-value shop-orders-readonly-value--multiline"
          :data-testid="`shoporder-order-item-note-readonly-${getOrderItemKey(item)}`"
        >
          {{ item.note || '-' }}
        </AppReadonlyField>
      </label>

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
        <i class="pi pi-trash" aria-hidden="true"></i>
      </AppButton>
    </article>
  </div>
</template>

<style scoped>
.shop-orders-items-list {
  container: shop-order-items / inline-size;
  min-width: 0;
  min-height: 0;
}

.shop-orders-items-head {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) 4.75rem 3.5rem 5rem minmax(0, 1fr) 2rem;
  align-items: center;
  gap: var(--space-2);
  padding: 0 0 var(--space-2);
  border-bottom: 1px solid var(--shop-line-soft);
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.shop-orders-items-head--readonly {
  grid-template-columns: minmax(0, 1.3fr) 4.75rem 3.5rem 5rem minmax(0, 1fr);
}

.shop-orders-items-head__quantity {
  text-align: center;
}

.shop-orders-items-head__price,
.shop-orders-items-head__total {
  text-align: right;
}

.shop-orders-item-card {
  display: grid;
  width: 100%;
  color: var(--text);
  text-align: left;
}

.shop-orders-item-card--line {
  grid-template-columns: minmax(0, 1.3fr) 4.75rem 3.5rem 5rem minmax(0, 1fr) 2rem;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border: 0;
  border-bottom: 1px solid var(--shop-line-soft);
  border-radius: 0;
  background: transparent;
}

.shop-orders-item-card--readonly {
  grid-template-columns: minmax(0, 1.3fr) 4.75rem 3.5rem 5rem minmax(0, 1fr);
}

.shop-orders-item-card__field {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.shop-orders-item-card__label {
  display: none;
  color: var(--text-muted);
  font-size: var(--font-size-label);
  font-weight: 400;
}

.shop-orders-item-card__total {
  font-weight: 600;
}

.shop-orders-item-card__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  min-width: 0;
}

.shop-orders-item-card__main strong {
  line-height: 1.4;
  font-size: var(--font-size-label);
  font-weight: 600;
}

.shop-orders-item-card__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.shop-orders-item-card__meta {
  font-size: var(--font-size-help);
  overflow-wrap: anywhere;
  color: var(--text-muted);
}

.shop-orders-item-card__unit-price {
  display: none;
  color: var(--text-muted);
  font-size: var(--font-size-help);
  font-variant-numeric: tabular-nums;
}

.shop-orders-item-card__qty-input {
  --app-text-input-min-height: 2rem;
  --app-text-input-padding-x: 0.25rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow: none;
  text-align: center;
}

.shop-orders-item-card__note-input {
  --app-textarea-min-height: 2rem;
  --app-textarea-padding: 0.3rem 0.5rem;
  --app-textarea-resize: vertical;
  --app-textarea-border: var(--shop-line);
  --app-textarea-radius: var(--shop-radius-md);
  --app-textarea-background: var(--shop-field);
  height: 2rem;
  line-height: 1.4;
}

.shop-orders-item-card__note-input:focus {
  min-height: 4rem;
}

.shop-orders-item-card__danger {
  width: 2rem;
  min-height: 2rem;
  padding: 0;
  border-radius: var(--shop-radius-md);
  font-size: 0.92rem;
}

.shop-orders-readonly-value {
  --app-readonly-field-min-height: 2rem;
  --app-readonly-field-padding-x: 0;
  --app-readonly-field-background: transparent;
  --app-readonly-field-color: var(--text);
  border: 0;
  border-radius: 0;
  font-size: var(--font-size-label);
  line-height: 1.4;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.shop-orders-readonly-value--multiline {
  --app-readonly-field-min-height: 2rem;
  --app-readonly-field-multiline-min-height: 0;
  --app-readonly-field-multiline-padding-y: 0;
  color: var(--text-muted);
}

.shop-orders-readonly-value--centered {
  justify-content: center;
}

.shop-orders-item-card__price .shop-orders-readonly-value,
.shop-orders-item-card__total .shop-orders-readonly-value {
  justify-content: flex-end;
  text-align: right;
}

/* Keep line-item columns in narrow panes, with the note tucked below the line. */
@container shop-order-items (max-width: 34rem) {
  .shop-orders-items-head,
  .shop-orders-item-card--line,
  .shop-orders-item-card--readonly {
    grid-template-columns: minmax(0, 1fr) 3rem 4.25rem 2rem;
    column-gap: var(--space-2);
    row-gap: var(--space-1);
  }

  .shop-orders-items-head--readonly,
  .shop-orders-item-card--readonly {
    grid-template-columns: minmax(0, 1fr) 3rem 4.25rem;
  }

  .shop-orders-items-head__price,
  .shop-orders-items-head__note,
  .shop-orders-item-card__price,
  .shop-orders-item-card__note--empty {
    display: none;
  }

  .shop-orders-item-card__unit-price {
    display: block;
  }

  .shop-orders-item-card__main {
    grid-column: 1;
    grid-row: 1;
  }

  .shop-orders-item-card__quantity {
    grid-column: 2;
    grid-row: 1;
  }

  .shop-orders-item-card__total {
    grid-column: 3;
    grid-row: 1;
  }

  .shop-orders-item-card__danger {
    grid-column: 4;
    grid-row: 1;
  }

  .shop-orders-item-card__note {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@container shop-order-items (max-width: 20rem) {
  .shop-orders-items-head,
  .shop-orders-item-card--line {
    grid-template-columns: minmax(0, 1fr) 2.75rem 3.75rem 2rem;
    column-gap: var(--space-1);
  }

  .shop-orders-items-head--readonly,
  .shop-orders-item-card--readonly {
    grid-template-columns: minmax(0, 1fr) 2.75rem 3.75rem;
  }
}
</style>
