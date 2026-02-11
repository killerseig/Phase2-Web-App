<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Toast from '../components/Toast.vue'
import ShopCatalogTreeNode from '../components/admin/ShopCatalogTreeNode.vue'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Unsubscribe } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from '../stores/auth'
import { useJobsStore } from '../stores/jobs'
import { useShopCatalogStore } from '../stores/shopCatalog'
import { useShopCategoriesStore } from '../stores/shopCategories'
import { useShopService } from '../services/useShopService'
import { createShopOrder } from '../services/ShopOrders'

defineProps<{ jobId?: string }>()

const route = useRoute()
const auth = useAuthStore()
const jobs = useJobsStore()
const shopCatalogStore = useShopCatalogStore()
const shopCategoriesStore = useShopCategoriesStore()
const shopService = useShopService()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

type ShopOrderStatus = 'draft' | 'order' | 'receive'
interface ShopOrderItem { description: string; quantity: number; note?: string; catalogItemId?: string | null }
interface ShopOrder { id: string; jobId: string; uid: string; ownerUid: string; status: ShopOrderStatus; orderDate?: any; createdAt?: any; updatedAt?: any; items: ShopOrderItem[] }

const jobId = computed(() => String(route.params.jobId))
const job = computed(() => jobs.currentJob)
const jobName = computed(() => job.value?.name ?? 'Shop Orders')
const jobCode = computed(() => job.value?.code ?? '')

const loading = ref(true)
const err = ref('')
const orders = ref<ShopOrder[]>([])
const selectedId = ref<string | null>(null)
const search = ref('')
const statusFilter = ref<'all' | ShopOrderStatus>('all')
const catalogSearch = ref('')
const newItemDescription = ref('')
const newItemCatalogId = ref<string | null>(null)
const newItemQty = ref(1)
const newItemNote = ref('')
const selectedCatalogItem = ref<any | null>(null)
const catalogItemQtys = ref<Record<string, number>>({})
const expandedNodes = ref<Set<string>>(new Set())

const isAdmin = computed(() => auth.role === 'admin')
const isJobManager = computed(() => isAdmin.value)
const catalog = computed(() => shopCatalogStore.allItems)

// Helper to get all categories that should be in the tree (matching categories + their parents)
const getTreeCategoriesWithParents = (): string[] => {
  const categoryIds = new Set<string>()
  
  // First, find all categories with matching items
  const allCategories = shopCategoriesStore.categories
  allCategories.forEach(cat => {
    if (categoryHasMatchingItems(cat.id)) {
      categoryIds.add(cat.id)
      // Also add all parent categories
      let current = cat.parentId ? shopCategoriesStore.getCategoryById(cat.parentId) : null
      while (current) {
        categoryIds.add(current.id)
        current = current.parentId ? shopCategoriesStore.getCategoryById(current.parentId) : null
      }
    }
  })
  
  return Array.from(categoryIds)
}

// Recursively filter tree to only include categories that should be visible
const filterCategoryTree = (tree: any[]): any[] => {
  const visibleIds = getTreeCategoriesWithParents()
  return tree
    .filter(cat => {
      // Only include this category if it's in visibleIds AND it has matching descendants
      if (!visibleIds.includes(cat.id)) return false
      if (!catalogSearch.value.trim()) return true
      // Must have matching descendants (not just matching by name)
      return categoryHasMatchingDescendants(cat.id)
    })
    .map(cat => ({
      ...cat,
      children: filterCategoryTree(cat.children)
    }))
}


const categoryTree = computed(() => filterCategoryTree(shopCategoriesStore.fullTree))
const uncategorizedItems = computed(() => {
  return catalog.value.filter(item => !item.categoryId && item.active && itemMatchesSearch(item)).map(item => `item-${item.id}`)
})

const SCOPE_OPTIONS = [
  { key: 'scope:employee', label: 'Employee' },
  { key: 'scope:shop', label: 'Shop' },
  { key: 'scope:admin', label: 'Admin' },
]

const scopeLabel = (scope: string) => SCOPE_OPTIONS.find(s => s.key === scope)?.label ?? scope
const scopeBadgeClass = (scope: string) => {
  const map: Record<string, string> = { 'scope:employee': 'text-bg-info', 'scope:shop': 'text-bg-dark', 'scope:admin': 'text-bg-secondary' }
  return map[scope] || 'text-bg-light'
}
const statusBadgeClass = (st: ShopOrderStatus) => {
  const map: Record<ShopOrderStatus, string> = { draft: 'text-bg-secondary', order: 'text-bg-primary', receive: 'text-bg-success' }
  return map[st]
}
const fmtDate = (ts: any) => {
  try { return ts?.toDate ? ts.toDate().toLocaleString() : '' } catch { return '' }
}

