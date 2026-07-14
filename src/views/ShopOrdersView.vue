<script setup lang="ts">
import { reactive, ref } from 'vue'
import { usePageMessages } from '@/composables/usePageMessages'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useToastMessages } from '@/composables/useToastMessages'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ShopOrderCatalogBrowser from '@/components/shopOrders/ShopOrderCatalogBrowser.vue'
import ShopOrderCustomItemForm from '@/components/shopOrders/ShopOrderCustomItemForm.vue'
import ShopOrderWorkspacePane from '@/components/shopOrders/ShopOrderWorkspacePane.vue'
import AppShell from '@/layouts/AppShell.vue'
import { useShopCatalogRecords } from '@/features/shopCatalog/useShopCatalogRecords'
import {
  createEmptyCustomItemFormState,
  getTodayDateString,
  type CustomItemFormState,
} from '@/features/shopOrders/viewHelpers'
import { useShopOrderConfirmDialogs } from '@/features/shopOrders/useShopOrderConfirmDialogs'
import { useShopOrderDraftActions } from '@/features/shopOrders/useShopOrderDraftActions'
import { useShopOrderItemActions } from '@/features/shopOrders/useShopOrderItemActions'
import { useShopOrderItemNotes } from '@/features/shopOrders/useShopOrderItemNotes'
import { useShopOrderMetaForm } from '@/features/shopOrders/useShopOrderMetaForm'
import { useShopOrderPersistence } from '@/features/shopOrders/useShopOrderPersistence'
import { useShopOrderRecords } from '@/features/shopOrders/useShopOrderRecords'
import { useShopOrderSelectionSync } from '@/features/shopOrders/useShopOrderSelectionSync'
import { useShopOrderSubmissionActions } from '@/features/shopOrders/useShopOrderSubmissionActions'
import { useShopOrderSubscriptionLifecycle } from '@/features/shopOrders/useShopOrderSubscriptionLifecycle'
import { useShopOrderWorkspaceState } from '@/features/shopOrders/useShopOrderWorkspaceState'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const {
  job,
  jobId,
  subscribeRouteJob,
  stopRouteJobSubscription,
} = useRouteJobContext()

const {
  categories,
  error: catalogError,
  items: catalogItems,
  loading: catalogLoading,
  stopCatalogRecords,
  subscribeCatalogRecords,
} = useShopCatalogRecords({
  loadingMode: 'all',
  categoryErrorMessage: 'Failed to load shop catalog folders.',
  itemErrorMessage: 'Failed to load shop catalog items.',
  fallbackErrorMessage: 'Failed to load shop catalog.',
})
const selectedOrderId = ref<string | null>(null)
const {
  pageError: actionError,
  pageInfo: actionInfo,
  setPageErrorMessage: setActionError,
  setPageInfo: setActionInfo,
} = usePageMessages()
const createOrderLoading = ref(false)
const itemActionLoading = ref(false)


const customItemForm = reactive<CustomItemFormState>(createEmptyCustomItemFormState())

const {
  orders,
  ordersError,
  ordersLoading,
  startOrdersSubscription,
  stopOrdersSubscription,
} = useShopOrderRecords({
  jobId,
})

