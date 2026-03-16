<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import Toast from '@/components/Toast.vue'
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
  type ShopOrderStatus,
} from '@/services'
import { useJobAccess } from '@/composables/useJobAccess'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useSubscriptionRegistry } from '@/composables/useSubscriptionRegistry'
import { ROUTE_NAMES } from '@/constants/app'
import { normalizeError } from '@/services/serviceUtils'
import { formatDateTime, toMillis } from '@/utils/datetime'
import { logError, logWarn } from '@/utils/logger'

const props = defineProps<{ jobId?: string }>()
const router = useRouter()
const auth = useAuthStore()
const jobs = useJobsStore()
const shopCatalogStore = useShopCatalogStore()
const shopCategoriesStore = useShopCategoriesStore()
const { items: catalog } = storeToRefs(shopCatalogStore)
const { categories: shopCategories, fullTree: shopCategoriesTree } = storeToRefs(shopCategoriesStore)
const jobAccess = useJobAccess()
const { confirm } = useConfirmDialog()
const subscriptions = useSubscriptionRegistry()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

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

const statusBadgeClass = (st: ShopOrderStatus) => {
  const map: Record<ShopOrderStatus, string> = { draft: 'text-bg-secondary', order: 'text-bg-primary', receive: 'text-bg-success' }
  return map[st]
}
const statusLabel = (st: ShopOrderStatus) => {
  const map: Record<ShopOrderStatus, string> = { draft: 'Draft', order: 'Submitted', receive: 'Received' }
  return map[st] ?? st
}
const fmtDate = (ts: unknown) => formatDateTime(ts)

const selected = computed(() => orders.value.find(o => o.id === selectedId.value) ?? null)

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
        toastRef.value?.show('Failed to load orders: ' + (error.message ?? 'Unknown error'), 'error')
        loading.value = false
      },
    }))
  } catch (error) {
    const message = normalizeError(error, 'Failed to load orders')
    err.value = message
    toastRef.value?.show(`Failed to load orders: ${message}`, 'error')
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
    toastRef.value?.show('Description is required', 'error')
    return
  }
  
  if (!selected.value) {
    toastRef.value?.show('No order selected', 'error')
    return
  }
  
  try {
    const description = newItemDescription.value.trim()
    const quantity = Math.max(1, Math.floor(Number(newItemQty.value) || 1))
    const note = newItemNote.value.trim() || undefined
    const catalogItemId = newItemCatalogId.value ?? null
    const updatedItems = [...(selected.value.items || []), { description, quantity, ...(note ? { note } : {}), catalogItemId }]
    await updateShopOrderItems(jobId.value, selected.value.id, updatedItems)
    newItemDescription.value = ''
    newItemQty.value = ''
    newItemNote.value = ''
    newItemCatalogId.value = null
    selectedCatalogItem.value = null
    toastRef.value?.show('Item added successfully', 'success')
  } catch (e) {
    logError('ShopOrders', 'Add item error', e)
    toastRef.value?.show(`Failed to add item: ${normalizeError(e, 'Unknown error')}`, 'error')
  }
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
    toastRef.value?.show('Catalog item is missing a description', 'error')
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

const deleteItem = async (idx: number) => {
  if (!selected.value) return
  try {
    const updatedItems = selected.value.items.filter((_, i) => i !== idx)
    await updateShopOrderItems(jobId.value, selected.value.id, updatedItems)
  } catch (e) {
    toastRef.value?.show('Failed to delete item', 'error')
  }
}

const persistItems = async () => {
  if (!selected.value) return
  try {
    const sanitized = (selected.value.items || []).map(it => ({
      description: (it.description || '').trim(),
      quantity: Math.max(0, Math.floor(Number(it.quantity) || 0)),
      ...(it.note ? { note: it.note } : {}),
      catalogItemId: it.catalogItemId ?? null,
    }))
    await updateShopOrderItems(jobId.value, selected.value.id, sanitized)
  } catch (e) {
    logError('ShopOrders', 'Failed to persist items', e)
  }
}

const createDraft = async () => {
  try {
    const orderId = await createShopOrder(jobId.value)
    selectedId.value = orderId
    toastRef.value?.show('New order created', 'success')
  } catch (e) {
    logError('ShopOrders', 'Failed to create order', e)
    toastRef.value?.show(`Failed to create order: ${normalizeError(e, 'Unknown error')}`, 'error')
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
    toastRef.value?.show('Order deleted', 'success')
  } catch (e) {
    toastRef.value?.show('Failed to delete order', 'error')
  } finally {
    deletingOrderId.value = null
  }
}

const handleOrderSelect = (orderId: string) => {
  selectedId.value = orderId
}

const handleOrderKeySelect = (event: KeyboardEvent, orderId: string) => {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  handleOrderSelect(orderId)
}

const handleDeleteOrderClick = async (event: MouseEvent, orderId: string) => {
  event.stopPropagation()
  await deleteOrderById(orderId)
}