const allowedScopes = computed(() => {
  if (isJobManager.value) return ['scope:employee', 'scope:shop', 'scope:admin']
  return auth.role === 'shop' ? ['scope:shop'] : ['scope:employee']
})

const defaultScope = computed(() => {
  if (isJobManager.value) return 'scope:admin'
  return auth.role === 'shop' ? 'scope:shop' : 'scope:employee'
})

const selected = computed(() => orders.value.find(o => o.id === selectedId.value) ?? null)

const filtered = computed(() => {
  const s = search.value.trim().toLowerCase()
  return orders.value.filter(o => {
    if (statusFilter.value !== 'all' && o.status !== statusFilter.value) return false
    if (!s) return true
    const haystack = [o.id, o.status, o.uid, ...(o.items || []).map(i => i.description)].join(' ').toLowerCase()
    return haystack.includes(s)
  })
})

const canEditOrder = (o: ShopOrder) => o.status === 'draft'
const canSubmit = (o: ShopOrder) => o.status === 'draft' && o.items.length > 0
const canOrder = (o: ShopOrder) => o.status === 'order'
const canReceive = (o: ShopOrder) => o.status === 'order'
const canChangeScope = (o: ShopOrder) => canEditOrder(o) && isJobManager.value

const itemMatchesSearch = (item: any) => {
  if (!catalogSearch.value.trim()) return true
  const q = catalogSearch.value.toLowerCase()
  const desc = item.description ? item.description.toLowerCase() : ''
  const sku = item.sku ? item.sku.toLowerCase() : ''
  return desc.includes(q) || sku.includes(q)
}

const categoryHasMatchingItems = (categoryId: string, depth: number = 0): boolean => {
  // Prevent infinite recursion (max 50 levels deep)
  if (depth > 50) return false
  
  const q = catalogSearch.value.toLowerCase()
  if (!q) return true
  
  // Check if the category name itself matches
  const cat = shopCategoriesStore.categories.find(c => c.id === categoryId)
  if (cat && cat.name?.toLowerCase().includes(q)) {
    return true
  }
  
  // Check direct items in this category
  const directItems = catalog.value.filter(i => i.categoryId === categoryId && i.active)
  if (directItems.some(i => itemMatchesSearch(i))) return true
  
  // Check child categories recursively
  const children = shopCategoriesStore.getChildren(categoryId)
  return children.some(child => categoryHasMatchingItems(child.id, depth + 1))
}

// Check if a category has matching items/descendants (but not counting the category name itself)
const categoryHasMatchingDescendants = (categoryId: string, depth: number = 0): boolean => {
  if (depth > 50) return false
  
  const q = catalogSearch.value.toLowerCase()
  if (!q) return false
  
  // Check direct items in this category
  const directItems = catalog.value.filter(i => i.categoryId === categoryId && i.active)
  if (directItems.some(i => itemMatchesSearch(i))) return true
  
  // Check child categories recursively (including their names and descendants)
  const children = shopCategoriesStore.getChildren(categoryId)
  return children.some(child => categoryHasMatchingItems(child.id, depth + 1))
}

// Auto-expand categories and items when search has matches
const autoExpandOnSearch = () => {
  if (!catalogSearch.value.trim()) {
    // Don't clear - let manual expansions persist
    return
  }
  
  const nodesToExpand = new Set<string>()
  
  // Helper to expand category and all its parents up the tree
  const expandCategoryAndParents = (categoryId: string, depth: number = 0) => {
    if (depth > 50) return // Prevent infinite recursion
    nodesToExpand.add(categoryId)
    const cat = shopCategoriesStore.categories.find(c => c.id === categoryId)
    if (cat?.parentId) {
      expandCategoryAndParents(cat.parentId, depth + 1)
    }
  }
  
  // Helper to recursively expand all child categories with matches
  const expandChildrenWithMatches = (parentId: string, depth: number = 0) => {
    if (depth > 50) return // Prevent infinite recursion
    const children = shopCategoriesStore.getChildren(parentId)
    children.forEach(child => {
      // Only expand children that have descendants matching the search (not just matching by name)
      if (categoryHasMatchingDescendants(child.id)) {
        nodesToExpand.add(child.id)
        expandChildrenWithMatches(child.id, depth + 1) // Recurse into grandchildren
      }
    })
  }
  
  // Find all root categories with matching descendants and expand them
  const allCategories = shopCategoriesStore.categories
  allCategories.forEach(cat => {
    if (categoryHasMatchingDescendants(cat.id)) {
      expandCategoryAndParents(cat.id)
      expandChildrenWithMatches(cat.id)
    }
  })
  
  // Also expand uncategorized items that match the search, and their matching children
  catalog.value.forEach(item => {
    if (!item.categoryId && item.active && itemMatchesSearch(item)) {
      // Only expand if it has matching descendants
      if (categoryHasMatchingDescendants(`item-${item.id}`)) {
        nodesToExpand.add(`item-${item.id}`)
        expandChildrenWithMatches(`item-${item.id}`)
      }
    }
  })
  
  // Replace the entire ref to ensure Vue reactivity properly updates
  expandedNodes.value = new Set(nodesToExpand)
}

