<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import ShopOrderHistoryList from '@/components/shopOrders/ShopOrderHistoryList.vue'
import ShopOrderItemsEditor from '@/components/shopOrders/ShopOrderItemsEditor.vue'
import ShopOrderSelectedOrderPanel from '@/components/shopOrders/ShopOrderSelectedOrderPanel.vue'
import type {
  JobRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'

defineProps<{
  canCreateOrder: boolean
  canEditSelectedOrder: boolean
  comments: string
  createOrderLoading: boolean
  deliveryDate: string
  draftOrdersCount: number
  itemActionLoading: boolean
  itemCount: number
  items: ShopOrderItemRecord[]
  job: JobRecord | null
  minDeliveryDate: string
  noteDrafts: Record<string, string>
  orders: ShopOrderRecord[]
  ordersCount: number
  ordersLoading: boolean
  selectedOrder: ShopOrderRecord | null
  selectedOrderId: string | null
  submittedOrdersCount: number
  totalQuantity: number
}>()

const emit = defineEmits<{
  'update:delivery-date': [value: string]
  'update:comments': [value: string]
  'apply-thursday-delivery': []
  'create-order': []
  'delete-selected-order': []
  'remove-item': [orderItemId: string]
  'save-note': [orderItemId: string]
  'select-order': [orderId: string]
  'submit-order': []
  'update-note-draft': [orderItemId: string, rawValue: string]
  'update-quantity': [orderItemId: string, rawValue: string]
}>()
</script>

<template>
  <section class="shop-orders-workspace-pane">
    <header class="shop-orders-pane__header">
      <div>
        <span class="shop-orders-pane__eyebrow">Order Workspace</span>
        <h2 class="shop-orders-pane__title">
          {{ job ? `${job.code || 'No Job #'} - ${job.name}` : 'Current Job' }}
        </h2>
      </div>

      <div class="shop-orders-workspace-pane__actions">
        <AppButton
          variant="primary"
          data-testid="shoporder-new-order"
          :disabled="createOrderLoading || !canCreateOrder"
          @click="emit('create-order')"
        >
          {{ createOrderLoading ? 'Creating...' : 'New Order' }}
        </AppButton>
        <AppButton
          v-if="canEditSelectedOrder"
          data-testid="shoporder-submit"
          :disabled="itemActionLoading || createOrderLoading"
          @click="emit('submit-order')"
        >
          Submit Order
        </AppButton>
      </div>
    </header>

    <div
      class="shop-orders-workspace-pane__body"
      :class="{ 'shop-orders-workspace-pane__body--has-selected-order': selectedOrder }"
    >
      <ShopOrderSelectedOrderPanel
        v-if="selectedOrder"
        :delivery-date="deliveryDate"
        :comments="comments"
        :can-edit="canEditSelectedOrder"
        :item-count="itemCount"
        :min-delivery-date="minDeliveryDate"
        :order="selectedOrder"
        :total-quantity="totalQuantity"
        @update:delivery-date="emit('update:delivery-date', $event)"
        @update:comments="emit('update:comments', $event)"
        @apply-thursday-delivery="emit('apply-thursday-delivery')"
      />

      <section class="shop-orders-workspace-section shop-orders-workspace-section--items">
        <header class="shop-orders-workspace-card__header shop-orders-workspace-card__header--compact">
          <span class="shop-orders-pane__eyebrow">Added Items</span>
          <div class="shop-orders-history-summary">
            <span>{{ itemCount }} items</span>
            <span>{{ totalQuantity }} total qty</span>
          </div>
        </header>

        <div class="shop-orders-workspace-section__body">
          <ShopOrderItemsEditor
            :can-edit="canEditSelectedOrder"
            :item-action-loading="itemActionLoading"
            :items="items"
            :note-drafts="noteDrafts"
            :orders-count="ordersCount"
            :orders-loading="ordersLoading"
            :selected-order="selectedOrder"
            @remove="emit('remove-item', $event)"
            @save-note="emit('save-note', $event)"
            @update-note-draft="(orderItemId, rawValue) => emit('update-note-draft', orderItemId, rawValue)"
            @update-quantity="(orderItemId, rawValue) => emit('update-quantity', orderItemId, rawValue)"
          />
        </div>
      </section>

      <section class="shop-orders-workspace-section shop-orders-workspace-section--history">
        <header class="shop-orders-workspace-card__header shop-orders-workspace-card__header--compact">
          <span class="shop-orders-pane__eyebrow">Order History</span>
          <div class="shop-orders-workspace-section__header-meta">
            <div class="shop-orders-history-summary">
              <span>{{ draftOrdersCount }} draft</span>
              <span>{{ submittedOrdersCount }} submitted</span>
            </div>
            <AppButton
              v-if="selectedOrder?.status === 'draft'"
              class="shop-orders-draft-delete-button"
              variant="danger"
              aria-label="Delete draft"
              title="Delete draft"
              :disabled="itemActionLoading"
              @click="emit('delete-selected-order')"
            >
              Delete Draft
            </AppButton>
          </div>
        </header>

        <div class="shop-orders-workspace-section__body">
          <ShopOrderHistoryList
            :orders="orders"
            :selected-order-id="selectedOrderId"
            @select="emit('select-order', $event)"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.shop-orders-workspace-pane {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 0.75rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at top right, rgba(99, 199, 230, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.032), rgba(255, 255, 255, 0.006)),
    rgba(24, 36, 48, 0.9);
  box-shadow: var(--shadow-soft);
  grid-template-rows: auto minmax(0, 1fr);
}

.shop-orders-workspace-pane__body {
  display: grid;
  gap: 0.6rem;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: minmax(0, 2fr) minmax(0, 1fr);
  padding-right: 0;
}

.shop-orders-workspace-pane__body--has-selected-order {
  grid-template-rows: auto minmax(14rem, 2fr) minmax(9.5rem, 0.9fr);
}

.shop-orders-pane__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  padding-bottom: 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-orders-pane__eyebrow {
  color: var(--accent-strong);
  font-size: 0.64rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.shop-orders-pane__title {
  margin: 0.18rem 0 0;
  font-size: 1.08rem;
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-orders-history-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem 0.55rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-workspace-pane__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem;
}

.shop-orders-workspace-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.shop-orders-workspace-card__header--compact {
  align-items: center;
}

.shop-orders-workspace-section {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.14rem;
  min-width: 0;
  min-height: 0;
  padding: 0.34rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
  overflow: hidden;
}

.shop-orders-workspace-section .shop-orders-workspace-card__header {
  padding-bottom: 0;
}

.shop-orders-workspace-section--history .shop-orders-workspace-card__header {
  align-items: center;
  flex-wrap: wrap;
}

.shop-orders-workspace-section__header-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.35rem 0.45rem;
  min-width: 0;
}

.shop-orders-draft-delete-button {
  min-height: 1.75rem;
  padding: 0 0.55rem;
  font-size: 0.82rem;
}

.shop-orders-workspace-section__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.shop-orders-workspace-section__body > * {
  min-height: 0;
}

@media (max-width: 820px) {
  .shop-orders-pane__header,
  .shop-orders-workspace-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