const submitOrder = async () => {
  if (!selected.value) return
  try {
    // Filter out items with 0 quantity
    const filteredItems = selected.value.items.filter(item => item.quantity > 0)
    if (filteredItems.length === 0) {
      toastRef.value?.show('Order must have at least one item with quantity > 0', 'error')
      return
    }
    await updateShopOrderItems(jobId.value, selected.value.id, filteredItems)
    await updateShopOrderStatus(jobId.value, selected.value.id, 'order')
    toastRef.value?.show('Order submitted', 'success')
  } catch (e) {
    toastRef.value?.show('Failed to submit order', 'error')
  }
}

const orderOrder = async () => {
  if (!selected.value) return
  try {
    await updateShopOrderStatus(jobId.value, selected.value.id, 'receive')
    toastRef.value?.show('Order placed', 'success')
  } catch (e) {
    toastRef.value?.show('Failed to place order', 'error')
  }
}

const receiveOrder = async () => {
  if (!selected.value) return
  try {
    await updateShopOrderStatus(jobId.value, selected.value.id, 'receive')
    toastRef.value?.show('Order received', 'success')
  } catch (e) {
    toastRef.value?.show('Failed to receive order', 'error')
  }
}

const sendOrderEmail = async () => {
  if (!selected.value) return
  const finalRecipients = shopOrderRecipients.value

  if (!finalRecipients.length) {
    toastRef.value?.show('No recipients configured for shop orders', 'error')
    return
  }

  sendingEmail.value = true
  try {
    await sendShopOrderEmail(jobId.value, selected.value.id, finalRecipients)
    // Treat email as submit: move status to 'order'
    await updateShopOrderStatus(jobId.value, selected.value.id, 'order')
    toastRef.value?.show('Order emailed successfully', 'success')
  } catch (e) {
    toastRef.value?.show(normalizeError(e, 'Failed to email order'), 'error')
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
  <Toast ref="toastRef" />
  
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
    <div v-if="err" class="alert alert-danger alert-dismissible fade show"><strong>Error:</strong> {{ err }}<button type="button" class="btn-close" @click="err = ''"></button></div>

    <!-- Search & Filter -->
    <div class="card mb-4 app-toolbar-card">
      <div class="card-body">
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
      </div>
    </div>

    <!-- Main Content -->
    <div class="row g-4">
      <!-- Order Details -->
      <div class="col-lg-8">
        <div v-if="!selected" class="card app-section-card app-empty-state-card">
          <div class="card-body text-center text-muted py-5">
            <i class="bi bi-hand-index-thumb fs-3"></i>
            <p class="mb-0 mt-2">Select an order to view details</p>
          </div>
        </div>
        <div v-else>
          <!-- Order Header -->
          <div class="card mb-4 order-card app-section-card">
            <div class="card-header panel-header">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="mb-1">Order {{ selected.id.slice(0, 8) }}</h5>
                  <small class="text-muted">{{ fmtDate(selected.orderDate) }}</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <button class="btn btn-success btn-sm" type="button" @click="sendOrderEmail" :disabled="sendingEmail" title="Submit and email this order">
                    <span v-if="sendingEmail" class="spinner-border spinner-border-sm me-1" />
                    <i v-else class="bi bi-envelope me-1"></i>Submit & Email
                  </button>
                  <span :class="`badge app-badge-pill app-badge-pill--sm ${statusBadgeClass(selected.status)}`">{{ statusLabel(selected.status) }}</span>
                </div>
              </div>
            </div>
            <div class="card-body order-body">
              <!-- Items Table -->
              <div v-if="selected.items.length > 0" class="table-responsive mb-3 order-table">
                <h6 class="mb-2">Order Items</h6>
                <table class="table table-sm table-striped table-hover mb-0 align-middle">
                  <thead>
                    <tr>
                      <th class="small fw-semibold">Description</th>
                      <th class="small fw-semibold text-center">Qty</th>
                      <th class="small fw-semibold">Note</th>
                      <th v-if="canEditOrder(selected)" class="small fw-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in selected.items" :key="item.catalogItemId ?? `${item.description}-${idx}`">
                      <td class="p-2">
                        <template v-if="canEditOrder(selected)">
                          <input 
                            type="text"
                            class="form-control form-control-sm"
                            :value="item.description"
                            @input="(e) => { item.description = (e.target as HTMLInputElement).value; persistItems() }"
                            placeholder="Item description"
                          />
                        </template>
                        <template v-else>
                          <small>{{ item.description }}</small>
                        </template>
                      </td>
                      <td class="p-2 text-center">
                        <template v-if="canEditOrder(selected)">
                          <input 
                            type="number"
                            min="0"
                            step="1"
                            class="form-control form-control-sm text-center"
                            :value="item.quantity"
                            @input="(e) => { item.quantity = Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0)); persistItems() }"
                          />
                        </template>
                        <template v-else>
                          <small class="text-center">{{ item.quantity }}</small>
                        </template>
                      </td>
                      <td class="p-2">
                        <template v-if="canEditOrder(selected)">
                          <input 
                            type="text"
                            class="form-control form-control-sm"
                            :value="item.note || ''"
                            @input="(e) => { item.note = (e.target as HTMLInputElement).value; persistItems() }"
                            placeholder="Optional note"
                          />
                        </template>
                        <template v-else>
                          <small class="text-muted">{{ item.note || '--' }}</small>
                        </template>
                      </td>
                      <td v-if="canEditOrder(selected)" class="p-2 text-center">
                        <button 
                          @click="deleteItem(idx)" 
                          class="btn btn-sm btn-outline-danger"
                          title="Delete row"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Action Buttons -->
              <div class="d-grid gap-2 mt-3" v-if="!canEditOrder(selected)">
                <button v-if="canSubmit(selected)" @click="submitOrder" class="btn btn-success"><i class="bi bi-check-circle me-1"></i>Submit Order</button>
                <button v-if="canOrder(selected)" @click="orderOrder" class="btn btn-info"><i class="bi bi-box-seam me-1"></i>Place Order</button>
                <button v-if="canReceive(selected)" @click="receiveOrder" class="btn btn-success"><i class="bi bi-check me-1"></i>Receive</button>
              </div>
            </div>
          </div>

          <!-- Catalog Browser (when editing) -->
          <ShopOrderCatalogBrowser
            v-if="canEditOrder(selected)"
            :items="catalog"
            :categories="shopCategories"
            :full-tree="shopCategoriesTree"
            :catalog-item-qtys="catalogItemQtys"
            @update:catalog-item-qty="updateCatalogItemQty"
            @select-for-order="selectCatalogItem"
          >
            <template #footer>
              <h6 class="mb-2">Or add a custom item</h6>
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
        <div class="card panel-muted app-list-card">
          <div class="card-header panel-header d-flex justify-content-between align-items-center">
            <h5 class="mb-0"><i class="bi bi-bag me-2"></i>Orders</h5>
            <span class="badge app-badge-pill app-badge-pill--sm text-bg-secondary">{{ filtered.length }}</span>
          </div>
          <div v-if="loading" class="card-body text-center py-5"><div class="spinner-border spinner-border-sm"></div></div>
          <div v-else-if="!filtered.length" class="card-body text-center text-muted py-5">
            <i class="bi bi-inbox mb-2 d-block fs-4"></i>
            <div>No orders yet</div>
            <div class="small text-muted">Create one to get started</div>
          </div>
          <div v-else class="list-group list-group-flush">
            <div
              v-for="order in filtered"
              :key="order.id"
              role="button"
              tabindex="0"
              class="list-group-item list-group-item-action text-start order-list-item d-flex justify-content-between align-items-start gap-3"
              :class="{ active: selectedId === order.id }"
              @click="handleOrderSelect(order.id)"
              @keydown="handleOrderKeySelect($event, order.id)"
            >
              <div class="me-2">
                <div class="fw-semibold">{{ fmtDate(order.orderDate) }}</div>
                <div class="order-meta small">{{ order.id.slice(0, 8) }}</div>
                <div class="small mt-1 order-meta">{{ order.items.length }} item(s)</div>
              </div>
              <div class="d-flex flex-column align-items-end gap-2">
                <span :class="`badge app-badge-pill app-badge-pill--sm ${statusBadgeClass(order.status)}`">{{ statusLabel(order.status) }}</span>
                <button
                  v-if="canEditOrder(order)"
                  type="button"
                  class="btn btn-sm btn-outline-danger order-delete-btn"
                  :disabled="deletingOrderId === order.id"
                  @click="handleDeleteOrderClick($event, order.id)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;
.order-list-item {
  background: $surface;
  color: $body-color;
  border-color: rgba($border-color, 0.6);
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background-color: mix($primary, $surface, 12%);
  }
}

.order-meta {
  color: rgba($body-color, 0.72);
}

.order-list-item.active {
  background: linear-gradient(135deg, mix($primary, $surface, 20%), mix($primary, $surface, 28%));
  border-color: mix($primary, $border-color, 55%);
  color: $body-color;
  box-shadow: 0 0 0 1px rgba($primary, 0.35);
}

.order-list-item:focus-visible {
  outline: 2px solid $primary;
  outline-offset: -4px;
}

.order-list-item.active .order-meta {
  color: rgba($body-color, 0.9);
}

.order-list-item:active {
  background-color: mix($primary, $surface, 16%);
}

.order-delete-btn {
  line-height: 1;
  padding: 0.2rem 0.4rem;
}

.order-card .card-header {
  border-bottom: 1px solid $border-color;
  background: $surface-2;
}

.order-card .order-body {
  background: $surface;
}

.order-table {
  border: 1px solid $border-color;
  border-radius: $border-radius;
  background: $surface;
}
</style>