watch(() => catalogSearch.value, () => {
  autoExpandOnSearch()
}, { immediate: false })

const pickFirstIfNeeded = () => {
  if (!selectedId.value && orders.value.length > 0) selectedId.value = orders.value[0].id
}

const toggleExpand = (nodeId: string) => {
  const next = new Set(expandedNodes.value)
  if (next.has(nodeId)) {
    next.delete(nodeId)
  } else {
    next.add(nodeId)
    // When expanding, also expand all ancestor nodes
    expandAncestors(nodeId, next)
  }
  expandedNodes.value = next
}

const normalizeItemNodeId = (id: string) => (id.startsWith('item-') ? id : `item-${id}`)
const resolveParentNodeId = (parentId: string) => {
  if (parentId.startsWith('item-')) return parentId
  return catalog.value.some(i => i.id === parentId) ? normalizeItemNodeId(parentId) : parentId
}

// Helper to expand all ancestor nodes of a category or item
const expandAncestors = (nodeId: string, set: Set<string>, depth: number = 0) => {
  if (depth > 50) return

  if (nodeId.startsWith('item-')) {
    const itemId = nodeId.slice(5)
    const item = catalog.value.find(i => i.id === itemId)
    if (item?.categoryId) {
      set.add(item.categoryId)
      expandAncestors(item.categoryId, set, depth + 1)
    }
    return
  }

  const category = shopCategoriesStore.categories.find(c => c.id === nodeId)
  if (!category?.parentId) {
    return
  }

  const parentNodeId = resolveParentNodeId(category.parentId)
  set.add(parentNodeId)
  expandAncestors(parentNodeId, set, depth + 1)
}

let unsubs: Unsubscribe[] = []

const clearSubscriptions = () => {
  unsubs.forEach(u => u())
  unsubs = []
}

const replaceMerged = (map: Map<string, ShopOrder>) => {
  orders.value = Array.from(map.values()).sort((a, b) => {
    const ta = a.orderDate?.toMillis ? a.orderDate.toMillis() : 0
    const tb = b.orderDate?.toMillis ? b.orderDate.toMillis() : 0
    return tb - ta
  })
  if (selectedId.value && !orders.value.some(o => o.id === selectedId.value)) selectedId.value = null
  pickFirstIfNeeded()
}

const loadOrders = () => {
  clearSubscriptions()
  loading.value = true
  console.log('Loading orders for jobId:', jobId.value)
  const q = query(collection(db, 'jobs', jobId.value, 'shop_orders'), orderBy('orderDate', 'desc'))
  const mergedMap = new Map<string, ShopOrder>()
  
  const u = onSnapshot(q, (snap) => {
    console.log('Orders snapshot received, doc count:', snap.docs.length)
    snap.docChanges().forEach(change => {
      const d = change.doc.data() as any
      const order: ShopOrder = { id: change.doc.id, jobId: d.jobId, uid: d.uid, ownerUid: d.ownerUid, status: d.status, orderDate: d.orderDate, createdAt: d.createdAt, updatedAt: d.updatedAt, items: d.items || [] }
      if (change.type === 'removed') {
        mergedMap.delete(change.doc.id)
      } else {
        mergedMap.set(change.doc.id, order)
      }
    })
    replaceMerged(mergedMap)
    loading.value = false
  }, (e) => {
    console.error('Failed to load orders:', e)
    err.value = e?.message ?? 'Failed to load orders'
    toastRef.value?.show('Failed to load orders: ' + (e?.message ?? 'Unknown error'), 'error')
    loading.value = false
  })
  unsubs.push(u)
}

