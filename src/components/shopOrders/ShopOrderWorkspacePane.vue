<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppPane from '@/components/common/AppPane.vue'
import ShopOrderHistoryList from '@/components/shopOrders/ShopOrderHistoryList.vue'
import ShopOrderItemsEditor from '@/components/shopOrders/ShopOrderItemsEditor.vue'
import ShopOrderSelectedOrderPanel from '@/components/shopOrders/ShopOrderSelectedOrderPanel.vue'
import ShopOrderWorkspaceHeader from '@/components/shopOrders/ShopOrderWorkspaceHeader.vue'
import ShopOrderWorkspaceSection from '@/components/shopOrders/ShopOrderWorkspaceSection.vue'
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
  orderEstimatedTotal: number | null
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
  <AppPane class="shop-orders-workspace-pane">
    <ShopOrderWorkspaceHeader
      :can-create-order="canCreateOrder"
      :can-submit-order="canEditSelectedOrder"
      :create-order-loading="createOrderLoading"
      :item-action-loading="itemActionLoading"
      :job="job"
      :order-estimated-total="orderEstimatedTotal"
      @create-order="emit('create-order')"
      @submit-order="emit('submit-order')"
    />

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
        :order-estimated-total="orderEstimatedTotal"
        :total-quantity="totalQuantity"
        @update:delivery-date="emit('update:delivery-date', $event)"
        @update:comments="emit('update:comments', $event)"
        @apply-thursday-delivery="emit('apply-thursday-delivery')"
      />

      <ShopOrderWorkspaceSection
        class="shop-orders-workspace-pane__items-section"
        title="Added Items"
      >
        <template #actions>
          <div class="shop-orders-history-summary">
            <span>{{ itemCount }} items</span>
            <span>{{ totalQuantity }} total qty</span>
          </div>
        </template>

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
      </ShopOrderWorkspaceSection>

      <ShopOrderWorkspaceSection
        class="shop-orders-workspace-pane__history-section"
        title="Order History"
      >
        <template #actions>
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
        </template>

        <ShopOrderHistoryList
          :orders="orders"
          :selected-order-id="selectedOrderId"
          @select="emit('select-order', $event)"
        />
      </ShopOrderWorkspaceSection>
    </div>
  </AppPane>
</template>

<style scoped>
.shop-orders-workspace-pane {
  --app-pane-grid-template-rows: auto minmax(0, 1fr);
  --app-pane-gap: 0.65rem;
  --app-pane-padding: 0.75rem;
  --app-pane-border: 1px solid var(--shop-line);
  --app-pane-background: var(--panel-background);
  --app-pane-shadow: var(--shadow-md);
  --app-pane-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-pane-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-pane-header-title-margin: 0.18rem 0 0;
  --app-pane-header-title-font-size: var(--font-size-pane-title);
  min-width: 0;
}

.shop-orders-workspace-pane__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 0;
}

.shop-orders-workspace-pane__body--has-selected-order {
  overflow-y: auto;
}

.shop-orders-workspace-pane__items-section {
  flex: 2 1 14rem;
  min-height: 10rem;
}

.shop-orders-workspace-pane__history-section {
  flex: 0.9 1 9.5rem;
  min-height: 7rem;
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
  font-size: var(--font-size-help);
}

@media (max-width: 820px) {
  .shop-orders-workspace-pane {
    --app-pane-height: auto;
    --app-pane-grid-template-rows: auto auto;
    --app-pane-overflow: visible;
  }

  .shop-orders-workspace-pane__body,
  .shop-orders-workspace-pane__body--has-selected-order {
    overflow: visible;
  }

  .shop-orders-workspace-pane__items-section,
  .shop-orders-workspace-pane__history-section {
    flex: 0 0 auto;
    min-height: 0;
  }

  .shop-orders-history-summary {
    font-size: 0.64rem;
    gap: 0.24rem 0.42rem;
  }

  .shop-orders-workspace-section__header-meta {
    justify-content: flex-start;
  }
}

</style>
