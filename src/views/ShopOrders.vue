<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import ShopOrderDetailCard from '@/components/shopOrders/ShopOrderDetailCard.vue'
import ShopOrderListCard from '@/components/shopOrders/ShopOrderListCard.vue'
import ShopOrderCatalogBrowser from '@/components/shopOrders/ShopOrderCatalogBrowser.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { useShopCatalogStore } from '@/stores/shopCatalog'
import { useShopCategoriesStore } from '@/stores/shopCategories'
import {
  createShopOrder,
  deleteShopOrder,
  sendShopOrderEmail,
  subscribeEmailSettings,
  subscribeShopOrders,
  updateShopOrderItems,
  updateShopOrderStatus,
  type ShopOrder,
  type ShopOrderItem,
  type ShopOrderStatus,
} from '@/services'
import { useJobAccess } from '@/composables/useJobAccess'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { useToast } from '@/composables/useToast'
import { ROUTE_NAMES } from '@/constants/app'
import { normalizeError } from '@/services/serviceUtils'
import {
  buildCatalogSelectionQuantities,
  mergeShopOrderItem,
  sanitizeShopOrderItems,
} from '@/utils/shopOrderItems'
import { formatDateTime, toMillis } from '@/utils/datetime'
import { logError, logWarn } from '@/utils/logger'

const props = defineProps<{ jobId?: string }>()
const router = useRouter()
const auth = useAuthStore()
const jobs = useJobsStore()
const shopCatalogStore = useShopCatalogStore()
const shopCategoriesStore = useShopCategoriesStore()
const { items: catalog } = storeToRefs(shopCatalogStore)
const { categories: shopCategories } = storeToRefs(shopCategoriesStore)
const jobAccess = useJobAccess()
const { confirm } = useConfirmDialog()
const subscriptions = useSubscriptionRegistry()
const toast = useToast()

type CatalogSelectable = {
  id?: string
  name?: string
  description?: string
  sku?: string
  price?: string | number
  quantity?: number
}

const jobId = computed(() => String(props.jobId ?? ''))
const job = computed(() => jobs.currentJob)
const jobName = computed(() => job.value?.name ?? 'Shop Orders')
const jobCode = computed(() => job.value?.code ?? '')

const loading = ref(true)
const err = ref('')
const orders = ref<ShopOrder[]>([])
const selectedId = ref<string | null>(null)
const search = ref('')
const statusFilter = ref<'all' | ShopOrderStatus>('all')
const newItemDescription = ref('')
const newItemCatalogId = ref<string | null>(null)
const newItemQty = ref<string>('')
const newItemNote = ref('')
const selectedCatalogItem = ref<CatalogSelectable | null>(null)
const catalogItemQtys = ref<Record<string, number>>({})
const shopOrderRecipients = ref<string[]>([])
const sendingEmail = ref(false)
const fmtDate = (ts: unknown) => formatDateTime(ts)
let persistItemsChain: Promise<void> = Promise.resolve()

const selected = computed(() => orders.value.find(o => o.id === selectedId.value) ?? null)
const selectedCatalogItemQuantities = computed(() =>
  buildCatalogSelectionQuantities(selected.value?.items ?? [])
)

const filtered = computed(() => {
  const s = search.value.trim().toLowerCase()
  return orders.value.filter(o => {
    if (statusFilter.value !== 'all' && o.status !== statusFilter.value) return false
    if (!s) return true
    const haystack = [o.id, o.status, ...(o.items || []).map(i => i.description)].join(' ').toLowerCase()
    return haystack.includes(s)
  })
})

const canEditOrder = (o: ShopOrder) => o.status === 'draft'
const canSubmit = (o: ShopOrder) => o.status === 'draft' && o.items.length > 0
const canOrder = (o: ShopOrder) => o.status === 'order'
const canReceive = (o: ShopOrder) => o.status === 'order'

const pickFirstIfNeeded = () => {
  if (!selectedId.value && orders.value.length > 0) {
    const firstOrder = orders.value[0]
    if (firstOrder) selectedId.value = firstOrder.id
  }
}

const clearSubscriptions = () => {
  subscriptions.clearAll()
}

const replaceMerged = (map: Map<string, ShopOrder>) => {
  orders.value = Array.from(map.values()).sort((a, b) => {
    const ta = toMillis(a.orderDate)
    const tb = toMillis(b.orderDate)
    return tb - ta
  })
  if (selectedId.value && !orders.value.some(o => o.id === selectedId.value)) selectedId.value = null
  pickFirstIfNeeded()
}

