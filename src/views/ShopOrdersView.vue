<script setup lang="ts">
import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useCurrentActor } from '@/composables/useCurrentActor'
import { usePageMessages } from '@/composables/usePageMessages'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useToastMessages } from '@/composables/useToastMessages'
import ShopOrderCatalogBrowser from '@/components/shopOrders/ShopOrderCatalogBrowser.vue'
import ShopOrderConfirmDialogs from '@/components/shopOrders/ShopOrderConfirmDialogs.vue'
import ShopOrderCustomItemForm from '@/components/shopOrders/ShopOrderCustomItemForm.vue'
import ShopOrderPageShell from '@/components/shopOrders/ShopOrderPageShell.vue'
import ShopOrderWorkspacePane from '@/components/shopOrders/ShopOrderWorkspacePane.vue'
import { useShopCatalogRecords } from '@/features/shopCatalog/useShopCatalogRecords'
import {
  getTodayDateString,
  shouldShowShopOrderSuccessToast,
} from '@/features/shopOrders/viewHelpers'
import { useShopOrderConfirmDialogs } from '@/features/shopOrders/useShopOrderConfirmDialogs'
import { useShopOrderCustomItemForm } from '@/features/shopOrders/useShopOrderCustomItemForm'
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

const {
  currentActorDisplayName,
  currentUserId,
  getActor,
} = useCurrentActor({
  getUserId: () => auth.currentUser?.uid ?? null,
  getDisplayName: () => auth.displayName,
  getEmail: () => auth.currentUser?.email ?? null,
})

const {
  customItemForm,
  resetCustomItemForm,
} = useShopOrderCustomItemForm()

const {
  orders,
  ordersError,
  ordersLoading,
  replaceOrderLocally,
  startOrdersSubscription,
  stopOrdersSubscription,
} = useShopOrderRecords({
  jobId,
})

const {
  canEditSelectedOrder,
  categoriesById,
  draftOrders,
  orderEstimatedTotal,
  orderItemCount,
  orderInputDisabled,
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
  replaceOrderLocally,
  selectedOrder,
  setActionError,
  setActionInfo,
})
const {
  applySelectedOrderToForm,
  applyThursdayDelivery,
  clearOrderMetaSaveTimer,
  ensureFreshDraftDeliveryDate,
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

onBeforeRouteLeave(async () => {
  clearOrderMetaSaveTimer()
  return saveOrderMetaImmediately()
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
  getForemanName: () => currentActorDisplayName.value,
  getForemanUserId: () => currentUserId.value,
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
  resetCustomItemForm,
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

const {
  selectOrder,
} = useShopOrderSelectionSync({
  applySelectedOrderToForm,
  clearOrderItemNoteDrafts,
  clearOrderMetaSaveTimer,
  ensureFreshDraftDeliveryDate,
  hasSelectedOrderChanged,
  orderMetaForm,
  orders,
  queueOrderMetaSave,
  selectedOrder,
  selectedOrderId,
  shouldHydrateSelectedOrder,
  syncOrderItemNoteDrafts,
})

useToastMessages([
  { source: catalogError, severity: 'error', summary: 'Catalog Browser' },
  { source: ordersError, severity: 'error', summary: 'Order Workspace' },
  { source: actionError, severity: 'error', summary: 'Shop Orders' },
  {
    source: actionInfo,
    severity: 'success',
    summary: 'Shop Orders',
    when: shouldShowShopOrderSuccessToast,
  },
])

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
  <ShopOrderPageShell test-id="shop-orders-page">
    <template #catalog>
      <ShopOrderCatalogBrowser
        :categories="categories"
        :catalog-items="catalogItems"
        :loading="catalogLoading"
        :disabled="orderInputDisabled"
        :add-catalog-item="addCatalogItemToOrder"
      >
        <ShopOrderCustomItemForm
          v-model:description="customItemForm.description"
          v-model:quantity="customItemForm.quantity"
          v-model:note="customItemForm.note"
          :disabled="orderInputDisabled"
          :submit-disabled="orderMutationDisabled"
          @submit="addCustomItemToOrder"
        />
      </ShopOrderCatalogBrowser>
    </template>

    <template #workspace>
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
        :order-estimated-total="orderEstimatedTotal"
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
    </template>

    <ShopOrderConfirmDialogs
      v-model:delete-draft-open="deleteDraftConfirmOpen"
      v-model:remove-item-open="removeItemConfirmOpen"
      v-model:submit-open="submitConfirmOpen"
      :busy="itemActionLoading"
      :remove-item-message="removeItemConfirmMessage"
      @confirm-delete-draft="confirmDeleteSelectedOrder"
      @confirm-remove-item="confirmRemoveOrderItem"
      @confirm-submit-order="confirmSubmitSelectedOrder"
    />
  </ShopOrderPageShell>
</template>
