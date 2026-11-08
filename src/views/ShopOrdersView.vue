<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import { useCurrentActor } from '@/composables/useCurrentActor'
import { usePageMessages } from '@/composables/usePageMessages'
import { useRouteJobContext } from '@/composables/useRouteJobContext'
import { useToastMessages } from '@/composables/useToastMessages'
import AppButton from '@/components/common/AppButton.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
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
const navigationConfirm = ref<InstanceType<typeof BuilderConfirmDialog>>()
const navigationBusy = ref(false)
const navigationEpoch = ref(0)
const navigationContext = () => navigationEpoch.value
function invalidateNavigation() {
  navigationEpoch.value += 1
  navigationConfirm.value?.cancel()
}
watch([currentUserId, jobId, selectedOrderId, () => auth.rawRole,
  () => auth.hasWorkspaceAccess, () => [...auth.assignedJobIds].sort().join('|'),
  () => [...(job.value?.assignedForemanIds ?? [])].sort().join('|')], invalidateNavigation, { flush: 'sync' })

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
watch(() => selectedOrder.value?.status, invalidateNavigation, { flush: 'sync' })
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
  prepareOrderItemNavigation,
} = useShopOrderPersistence({
  getActor,
  getContextEpoch: navigationContext,
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
  hasUnsavedOrderMetaChanges,
  orderMetaForm,
  queueOrderMetaSave,
  prepareOrderMetaNavigation,
  saveOrderMetaImmediately,
  shouldHydrateSelectedOrder,
} = useShopOrderMetaForm({
  canEditSelectedOrder,
  getContextEpoch: navigationContext,
  persistOrderMeta,
  selectedOrder,
  setActionError,
  setActionInfo,
})
const {
  clearOrderItemNoteDrafts,
  handleOrderItemNoteBlur,
  handleOrderItemNoteInput,
  hasUnsavedOrderItemNotes,
  prepareOrderItemNoteNavigation,
  orderItemNoteDrafts,
  syncOrderItemNoteDrafts,
} = useShopOrderItemNotes({
  cloneOrderItems,
  getContextEpoch: navigationContext,
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

const hasCustomItemDraft = () => !!customItemForm.description.trim() || !!customItemForm.note.trim() || customItemForm.quantity !== '1'
async function prepareSavedChanges() {
  const context = navigationContext()
  clearOrderMetaSaveTimer()
  if (!await prepareOrderItemNavigation() || context !== navigationContext()) return false
  if (!await prepareOrderItemNoteNavigation() || context !== navigationContext()) return false
  return prepareOrderMetaNavigation()
}
async function prepareNavigation() {
  if (navigationBusy.value) return false
  if (createOrderLoading.value || deleteDraftConfirmOpen.value || removeItemConfirmOpen.value || submitConfirmOpen.value) {
    setActionError('Finish the current shop order action before leaving.')
    return false
  }
  const context = navigationContext()
  navigationBusy.value = true
  try {
    const saved = await prepareSavedChanges()
    if (context !== navigationContext()) return false
    if (saved && !hasCustomItemDraft()) return true
    const discard = await navigationConfirm.value?.ask({
      title: 'Keep unsaved shop order changes?',
      message: saved
        ? 'This custom item has not been added. Discard it to continue?'
        : 'Shop order changes could not finish saving. Keep editing to retry, or discard the unsaved changes.',
      confirmLabel: 'Discard changes', cancelLabel: 'Keep editing', destructive: true,
    })
    if (!discard || context !== navigationContext()) return false
    clearOrderMetaSaveTimer()
    clearOrderItemNoteDrafts()
    applySelectedOrderToForm(selectedOrder.value)
    syncOrderItemNoteDrafts(selectedOrder.value, true)
    resetCustomItemForm()
    return true
  } finally { navigationBusy.value = false }
}
async function selectOrderSafely(orderId: string) {
  if (orderId !== selectedOrderId.value && await prepareNavigation()) selectOrder(orderId)
}
async function createOrderSafely() {
  if (selectedOrder.value?.status === 'draft' || await prepareNavigation()) await handleCreateOrder()
}
async function submitOrderSafely() {
  if (navigationBusy.value) return
  navigationBusy.value = true
  const context = navigationContext()
  try {
    if (await prepareSavedChanges() && context === navigationContext()) await handleSubmitSelectedOrder()
  } finally { navigationBusy.value = false }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (hasUnsavedOrderMetaChanges.value || hasUnsavedOrderItemNotes.value || itemActionLoading.value || createOrderLoading.value || hasCustomItemDraft()) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(prepareNavigation)
onBeforeRouteUpdate((to, from) => to.params.jobId === from.params.jobId || prepareNavigation())
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => { invalidateNavigation(); window.removeEventListener('beforeunload', beforeUnload) })
</script>

<template>
  <ShopOrderPageShell
    test-id="shop-orders-page"
    :before-sign-out="prepareNavigation"
    :inert="navigationBusy"
    :confirmation-open="deleteDraftConfirmOpen || removeItemConfirmOpen || submitConfirmOpen || navigationBusy"
  >
    <template #catalog="{ compact, drawerVisible, openOrder }">
      <ShopOrderCatalogBrowser
        :categories="categories"
        :catalog-items="catalogItems"
        :loading="catalogLoading"
        :disabled="orderInputDisabled"
        :add-catalog-item="addCatalogItemToOrder"
      >
        <template #actions>
          <div class="shop-order-page-actions">
            <AppButton
              v-if="compact"
              variant="primary"
              data-testid="shoporder-view-order"
              aria-controls="shop-order-drawer"
              aria-haspopup="dialog"
              :aria-expanded="drawerVisible"
              @click="openOrder"
            >
              <i class="pi pi-shopping-cart" aria-hidden="true"></i>
              View Order
              <span class="shop-order-page-actions__count">{{ orderItemCount }}</span>
            </AppButton>
            <AppLoadingButton
              label="New Order"
              loading-label="Creating..."
              data-testid="shoporder-new-order"
              :loading="createOrderLoading"
              :disabled="!jobId || !job"
              @click="createOrderSafely"
            />
          </div>
        </template>
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
        @delete-selected-order="handleDeleteSelectedOrder"
        @remove-item="requestRemoveOrderItem"
        @save-note="handleOrderItemNoteBlur"
        @select-order="selectOrderSafely"
        @submit-order="submitOrderSafely"
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
    <BuilderConfirmDialog ref="navigationConfirm" />
  </ShopOrderPageShell>
</template>

<style scoped>
.shop-order-page-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.shop-order-page-actions :deep(.app-button) {
  gap: var(--space-2);
  min-height: 2.5rem;
  padding: 0 0.625rem;
  white-space: nowrap;
}

.shop-order-page-actions__count {
  min-width: 1.5rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--bg-accent);
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
</style>