const loadOrders = () => {
  subscriptions.clear('shop-orders')
  loading.value = true
  const mergedMap = new Map<string, ShopOrder>()
  try {
    subscriptions.replace('shop-orders', subscribeShopOrders(jobId.value, {
      onUpdate(snapshotOrders) {
        mergedMap.clear()
        snapshotOrders.forEach((order) => {
          mergedMap.set(order.id, { ...order, items: Array.isArray(order.items) ? [...order.items] : [] })
        })
        replaceMerged(mergedMap)
        loading.value = false
      },
      onError(error) {
        err.value = error.message ?? 'Failed to load orders'
        toast.show('Failed to load orders: ' + (error.message ?? 'Unknown error'), 'error')
        loading.value = false
      },
    }))
  } catch (error) {
    const message = normalizeError(error, 'Failed to load orders')
    err.value = message
    toast.show(`Failed to load orders: ${message}`, 'error')
    loading.value = false
  }
}

const init = async () => {
  if (!jobId.value) return
  loading.value = true
  err.value = ''
  try {
    if (!auth.ready) await auth.init()
    if (!jobAccess.canAccessJob(jobId.value)) {
      await router.push({ name: ROUTE_NAMES.UNAUTHORIZED })
      loading.value = false
      return
    }

    jobs.subscribeJob(jobId.value)
    subscriptions.replace('email-settings', subscribeEmailSettings(
      (settings) => {
        shopOrderRecipients.value = settings.shopOrderSubmitRecipients ?? []
      },
      (settingsError) => {
        logWarn('ShopOrders', 'Failed to subscribe to email settings, using defaults', settingsError)
        shopOrderRecipients.value = []
      }
    ))

    shopCatalogStore.subscribeCatalog()
    shopCategoriesStore.subscribeAllCategories()
    loadOrders()
  } catch (e) {
    logError('ShopOrders', 'Init error', e)
    err.value = normalizeError(e, 'Failed to initialize')
    loading.value = false
  }
}

const addItem = async () => {
  if (!newItemDescription.value.trim()) {
    toast.show('Description is required', 'error')
    return
  }
  
  if (!selected.value) {
    toast.show('No order selected', 'error')
    return
  }

  const description = newItemDescription.value.trim()
  const quantity = Math.max(1, Math.floor(Number(newItemQty.value) || 1))
  const note = newItemNote.value.trim() || undefined
  const catalogItemId = newItemCatalogId.value ?? null
  const draftSnapshot = {
    description: newItemDescription.value,
    quantity: newItemQty.value,
    note: newItemNote.value,
    catalogItemId: newItemCatalogId.value,
    selectedCatalogItem: selectedCatalogItem.value,
  }

  await addItemOptimistically(
    { description, quantity, ...(note ? { note } : {}), catalogItemId },
    () => {
      newItemDescription.value = ''
      newItemQty.value = ''
      newItemNote.value = ''
      newItemCatalogId.value = null
      selectedCatalogItem.value = null
    },
    () => {
      newItemDescription.value = draftSnapshot.description
      newItemQty.value = draftSnapshot.quantity
      newItemNote.value = draftSnapshot.note
      newItemCatalogId.value = draftSnapshot.catalogItemId
      selectedCatalogItem.value = draftSnapshot.selectedCatalogItem
    }
  )
}

const normalizeCatalogSelection = (item: CatalogSelectable) => {
  const description = (item?.description || item?.name || '').trim()
  const itemId = item?.id
  const defaultQty = itemId ? catalogItemQtys.value[itemId] : undefined
  const quantity = Math.max(1, Math.floor(Number(item?.quantity ?? defaultQty ?? 1) || 1))
  const catalogItemId = item?.id ?? null
  const noteParts: string[] = []
  if (item?.sku) noteParts.push(`SKU: ${item.sku}`)
  if (item?.price) noteParts.push(`$${item.price}`)
  const note = noteParts.length ? noteParts.join(' - ') : ''
  return { description, quantity, catalogItemId, note }
}

const selectCatalogItem = (item: CatalogSelectable) => {
  const normalized = normalizeCatalogSelection(item)
  if (!normalized.description) {
    toast.show('Catalog item is missing a description', 'error')
    return
  }
  newItemCatalogId.value = normalized.catalogItemId
  newItemDescription.value = normalized.description
  newItemQty.value = String(normalized.quantity)
  newItemNote.value = normalized.note
  selectedCatalogItem.value = item
  addItem()
  if (item.id) {
    catalogItemQtys.value[item.id] = 1
  }
}

const updateCatalogItemQty = ({ id, qty }: { id: string; qty: number }) => {
  catalogItemQtys.value[id] = qty
}