const loadCatalog = async () => {
  try {
    await shopCatalogStore.fetchCatalog()
  } catch (e: any) {
    toastRef.value?.show('Failed to load catalog', 'error')
  }
}

const init = async () => {
  loading.value = true
  err.value = ''
  try {
    // Load job details
    await jobs.fetchJob(jobId.value)
    
    await shopCatalogStore.fetchCatalog()
    await shopCategoriesStore.fetchAllCategories()
    loadOrders()
  } catch (e: any) {
    console.error('Init error:', e)
    err.value = e?.message ?? 'Failed to initialize'
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
    const updatedItems = [...(selected.value.items || []), { description: newItemDescription.value.trim(), quantity: newItemQty.value, note: newItemNote.value.trim() || undefined, catalogItemId: newItemCatalogId.value }]
    await updateDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id), { items: updatedItems, updatedAt: serverTimestamp() })
    newItemDescription.value = ''
    newItemQty.value = 1
    newItemNote.value = ''
    newItemCatalogId.value = null
    selectedCatalogItem.value = null
    toastRef.value?.show('Item added successfully', 'success')
  } catch (e: any) {
    console.error('Add item error:', e)
    toastRef.value?.show('Failed to add item: ' + (e?.message || 'Unknown error'), 'error')
  }
}

const selectCatalogItem = (item: any) => {
  const qty = catalogItemQtys.value[item.id] || 0
  newItemCatalogId.value = item.id
  newItemDescription.value = item.description
  newItemQty.value = qty
  newItemNote.value = item.sku ? `SKU: ${item.sku}` : ''
  if (item.price) {
    newItemNote.value += (newItemNote.value ? ' - ' : '') + `$${item.price}`
  }
  selectedCatalogItem.value = item
  // Auto-add the item
  addItem()
  // Reset quantity for next selection
  catalogItemQtys.value[item.id] = 0
}

const deleteItem = async (idx: number) => {
  if (!selected.value) return
  try {
    const updatedItems = selected.value.items.filter((_, i) => i !== idx)
    await updateDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id), { items: updatedItems, updatedAt: serverTimestamp() })
  } catch (e: any) {
    toastRef.value?.show('Failed to delete item', 'error')
  }
}

const createDraft = async () => {
  try {
    console.log('Creating order with jobId:', jobId.value, 'scope:', defaultScope.value)
    const orderId = await createShopOrder(jobId.value, defaultScope.value)
    console.log('Order created with ID:', orderId)
    selectedId.value = orderId
    toastRef.value?.show('New order created', 'success')
  } catch (e: any) {
    console.error('Failed to create order:', e)
    toastRef.value?.show('Failed to create order: ' + (e?.message ?? 'Unknown error'), 'error')
  }
}

const deleteOrder = async () => {
  if (!selected.value || !confirm('Delete this order?')) return
  try {
    await deleteDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id))
    toastRef.value?.show('Order deleted', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to delete order', 'error')
  }
}

const changeScope = async (newScope: string) => {
  if (!selected.value) return
  try {
    await updateDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id), { scope: newScope })
  } catch (e: any) {
    toastRef.value?.show('Failed to update scope', 'error')
  }
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
    await updateDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id), { status: 'order' as ShopOrderStatus, items: filteredItems, updatedAt: serverTimestamp() })
    toastRef.value?.show('Order submitted', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to submit order', 'error')
  }
}

const orderOrder = async () => {
  if (!selected.value) return
  try {
    await updateDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id), { status: 'receive' as ShopOrderStatus, updatedAt: serverTimestamp() })
    toastRef.value?.show('Order placed', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to place order', 'error')
  }
}

const receiveOrder = async () => {
  if (!selected.value) return
  try {
    await updateDoc(doc(db, 'jobs', jobId.value, 'shop_orders', selected.value.id), { status: 'receive' as ShopOrderStatus, updatedAt: serverTimestamp() })
    toastRef.value?.show('Order received', 'success')
  } catch (e: any) {
    toastRef.value?.show('Failed to receive order', 'error')
  }
}

onMounted(init)
onUnmounted(clearSubscriptions)
</script>