const {
  canEditSelectedOrder,
  categoriesById,
  draftOrders,
  orderItemCount,
  orderMutationDisabled,
  orderTotalQuantity,
  selectedOrder,
  sortedSelectedOrderItems,
  submittedOrders,
} = useShopOrderWorkspaceState({
  categories,
  createOrderLoading,
  itemActionLoading,
  job,
  jobId,
  orders,
  selectedOrderId,
})
const {
  closeDeleteDraftConfirm,
  closeRemoveItemConfirm,
  closeSubmitConfirm,
  deleteDraftConfirmOpen,
  openSubmitConfirm,
  removeItemConfirmMessage,
  removeItemConfirmOpen,
  removeItemTargetId,
  requestDeleteDraftOrder,
  requestRemoveOrderItem,
  submitConfirmOpen,
} = useShopOrderConfirmDialogs({ selectedOrder })
const {
  cloneOrderItems,
  persistOrderItems,
  persistOrderMeta,
} = useShopOrderPersistence({
  getActor,
  itemActionLoading,
  selectedOrder,
  setActionError,
  setActionInfo,
})
const {
  applySelectedOrderToForm,
  applyThursdayDelivery,
  clearOrderMetaSaveTimer,
  hasSelectedOrderChanged,
  orderMetaForm,
  queueOrderMetaSave,
  saveOrderMetaImmediately,
  shouldHydrateSelectedOrder,
} = useShopOrderMetaForm({
  canEditSelectedOrder,
  persistOrderMeta,
  selectedOrder,
  setActionError,
  setActionInfo,
})
const {
  clearOrderItemNoteDrafts,
  handleOrderItemNoteBlur,
  handleOrderItemNoteInput,
  orderItemNoteDrafts,
  syncOrderItemNoteDrafts,
} = useShopOrderItemNotes({
  cloneOrderItems,
  persistOrderItems,
  selectedOrder,
})
const {
  ensureDraftOrderTarget,
  handleCreateOrder,
} = useShopOrderDraftActions({
  cloneOrderItems,
  createOrderLoading,
  draftOrders,
  getForemanName: () => auth.displayName || auth.currentUser?.email || null,
  getForemanUserId: () => auth.currentUser?.uid ?? null,
  job,
  jobId,
  orderMetaForm,
  selectedOrder,
  selectedOrderId,
  setActionError,
  setActionInfo,
})
const {
  addCatalogItemToOrder,
  addCustomItemToOrder,
  confirmRemoveOrderItem,
  updateOrderItemQuantity,
} = useShopOrderItemActions({
  categoriesById,
  cloneOrderItems,
  closeRemoveItemConfirm,
  customItemForm,
  ensureDraftOrderTarget,
  persistOrderItems,
  removeItemTargetId,
  selectedOrder,
  setActionError,
})
const {
  confirmDeleteSelectedOrder,
  confirmSubmitSelectedOrder,
  handleDeleteSelectedOrder,
  handleSubmitSelectedOrder,
} = useShopOrderSubmissionActions({
  canEditSelectedOrder,
  clearOrderMetaSaveTimer,
  closeDeleteDraftConfirm,
  closeSubmitConfirm,
  getActor,
  itemActionLoading,
  openSubmitConfirm,
  orderMetaForm,
  requestDeleteDraftOrder,
  saveOrderMetaImmediately,
  selectedOrder,
  selectedOrderId,
  setActionError,
  setActionInfo,
})

useShopOrderSelectionSync({
  applySelectedOrderToForm,
  clearOrderItemNoteDrafts,
  clearOrderMetaSaveTimer,
  hasSelectedOrderChanged,
  orderMetaForm,
  orders,
  queueOrderMetaSave,
  selectedOrder,
  selectedOrderId,
  shouldHydrateSelectedOrder,
  syncOrderItemNoteDrafts,
})

const quietShopOrderMessages = new Set([
  'New order started.',
  'Order details saved.',
  'Order quantity updated.',
  'Order note updated.',
  'Custom item added to the current order.',
])

useToastMessages([
  { source: catalogError, severity: 'error', summary: 'Catalog Browser' },
  { source: ordersError, severity: 'error', summary: 'Order Workspace' },
  { source: actionError, severity: 'error', summary: 'Shop Orders' },
  {
    source: actionInfo,
    severity: 'success',
    summary: 'Shop Orders',
    when: (message) => !quietShopOrderMessages.has(message) && !message.endsWith('added to the current order.'),
  },
])

function getActor() {
  return {
    userId: auth.currentUser?.uid ?? null,
    displayName: auth.displayName || auth.currentUser?.email || null,
  }
}

function selectOrder(orderId: string) {
  selectedOrderId.value = orderId
}

useShopOrderSubscriptionLifecycle({
  clearOrderMetaSaveTimer,
  clearOrderItemNoteDrafts,
  jobId,
  startOrdersSubscription,
  stopCatalogRecords,
  stopOrdersSubscription,
  stopRouteJobSubscription,
  subscribeCatalogRecords,
  subscribeRouteJob,
})
</script>