const cloneItems = (items: ShopOrderItem[] = []) => items.map((item) => ({ ...item }))

const setOrderItems = (orderId: string, items: ShopOrderItem[]) => {
  const order = orders.value.find((entry) => entry.id === orderId)
  if (!order) return
  order.items = cloneItems(items)
}

const queuePersistItems = (task: () => Promise<void>) => {
  const nextTask = persistItemsChain.then(task, task)
  persistItemsChain = nextTask.catch(() => {})
  return nextTask
}

const persistItems = (orderId: string, items: ShopOrderItem[]) =>
  queuePersistItems(async () => {
    await updateShopOrderItems(jobId.value, orderId, sanitizeShopOrderItems(items))
  })

const addItemOptimistically = async (item: ShopOrderItem, resetDraft: () => void, restoreDraft: () => void) => {
  if (!selected.value) return

  const orderId = selected.value.id
  const previousItems = cloneItems(selected.value.items || [])
  const nextItems = mergeShopOrderItem(previousItems, item)

  setOrderItems(orderId, nextItems)
  resetDraft()

  try {
    await persistItems(orderId, nextItems)
    toast.show('Item added successfully', 'success')
  } catch (e) {
    setOrderItems(orderId, previousItems)
    restoreDraft()
    logError('ShopOrders', 'Add item error', e)
    toast.show(`Failed to add item: ${normalizeError(e, 'Unknown error')}`, 'error')
  }
}

const handleSelectedItemsUpdate = (items: ShopOrder['items']) => {
  if (!selected.value) return
  const orderId = selected.value.id
  setOrderItems(orderId, items)
  void persistItems(orderId, items).catch((e) => {
    logError('ShopOrders', 'Failed to persist items', e)
    toast.show('Failed to save item changes', 'error')
  })
}

const handleDeleteSelectedItem = async (index: number) => {
  if (!selected.value) return

  const orderId = selected.value.id
  const previousItems = cloneItems(selected.value.items || [])
  const nextItems = previousItems.filter((_, itemIndex) => itemIndex !== index)

  setOrderItems(orderId, nextItems)

  try {
    await persistItems(orderId, nextItems)
  } catch (e) {
    setOrderItems(orderId, previousItems)
    logError('ShopOrders', 'Delete item error', e)
    toast.show(`Failed to delete item: ${normalizeError(e, 'Unknown error')}`, 'error')
  }
}

const createDraft = async () => {
  try {
    const orderId = await createShopOrder(jobId.value)
    selectedId.value = orderId
    toast.show('New order created', 'success')
  } catch (e) {
    logError('ShopOrders', 'Failed to create order', e)
    toast.show(`Failed to create order: ${normalizeError(e, 'Unknown error')}`, 'error')
  }
}

const deletingOrderId = ref<string | null>(null)

const deleteOrderById = async (orderId: string) => {
  const confirmed = await confirm('Delete this draft order?', {
    title: 'Delete Order',
    confirmText: 'Delete',
    variant: 'danger',
  })
  if (!confirmed) return

  deletingOrderId.value = orderId
  try {
    await deleteShopOrder(jobId.value, orderId)
    toast.show('Order deleted', 'success')
  } catch (e) {
    toast.show('Failed to delete order', 'error')
  } finally {
    deletingOrderId.value = null
  }
}

const handleDeleteOrder = async (orderId: string) => {
  await deleteOrderById(orderId)
}

const submitOrder = async () => {
  if (!selected.value) return
  try {
    // Filter out items with 0 quantity
    const filteredItems = sanitizeShopOrderItems(selected.value.items).filter(item => item.quantity > 0)
    if (filteredItems.length === 0) {
      toast.show('Order must have at least one item with quantity > 0', 'error')
      return
    }
    await updateShopOrderItems(jobId.value, selected.value.id, filteredItems)
    await updateShopOrderStatus(jobId.value, selected.value.id, 'order')
    toast.show('Order submitted', 'success')
  } catch (e) {
    toast.show('Failed to submit order', 'error')
  }
}

const orderOrder = async () => {
  if (!selected.value) return
  try {
    await updateShopOrderStatus(jobId.value, selected.value.id, 'receive')
    toast.show('Order placed', 'success')
  } catch (e) {
    toast.show('Failed to place order', 'error')
  }
}

const receiveOrder = async () => {
  if (!selected.value) return
  try {
    await updateShopOrderStatus(jobId.value, selected.value.id, 'receive')
    toast.show('Order received', 'success')
  } catch (e) {
    toast.show('Failed to receive order', 'error')
  }
}