<template>
  <Toast ref="toastRef" />
  
  <div class="container-fluid py-4" style="max-width: 1200px;">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2 class="h3 mb-1">{{ jobName }} - Shop Orders</h2>
        <div class="text-muted small" v-if="jobCode">Job Number: {{ jobCode }}</div>
      </div>
      <button @click="createDraft" class="btn btn-primary"><i class="bi bi-plus me-2"></i>New Order</button>
    </div>

    <!-- Error Alert -->
    <div v-if="err" class="alert alert-danger alert-dismissible fade show"><strong>Error:</strong> {{ err }}<button type="button" class="btn-close" @click="err = ''"></button></div>

    <!-- Search & Filter -->
    <div class="card mb-4">
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
      <!-- Orders List -->
      <div class="col-lg-4">
        <div class="card">
          <div class="card-header bg-light"><h5 class="mb-0">Orders ({{ filtered.length }})</h5></div>
          <div v-if="loading" class="card-body text-center py-5"><div class="spinner-border spinner-border-sm"></div></div>
          <div v-else-if="!filtered.length" class="card-body text-center text-muted py-5">No orders found</div>
          <div v-else class="list-group list-group-flush">
            <button v-for="order in filtered" :key="order.id" type="button" class="list-group-item list-group-item-action text-start" :class="{ active: selectedId === order.id }" @click="selectedId = order.id">
              <div class="d-flex justify-content-between align-items-start">
                <div>
                  <small class="text-muted">{{ order.id.slice(0, 8) }}</small>
                  <div class="small fw-semibold">{{ fmtDate(order.orderDate) }}</div>
                </div>
                <span :class="`badge ${statusBadgeClass(order.status)}`">{{ order.status }}</span>
              </div>
              <div class="small mt-1">{{ order.items.length }} item(s)</div>
            </button>
          </div>
        </div>
      </div>

      <!-- Order Details -->
      <div class="col-lg-8">
        <div v-if="!selected" class="card text-center text-muted py-5"><p>Select an order to view details</p></div>
        <div v-else>
          <!-- Order Header -->
          <div class="card mb-3">
            <div class="card-header bg-light">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="mb-1">Order {{ selected.id.slice(0, 8) }}</h5>
                  <small class="text-muted">{{ fmtDate(selected.orderDate) }}</small>
                </div>
                <span :class="`badge ${statusBadgeClass(selected.status)}`">{{ selected.status }}</span>
              </div>
            </div>
            <div class="card-body">
              <!-- Scope Selector -->
              <div v-if="canChangeScope(selected)" class="mb-3">
                <label class="form-label">Scope</label>
                <select class="form-select" :value="selected.uid" @change="changeScope(($event.target as HTMLSelectElement).value)">
                  <option v-for="opt in SCOPE_OPTIONS.filter(o => allowedScopes.includes(o.key))" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                </select>
              </div>
              <div v-else class="mb-3">
                <small class="text-muted">Scope: </small>
                <span :class="`badge ${scopeBadgeClass(selected.uid)}`">{{ scopeLabel(selected.uid) }}</span>
              </div>

              <!-- Items Table -->
              <div v-if="selected.items.length > 0" class="table-responsive mb-3" style="border: 1px solid #dee2e6; border-radius: 4px;">
                <h6 class="mb-2">Order Items</h6>
                <table class="table table-sm table-striped table-hover mb-0">
                  <thead class="table-light" style="background-color: #f0f0f0; border-bottom: 2px solid #dee2e6;">
                    <tr>
                      <th style="width: auto;" class="small fw-semibold">Description</th>
                      <th style="width: 100px;" class="small fw-semibold text-center">Qty</th>
                      <th style="width: auto;" class="small fw-semibold">Note</th>
                      <th v-if="canEditOrder(selected)" style="width: 80px;" class="small fw-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(item, idx) in selected.items" :key="idx" style="border-bottom: 1px solid #dee2e6;">
                      <td style="padding: 8px;">
                        <template v-if="canEditOrder(selected)">
                          <input 
                            type="text"
                            class="form-control form-control-sm"
                            :value="item.description"
                            @input="(e) => { item.description = (e.target as HTMLInputElement).value }"
                            placeholder="Item description"
                          />
                        </template>
                        <template v-else>
                          <small>{{ item.description }}</small>
                        </template>
                      </td>
                      <td style="padding: 8px;" class="text-center">
                        <template v-if="canEditOrder(selected)">
                          <input 
                            type="number"
                            min="0"
                            step="1"
                            class="form-control form-control-sm text-center"
                            :value="item.quantity"
                            @input="(e) => { item.quantity = Math.max(0, Math.floor(Number((e.target as HTMLInputElement).value) || 0)) }"
                          />
                        </template>
                        <template v-else>
                          <small class="text-center">{{ item.quantity }}</small>
                        </template>
                      </td>
                      <td style="padding: 8px;">
                        <template v-if="canEditOrder(selected)">
                          <input 
                            type="text"
                            class="form-control form-control-sm"
                            :value="item.note || ''"
                            @input="(e) => { item.note = (e.target as HTMLInputElement).value }"
                            placeholder="Optional note"
                          />
                        </template>
                        <template v-else>
                          <small class="text-muted">{{ item.note || '—' }}</small>
                        </template>
                      </td>
                      <td v-if="canEditOrder(selected)" style="padding: 8px;" class="text-center">
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
                <button v-if="canSubmit(selected)" @click="submitOrder" class="btn btn-warning"><i class="bi bi-check-circle me-1"></i>Submit Order</button>
                <button v-if="canOrder(selected)" @click="orderOrder" class="btn btn-info"><i class="bi bi-box-seam me-1"></i>Place Order</button>
                <button v-if="canReceive(selected)" @click="receiveOrder" class="btn btn-success"><i class="bi bi-check me-1"></i>Receive</button>
              </div>
            </div>
          </div>

          <!-- Catalog Browser (when editing) -->
          <div v-if="canEditOrder(selected)" class="card">
            <div class="card-header bg-light">
              <h5 class="mb-3">Add Items from Catalog</h5>
              <input 
                v-model="catalogSearch" 
                type="text" 
                class="form-control form-control-sm" 
                placeholder="Search by description or SKU..."
              />
            </div>
            <div class="card-body">
              <div v-if="catalog.length === 0" class="alert alert-info">
                No items in catalog. Please add items to the catalog first in Admin > Shop Catalog.
              </div>
              <div v-else-if="!uncategorizedItems.length && !categoryTree.length" class="alert alert-info">
                No items match your search.
              </div>
              <div v-else class="catalog-tree">
                <!-- Uncategorized Items (if any) -->
                <div v-for="itemId of uncategorizedItems" :key="itemId" class="mb-0">
                  <ShopCatalogTreeNode
                    :node-id="itemId"
                    :expanded="expandedNodes"
                    :items="catalog"
                    :order-mode="true"
                    :catalog-item-qtys="catalogItemQtys"
                    :item-filter="itemMatchesSearch"
                    @toggle-expand="toggleExpand"
                    @select-for-order="selectCatalogItem"
                  />
                </div>
                
                <!-- Categories and their items -->
                <div v-for="cat of categoryTree" :key="cat.id">
                  <ShopCatalogTreeNode
                    :node-id="cat.id"
                    :expanded="expandedNodes"
                    :items="catalog"
                    :order-mode="true"
                    :catalog-item-qtys="catalogItemQtys"
                    :item-filter="itemMatchesSearch"
                    @toggle-expand="toggleExpand"
                    @select-for-order="selectCatalogItem"
                  />
                </div>
              </div>
            </div>

            <!-- Manual Entry (Secondary) -->
            <div class="card-footer bg-light">
              <h6 class="mb-2">Or add a custom item</h6>
              <div class="row g-2 mb-2">
                <div class="col-7"><input v-model="newItemDescription" type="text" class="form-control form-control-sm" placeholder="Description" /></div>
                <div class="col-2"><input v-model.number="newItemQty" type="number" min="1" step="1" class="form-control form-control-sm" @input="(e) => { newItemQty = Math.max(1, Math.floor(Number((e.target as HTMLInputElement).value) || 1)) }" /></div>
                <div class="col-3"><input v-model="newItemNote" type="text" class="form-control form-control-sm" placeholder="Note" /></div>
              </div>
              <button @click="addItem" class="btn btn-primary btn-sm"><i class="bi bi-plus me-1"></i>Add Custom Item</button>
            </div>
          </div>

          <!-- Delete Draft (when editing) -->
          <div v-if="canEditOrder(selected)" class="card">
            <div class="card-body">
              <button @click="deleteOrder" class="btn btn-danger btn-sm"><i class="bi bi-trash me-1"></i>Delete Draft</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-tree {
  border: 1px solid #dee2e6;
  border-radius: 4px;
  max-height: 600px;
  overflow-y: auto;
}

.catalog-tree::-webkit-scrollbar {
  width: 8px;
}

.catalog-tree::-webkit-scrollbar-track {
  background: transparent;
}

.catalog-tree::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 4px;
}

.catalog-tree::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