<template>
  <AppShell>
    <div class="shop-orders-explorer" data-testid="shop-orders-page">
      <ShopOrderCatalogBrowser
        :categories="categories"
        :catalog-items="catalogItems"
        :loading="catalogLoading"
        :disabled="orderMutationDisabled"
        :add-catalog-item="addCatalogItemToOrder"
      >
        <ShopOrderCustomItemForm
          v-model:description="customItemForm.description"
          v-model:quantity="customItemForm.quantity"
          v-model:note="customItemForm.note"
          :disabled="orderMutationDisabled"
          @submit="addCustomItemToOrder"
        />
      </ShopOrderCatalogBrowser>

      <ShopOrderWorkspacePane
        v-model:delivery-date="orderMetaForm.deliveryDate"
        v-model:comments="orderMetaForm.comments"
        :can-create-order="Boolean(jobId && job)"
        :can-edit-selected-order="canEditSelectedOrder"
        :create-order-loading="createOrderLoading"
        :draft-orders-count="draftOrders.length"
        :item-action-loading="itemActionLoading"
        :item-count="orderItemCount"
        :items="sortedSelectedOrderItems"
        :job="job"
        :min-delivery-date="getTodayDateString()"
        :note-drafts="orderItemNoteDrafts"
        :orders="orders"
        :orders-count="orders.length"
        :orders-loading="ordersLoading"
        :selected-order="selectedOrder"
        :selected-order-id="selectedOrderId"
        :submitted-orders-count="submittedOrders.length"
        :total-quantity="orderTotalQuantity"
        @apply-thursday-delivery="applyThursdayDelivery"
        @create-order="handleCreateOrder"
        @delete-selected-order="handleDeleteSelectedOrder"
        @remove-item="requestRemoveOrderItem"
        @save-note="handleOrderItemNoteBlur"
        @select-order="selectOrder"
        @submit-order="handleSubmitSelectedOrder"
        @update-note-draft="handleOrderItemNoteInput"
        @update-quantity="updateOrderItemQuantity"
      />
    </div>

    <ConfirmDialog
      :open="removeItemConfirmOpen"
      title="Remove item?"
      :message="removeItemConfirmMessage"
      confirm-label="Remove Item"
      destructive
      :busy="itemActionLoading"
      @update:open="removeItemConfirmOpen = $event"
      @confirm="confirmRemoveOrderItem"
    />

    <ConfirmDialog
      :open="deleteDraftConfirmOpen"
      title="Delete draft?"
      message="Delete this draft shop order?"
      confirm-label="Delete Draft"
      destructive
      :busy="itemActionLoading"
      @update:open="deleteDraftConfirmOpen = $event"
      @confirm="confirmDeleteSelectedOrder"
    />

    <ConfirmDialog
      :open="submitConfirmOpen"
      title="Submit shop order?"
      message="Submit this shop order? The order will become read-only."
      confirm-label="Submit Order"
      :busy="itemActionLoading"
      @update:open="submitConfirmOpen = $event"
      @confirm="confirmSubmitSelectedOrder"
    />
  </AppShell>
</template>

<style scoped>
.shop-orders-explorer {
  --shop-line: rgba(168, 190, 209, 0.16);
  --shop-line-soft: rgba(168, 190, 209, 0.08);
  --shop-surface: rgba(255, 255, 255, 0.018);
  --shop-surface-soft: rgba(255, 255, 255, 0.035);
  --shop-field: rgba(237, 245, 248, 0.052);
  --shop-radius-md: 10px;
  --shop-radius-lg: 12px;
  --shop-control-height: 1.9rem;
  display: grid;
  grid-template-columns: minmax(340px, 0.92fr) minmax(540px, 1.08fr);
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.shop-orders-explorer > * {
  min-width: 0;
}

@media (max-width: 1440px) {
  .shop-orders-explorer {
    grid-template-columns: minmax(320px, 0.88fr) minmax(480px, 1.12fr);
  }
}

@media (max-width: 1180px) {
  .shop-orders-explorer {
    grid-template-columns: 1fr;
  }
}

</style>