const sendOrderEmail = async () => {
  if (!selected.value) return
  const finalRecipients = shopOrderRecipients.value

  if (!finalRecipients.length) {
    toast.show('No recipients configured for shop orders', 'error')
    return
  }

  sendingEmail.value = true
  try {
    await sendShopOrderEmail(jobId.value, selected.value.id, finalRecipients)
    // Treat email as submit: move status to 'order'
    await updateShopOrderStatus(jobId.value, selected.value.id, 'order')
    toast.show('Order emailed successfully', 'success')
  } catch (e) {
    toast.show(normalizeError(e, 'Failed to email order'), 'error')
  } finally {
    sendingEmail.value = false
  }
}

onMounted(() => {
  void init()
})
watch(
  () => jobId.value,
  (next, prev) => {
    if (!next || next === prev) return
    void init()
  }
)
onUnmounted(() => {
  clearSubscriptions()
  jobs.stopCurrentJobSubscription()
  shopCatalogStore.stopCatalogSubscription()
  shopCategoriesStore.stopCategoriesSubscription()
})
</script>

<template>
  
  
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Shop Orders" :title="jobName">
      <template #meta>
        <span v-if="jobCode">Job Number: {{ jobCode }}</span>
      </template>
      <template #actions>
        <button @click="createDraft" class="btn btn-primary"><i class="bi bi-plus me-2"></i>New Order</button>
      </template>
    </AppPageHeader>

    <!-- Error Alert -->
    <AppAlert
      v-if="err"
      variant="danger"
      title="Error:"
      :message="err"
      dismissible
      @close="err = ''"
    />

    <!-- Search & Filter -->
    <AppToolbarCard class="mb-4">
      <div class="row g-3">
        <div class="col-md-6">
          <input v-model="search" type="text" class="form-control" placeholder="Search orders..." />
        </div>
        <div class="col-md-6">
          <select v-model="statusFilter" class="form-select">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="order">Order</option>
            <option value="receive">Receive</option>
          </select>
        </div>
      </div>
    </AppToolbarCard>

    <!-- Main Content -->
    <div class="row g-4">
      <!-- Order Details -->
      <div class="col-lg-8">
        <div v-if="!selected" class="card app-section-card app-empty-state-card">
          <AppEmptyState
            class="card-body"
            icon="bi bi-hand-index-thumb"
            message="Select an order to view details"
          />
        </div>
        <div v-else>
          <ShopOrderDetailCard
            :order="selected"
            :sending-email="sendingEmail"
            :format-date="fmtDate"
            :is-editable="canEditOrder(selected)"
            :can-submit="canSubmit(selected)"
            :can-order="canOrder(selected)"
            :can-receive="canReceive(selected)"
            @update-items="handleSelectedItemsUpdate"
            @delete-item="handleDeleteSelectedItem"
            @send-email="sendOrderEmail"
            @submit="submitOrder"
            @place-order="orderOrder"
            @receive="receiveOrder"
          />

          <!-- Catalog Browser (when editing) -->
          <ShopOrderCatalogBrowser
            v-if="canEditOrder(selected)"
            :items="catalog"
            :categories="shopCategories"
            :catalog-item-qtys="catalogItemQtys"
            :selected-item-quantities="selectedCatalogItemQuantities"
            @update:catalog-item-qty="updateCatalogItemQty"
            @select-for-order="selectCatalogItem"
          >
            <template #footer>
              <div class="row g-2 mb-2">
                <div class="col-7"><input v-model="newItemDescription" type="text" class="form-control form-control-sm" placeholder="Description" /></div>
                <div class="col-2">
                  <input
                    v-model="newItemQty"
                    type="text"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    class="form-control form-control-sm"
                    placeholder="Qty"
                    @input="(e) => { newItemQty = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '') }"
                    @focus="(e) => (e.target as HTMLInputElement).select()"
                  />
                </div>
                <div class="col-3"><input v-model="newItemNote" type="text" class="form-control form-control-sm" placeholder="Note" /></div>
              </div>
              <button @click="addItem" class="btn btn-primary btn-sm"><i class="bi bi-plus me-1"></i>Add Custom Item</button>
            </template>
          </ShopOrderCatalogBrowser>

        </div>
      </div>

      <!-- Orders List -->
      <div class="col-lg-4">
        <ShopOrderListCard
          :orders="filtered"
          :loading="loading"
          :selected-id="selectedId"
          :deleting-order-id="deletingOrderId"
          :format-date="fmtDate"
          @select="(orderId) => { selectedId = orderId }"
          @delete="handleDeleteOrder"
        />
      </div>
    </div>
  </div>

</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
</style>

