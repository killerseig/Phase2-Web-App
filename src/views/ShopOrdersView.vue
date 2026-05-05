<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import { useRoute } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import {
  createShopOrderRecord,
  deleteShopOrderRecord,
  sendShopOrderSubmissionEmail,
  subscribeShopOrders,
  updateShopOrderRecord,
} from '@/services/shopOrders'
import { subscribeShopCatalogItems, subscribeShopCategories } from '@/services/shopCatalog'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import type {
  JobRecord,
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type TreeNode =
  | {
      key: `category:${string}`
      kind: 'category'
      id: string
      parentId: string | null
      depth: number
      label: string
      secondary: string
      hasChildren: boolean
    }
  | {
      key: `item:${string}`
      kind: 'item'
      id: string
      parentId: string | null
      depth: number
      label: string
    }

interface OrderMetaFormState {
  deliveryDate: string
  comments: string
}

interface CustomItemFormState {
  description: string
  quantity: string
  note: string
}

type ContextMenuTarget =
  | { kind: 'root' }
  | { kind: 'category'; id: string }
  | { kind: 'item'; id: string }

interface ContextMenuAction {
  key: string
  label: string
  disabled?: boolean
  run: () => void | Promise<void>
}

const route = useRoute()
const auth = useAuthStore()
const jobsStore = useJobsStore()

const categories = ref<ShopCategoryRecord[]>([])
const catalogItems = ref<ShopCatalogItemRecord[]>([])
const orders = ref<ShopOrderRecord[]>([])
const treeSearch = ref('')
const activeFolderId = ref<string | null>(null)
const selectedCatalogItemId = ref<string | null>(null)
const selectedOrderId = ref<string | null>(null)
const rootBucketExpanded = ref(true)
const expandedCategoryIds = ref<string[]>([])
const catalogLoading = ref(true)
const ordersLoading = ref(true)
const catalogError = ref('')
const ordersError = ref('')
const actionError = ref('')
const actionInfo = ref('')
const createOrderLoading = ref(false)
const itemActionLoading = ref(false)
const hydratingOrderMetaForm = ref(false)
const lastHydratedOrderId = ref<string | null>(null)
const lastSavedOrderMetaSignature = ref('')
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  target: { kind: 'root' } as ContextMenuTarget,
})

const orderMetaForm = reactive<OrderMetaFormState>({
  deliveryDate: '',
  comments: '',
})

const customItemForm = reactive<CustomItemFormState>({
  description: '',
  quantity: '1',
  note: '',
})

const catalogItemQuantities = reactive<Record<string, string>>({})

let unsubscribeCategories: (() => void) | null = null
let unsubscribeCatalogItems: (() => void) | null = null
let unsubscribeOrders: (() => void) | null = null
let orderMetaSaveTimer: ReturnType<typeof setTimeout> | null = null
let treeInitialized = false

const jobId = computed(() => String(route.params.jobId ?? ''))
const job = computed<JobRecord | null>(() => {
  if (jobsStore.currentJob?.id === jobId.value) return jobsStore.currentJob
  return jobsStore.jobs.find((entry) => entry.id === jobId.value) ?? null
})

const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
const catalogItemsById = computed(() => new Map(catalogItems.value.map((item) => [item.id, item])))

const childCategoriesByParent = computed(() => {
  const map = new Map<string | null, ShopCategoryRecord[]>()

  for (const category of categories.value) {
    const key = category.parentId ?? null
    const next = map.get(key) ?? []
    next.push(category)
    map.set(key, next)
  }

  for (const siblings of map.values()) {
    siblings.sort((left, right) => left.name.localeCompare(right.name))
  }

  return map
})

const childItemsByParent = computed(() => {
  const map = new Map<string | null, ShopCatalogItemRecord[]>()

  for (const item of catalogItems.value) {
    const key = item.categoryId ?? null
    const next = map.get(key) ?? []
    next.push(item)
    map.set(key, next)
  }

  for (const siblings of map.values()) {
    siblings.sort((left, right) => left.description.localeCompare(right.description))
  }

  return map
})

const normalizedTreeSearch = computed(() => normalizeSearch(treeSearch.value))
const selectedCatalogItem = computed(() =>
  selectedCatalogItemId.value
    ? catalogItems.value.find((item) => item.id === selectedCatalogItemId.value) ?? null
    : null,
)
const selectedOrder = computed(() =>
  orders.value.find((order) => order.id === selectedOrderId.value) ?? null,
)
const canEditSelectedOrder = computed(() => selectedOrder.value?.status === 'draft')
const draftOrders = computed(() => orders.value.filter((order) => order.status === 'draft'))
const submittedOrders = computed(() => orders.value.filter((order) => order.status === 'submitted'))
const orderMutationDisabled = computed(
  () => itemActionLoading.value || createOrderLoading.value || !jobId.value || !job.value,
)
const orderItemCount = computed(() => selectedOrder.value?.items.length ?? 0)
const orderTotalQuantity = computed(() =>
  (selectedOrder.value?.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0),
)

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

const rootBucketHasChildren = computed(() => hasVisibleChildren(null))
const rootBucketSummary = computed(() =>
  formatFolderItemSummary(
    getVisibleChildCategoryCount(null),
    getVisibleChildItemCount(null),
  ),
)
const treeListCollapsed = computed(
  () => !catalogLoading.value && !normalizedTreeSearch.value && !rootBucketExpanded.value && treeNodes.value.length === 0,
)
const treeNodes = computed<TreeNode[]>(() => {
  if (!normalizedTreeSearch.value && !rootBucketExpanded.value) return []
  return buildTreeNodes(null, 1)
})

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function makeLocalItemId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `shop-order-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayDateString() {
  return formatDateInput(new Date())
}

function getNextThursdayDateString() {
  const nextDate = new Date()
  const day = nextDate.getDay()
  const daysUntilThursday = (4 - day + 7) % 7
  nextDate.setDate(nextDate.getDate() + daysUntilThursday)
  return formatDateInput(nextDate)
}

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function formatOrderTimestamp(value: unknown) {
  const millis = toMillis(value)
  if (!millis) return 'Unknown date'

  return new Date(millis).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getCategoryDisplayName(category: Pick<ShopCategoryRecord, 'name'>) {
  return category.name.trim() || 'Untitled Folder'
}

function getItemDisplayName(item: Pick<ShopCatalogItemRecord, 'description'>) {
  return item.description.trim() || 'Untitled Item'
}

function getCatalogOrderItemDescription(item: Pick<ShopCatalogItemRecord, 'description' | 'categoryId'>) {
  const itemName = getItemDisplayName(item)
  const categoryPath = getCategoryPath(item.categoryId)

  if (categoryPath === 'Top Level') return itemName
  return `${categoryPath} / ${itemName}`
}

function getOrderItemDisplayName(item: Pick<ShopOrderItemRecord, 'description' | 'sourceType' | 'categoryId'>) {
  const itemName = item.description.trim() || 'Untitled Item'

  if (item.sourceType !== 'catalog') return itemName

  const categoryPath = getCategoryPath(item.categoryId)
  if (categoryPath === 'Top Level') return itemName
  if (itemName.startsWith(`${categoryPath} / `)) return itemName

  return `${categoryPath} / ${itemName}`
}

function getCategoryPath(categoryId: string | null) {
  if (!categoryId) return 'Top Level'

  const segments: string[] = []
  let currentId: string | null = categoryId

  while (currentId) {
    const category = categoriesById.value.get(currentId)
    if (!category) break
    segments.unshift(getCategoryDisplayName(category))
    currentId = category.parentId
  }

  return segments.join(' / ') || 'Top Level'
}

function getVisibleChildCategoryCount(categoryId: string | null) {
  return (childCategoriesByParent.value.get(categoryId) ?? []).filter((category) => category.active).length
}

function getVisibleChildItemCount(categoryId: string | null) {
  return (childItemsByParent.value.get(categoryId) ?? []).filter((item) => item.active).length
}

function formatFolderItemSummary(folderCount: number, itemCount: number) {
  const parts: string[] = []

  if (folderCount > 0) {
    parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`)
  }

  if (itemCount > 0) {
    parts.push(`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`)
  }

  return parts.join(' | ')
}

function hasVisibleChildren(categoryId: string | null) {
  const visibleCategories = (childCategoriesByParent.value.get(categoryId) ?? []).some((category) => category.active)
  if (visibleCategories) return true

  return (childItemsByParent.value.get(categoryId) ?? []).some((item) => item.active)
}

function itemMatchesSearch(item: ShopCatalogItemRecord) {
  if (!item.active) return false
  if (!normalizedTreeSearch.value) return true

  const haystack = [
    getItemDisplayName(item),
    item.sku ?? '',
    getCategoryPath(item.categoryId),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(normalizedTreeSearch.value)
}

function categoryMatchesSearch(categoryId: string): boolean {
  const category = categoriesById.value.get(categoryId)
  if (!category || !category.active) return false

  if (!normalizedTreeSearch.value) return true
  if (getCategoryDisplayName(category).toLowerCase().includes(normalizedTreeSearch.value)) return true

  const directItems = childItemsByParent.value.get(categoryId) ?? []
  if (directItems.some((item) => itemMatchesSearch(item))) return true

  const childCategories = childCategoriesByParent.value.get(categoryId) ?? []
  return childCategories.some((child) => categoryMatchesSearch(child.id))
}

function buildTreeNodes(parentId: string | null, depth: number): TreeNode[] {
  const nodes: TreeNode[] = []
  const visibleCategories = (childCategoriesByParent.value.get(parentId) ?? []).filter(
    (category) => category.active && categoryMatchesSearch(category.id),
  )

  for (const category of visibleCategories) {
    nodes.push({
      key: `category:${category.id}`,
      kind: 'category',
      id: category.id,
      parentId: category.parentId,
      depth,
      label: getCategoryDisplayName(category),
      secondary: formatFolderItemSummary(
        getVisibleChildCategoryCount(category.id),
        getVisibleChildItemCount(category.id),
      ),
      hasChildren: hasVisibleChildren(category.id),
    })

    if (normalizedTreeSearch.value || isCategoryExpanded(category.id)) {
      nodes.push(...buildTreeNodes(category.id, depth + 1))
    }
  }

  const visibleItems = (childItemsByParent.value.get(parentId) ?? []).filter((item) => itemMatchesSearch(item))
  for (const item of visibleItems) {
    nodes.push({
      key: `item:${item.id}`,
      kind: 'item',
      id: item.id,
      parentId: item.categoryId,
      depth,
      label: getItemDisplayName(item),
    })
  }

  return nodes
}

function isCategoryExpanded(categoryId: string) {
  return expandedCategoryIds.value.includes(categoryId)
}

function ensureExpandedToCategory(categoryId: string | null) {
  let currentId = categoryId
  const nextExpanded = new Set(expandedCategoryIds.value)

  while (currentId) {
    nextExpanded.add(currentId)
    currentId = categoriesById.value.get(currentId)?.parentId ?? null
  }

  expandedCategoryIds.value = Array.from(nextExpanded)
}

function toggleCategoryExpanded(categoryId: string) {
  if (isCategoryExpanded(categoryId)) {
    expandedCategoryIds.value = expandedCategoryIds.value.filter((id) => id !== categoryId)
    return
  }

  expandedCategoryIds.value = [...expandedCategoryIds.value, categoryId]
}

function toggleRootBucketExpanded() {
  rootBucketExpanded.value = !rootBucketExpanded.value
}

function selectRoot() {
  activeFolderId.value = null
  selectedCatalogItemId.value = null
}

function selectFolder(categoryId: string, options?: { ensureExpanded?: boolean }) {
  activeFolderId.value = categoryId
  selectedCatalogItemId.value = null
  if (options?.ensureExpanded ?? true) {
    ensureExpandedToCategory(categoryId)
  }
}

function inspectCatalogItem(item: ShopCatalogItemRecord) {
  selectedCatalogItemId.value = item.id
  activeFolderId.value = item.categoryId
  ensureExpandedToCategory(item.categoryId)
}

function handleTreeNodeSelection(node: TreeNode) {
  if (node.kind === 'category') {
    selectFolder(node.id, { ensureExpanded: false })
    if (node.hasChildren) {
      toggleCategoryExpanded(node.id)
    }
    return
  }

  const item = catalogItems.value.find((entry) => entry.id === node.id)
  if (item) {
    inspectCatalogItem(item)
  }
}

async function handleTreeItemAdd(itemId: string) {
  const item = catalogItemsById.value.get(itemId)
  if (!item) return

  await addCatalogItemToOrder(item)
}

function getVisibleCategoryIds() {
  return categories.value.filter((category) => category.active).map((category) => category.id)
}

function expandAllCategories() {
  rootBucketExpanded.value = true
  expandedCategoryIds.value = getVisibleCategoryIds()
  closeContextMenu()
}

function collapseAllCategories() {
  rootBucketExpanded.value = false
  expandedCategoryIds.value = []
  closeContextMenu()
}

function closeContextMenu() {
  contextMenu.visible = false
}

function handleContextMenuAction(action: ContextMenuAction) {
  if (action.disabled) return
  void action.run()
}

function openContextMenuAt(target: ContextMenuTarget, clientX: number, clientY: number) {
  const menuWidth = 220
  const menuHeight = 220
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  contextMenu.x = Math.min(clientX, viewportWidth - menuWidth - 12)
  contextMenu.y = Math.min(clientY, viewportHeight - menuHeight - 12)
  contextMenu.target = target
  contextMenu.visible = true
}

function openContextMenu(event: MouseEvent, target: ContextMenuTarget) {
  event.preventDefault()
  event.stopPropagation()
  openContextMenuAt(target, event.clientX, event.clientY)
}

function openRootContextMenu(event: MouseEvent) {
  openContextMenu(event, { kind: 'root' })
}

function openNodeContextMenu(event: MouseEvent, node: TreeNode) {
  if (node.kind === 'category') {
    openContextMenu(event, { kind: 'category', id: node.id })
    return
  }

  openContextMenu(event, { kind: 'item', id: node.id })
}

function handleGlobalPointerDown(event: PointerEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.shop-orders-context-menu')) {
    return
  }
  closeContextMenu()
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeContextMenu()
  }
}

const contextMenuActions = computed<ContextMenuAction[]>(() => {
  const target = contextMenu.target
  const visibleCategoryIds = getVisibleCategoryIds()
  const hasVisibleCategories = visibleCategoryIds.length > 0
  const allVisibleCategoriesExpanded =
    rootBucketExpanded.value
    && (!hasVisibleCategories || visibleCategoryIds.every((categoryId) => expandedCategoryIds.value.includes(categoryId)))
  const anyFoldersExpanded = rootBucketExpanded.value || expandedCategoryIds.value.length > 0

  if (target.kind === 'root') {
    return [
      {
        key: 'select-root',
        label: 'Select Top Level',
        run: () => {
          selectRoot()
          closeContextMenu()
        },
      },
      {
        key: 'expand-all',
        label: 'Expand All Folders',
        disabled: allVisibleCategoriesExpanded,
        run: () => {
          expandAllCategories()
        },
      },
      {
        key: 'collapse-all',
        label: 'Collapse All Folders',
        disabled: !anyFoldersExpanded,
        run: () => {
          collapseAllCategories()
        },
      },
    ]
  }

  if (target.kind === 'category') {
    return [
      {
        key: 'expand-all',
        label: 'Expand All Folders',
        disabled: allVisibleCategoriesExpanded,
        run: () => {
          expandAllCategories()
        },
      },
      {
        key: 'collapse-all',
        label: 'Collapse All Folders',
        disabled: !anyFoldersExpanded,
        run: () => {
          collapseAllCategories()
        },
      },
    ]
  }

  return [
    {
      key: 'select-item',
      label: 'Select Item',
      run: () => {
        const item = catalogItemsById.value.get(target.id)
        if (item) inspectCatalogItem(item)
        closeContextMenu()
      },
    },
    {
      key: 'add-item',
      label: 'Add to Order',
      disabled: orderMutationDisabled.value,
      run: async () => {
        closeContextMenu()
        await handleTreeItemAdd(target.id)
      },
    },
    {
      key: 'expand-all',
      label: 'Expand All Folders',
      disabled: allVisibleCategoriesExpanded,
      run: () => {
        expandAllCategories()
      },
    },
    {
      key: 'collapse-all',
      label: 'Collapse All Folders',
      disabled: !anyFoldersExpanded,
      run: () => {
        collapseAllCategories()
      },
    },
  ]
})

function getOrderStatusLabel(order: ShopOrderRecord) {
  return order.status === 'submitted' ? 'Submitted' : 'Draft'
}

function getOrderDisplayLabel(order: ShopOrderRecord) {
  const createdLabel = formatOrderTimestamp(order.createdAt)
  if (order.deliveryDate) {
    return `${getOrderStatusLabel(order)} / Due ${order.deliveryDate}`
  }

  return `${getOrderStatusLabel(order)} / ${createdLabel}`
}

function isThursdayDeliveryValue(value: string | null | undefined) {
  if (!value) return false
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false
  return new Date(year, month - 1, day).getDay() === 4
}

function readTextInputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target.value : ''
}

function readQuantity(value: string | number | null | undefined) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.round(parsed)
}

function serializeOrderMetaForm(form: OrderMetaFormState) {
  return JSON.stringify({
    deliveryDate: form.deliveryDate.trim(),
    comments: form.comments.trim(),
  })
}

function serializeOrderMetaRecord(order: ShopOrderRecord | null) {
  return JSON.stringify({
    deliveryDate: order?.deliveryDate?.trim() ?? '',
    comments: order?.comments?.trim() ?? '',
  })
}

function applySelectedOrderToForm(order: ShopOrderRecord | null) {
  hydratingOrderMetaForm.value = true
  actionError.value = ''
  lastHydratedOrderId.value = order?.id ?? null

  if (!order) {
    orderMetaForm.deliveryDate = getTodayDateString()
    orderMetaForm.comments = ''
    lastSavedOrderMetaSignature.value = serializeOrderMetaForm(orderMetaForm)
    hydratingOrderMetaForm.value = false
    return
  }

  orderMetaForm.deliveryDate = order.deliveryDate ?? getTodayDateString()
  orderMetaForm.comments = order.comments
  lastSavedOrderMetaSignature.value = serializeOrderMetaForm(orderMetaForm)
  hydratingOrderMetaForm.value = false
}

function clearOrderMetaSaveTimer() {
  if (!orderMetaSaveTimer) return
  clearTimeout(orderMetaSaveTimer)
  orderMetaSaveTimer = null
}

function getDeliveryDateValidationMessage(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'Choose a delivery date.'
  if (trimmed < getTodayDateString()) return 'Delivery date must be today or later.'
  return ''
}

function getActor() {
  return {
    userId: auth.currentUser?.uid ?? null,
    displayName: auth.displayName || auth.currentUser?.email || null,
  }
}

async function saveOrderMetaImmediately() {
  if (!selectedOrder.value || !canEditSelectedOrder.value) return true

  const validationMessage = getDeliveryDateValidationMessage(orderMetaForm.deliveryDate)
  if (validationMessage) {
    actionError.value = validationMessage
    actionInfo.value = ''
    return false
  }

  const nextSignature = serializeOrderMetaForm(orderMetaForm)
  if (nextSignature === lastSavedOrderMetaSignature.value) return true

  itemActionLoading.value = true
  actionError.value = ''

  try {
    await updateShopOrderRecord(
      selectedOrder.value.id,
      {
        deliveryDate: orderMetaForm.deliveryDate,
        comments: orderMetaForm.comments,
      },
      getActor(),
    )
    lastSavedOrderMetaSignature.value = nextSignature
    actionInfo.value = 'Order details saved.'
    return true
  } catch (error) {
    actionError.value = normalizeError(error, 'Failed to save order details.')
    actionInfo.value = ''
    return false
  } finally {
    itemActionLoading.value = false
  }
}

function queueOrderMetaSave() {
  if (!selectedOrder.value || !canEditSelectedOrder.value || hydratingOrderMetaForm.value) return

  const nextSignature = serializeOrderMetaForm(orderMetaForm)
  if (nextSignature === lastSavedOrderMetaSignature.value) return

  clearOrderMetaSaveTimer()
  orderMetaSaveTimer = setTimeout(() => {
    void saveOrderMetaImmediately()
  }, 450)
}

function cloneOrderItems(order: ShopOrderRecord | null = selectedOrder.value) {
  return (order?.items ?? []).map((item) => ({ ...item }))
}

async function persistOrderItems(
  orderId: string,
  nextItems: ShopOrderItemRecord[],
  successMessage: string,
) {
  if (!orderId) {
    actionError.value = 'Start an order before changing items.'
    actionInfo.value = ''
    return false
  }

  itemActionLoading.value = true
  actionError.value = ''

  try {
    await updateShopOrderRecord(orderId, { items: nextItems }, getActor())
    actionInfo.value = successMessage
    return true
  } catch (error) {
    actionError.value = normalizeError(error, 'Failed to update shop order items.')
    actionInfo.value = ''
    return false
  } finally {
    itemActionLoading.value = false
  }
}

async function createDraftOrder(successMessage?: string) {
  if (!jobId.value || !job.value) {
    actionError.value = 'Load the job first before creating a shop order.'
    actionInfo.value = ''
    return null
  }

  createOrderLoading.value = true
  actionError.value = ''

  try {
    const orderId = await createShopOrderRecord({
      jobId: jobId.value,
      jobCode: job.value.code ?? null,
      jobName: job.value.name,
      foremanUserId: auth.currentUser?.uid ?? null,
      foremanName: auth.displayName || auth.currentUser?.email || null,
      deliveryDate: getTodayDateString(),
    })

    selectedOrderId.value = orderId
    if (successMessage) {
      actionInfo.value = successMessage
    }
    return orderId
  } catch (error) {
    actionError.value = normalizeError(error, 'Failed to create a shop order.')
    actionInfo.value = ''
    return null
  } finally {
    createOrderLoading.value = false
  }
}

async function ensureDraftOrderTarget() {
  if (selectedOrder.value?.status === 'draft') {
    return {
      orderId: selectedOrder.value.id,
      items: cloneOrderItems(selectedOrder.value),
    }
  }

  const existingDraft = draftOrders.value[0] ?? null
  if (existingDraft) {
    selectedOrderId.value = existingDraft.id
    return {
      orderId: existingDraft.id,
      items: cloneOrderItems(existingDraft),
    }
  }

  const orderId = await createDraftOrder()
  if (!orderId) return null

  return {
    orderId,
    items: [] as ShopOrderItemRecord[],
  }
}

async function handleCreateOrder() {
  await createDraftOrder('New order started.')
}

async function addCatalogItemToOrder(item: ShopCatalogItemRecord) {
  const targetOrder = await ensureDraftOrderTarget()
  if (!targetOrder) return

  const quantity = readQuantity(catalogItemQuantities[item.id] ?? '1')
  const nextItems = targetOrder.items
  const existingItem = nextItems.find(
    (entry) => entry.sourceType === 'catalog' && entry.catalogItemId === item.id,
  )

  if (existingItem) {
    existingItem.quantity = (existingItem.quantity ?? 0) + quantity
  } else {
    nextItems.push({
      id: makeLocalItemId(),
      sourceType: 'catalog',
      catalogItemId: item.id,
      description: getCatalogOrderItemDescription(item),
      quantity,
      note: '',
      categoryId: item.categoryId,
      sku: item.sku,
    })
  }

  const saved = await persistOrderItems(
    targetOrder.orderId,
    nextItems,
    `${getCatalogOrderItemDescription(item)} added to the current order.`,
  )
  if (saved) {
    catalogItemQuantities[item.id] = '1'
    inspectCatalogItem(item)
  }
}

async function addCustomItemToOrder() {
  if (!customItemForm.description.trim()) {
    actionError.value = 'Enter a description for the custom item.'
    actionInfo.value = ''
    return
  }

  const targetOrder = await ensureDraftOrderTarget()
  if (!targetOrder) return

  const nextItems = targetOrder.items
  nextItems.push({
    id: makeLocalItemId(),
    sourceType: 'custom',
    catalogItemId: null,
    description: customItemForm.description.trim(),
    quantity: readQuantity(customItemForm.quantity),
    note: customItemForm.note.trim(),
    categoryId: null,
    sku: null,
  })

  const saved = await persistOrderItems(
    targetOrder.orderId,
    nextItems,
    'Custom item added to the current order.',
  )
  if (saved) {
    customItemForm.description = ''
    customItemForm.quantity = '1'
    customItemForm.note = ''
  }
}

async function updateOrderItemQuantity(orderItemId: string, rawValue: string) {
  if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

  const nextItems = cloneOrderItems(selectedOrder.value)
  const targetItem = nextItems.find((item) => item.id === orderItemId)
  if (!targetItem) return

  targetItem.quantity = readQuantity(rawValue)
  await persistOrderItems(selectedOrder.value.id, nextItems, 'Order quantity updated.')
}

async function updateOrderItemNote(orderItemId: string, rawValue: string) {
  if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

  const nextItems = cloneOrderItems(selectedOrder.value)
  const targetItem = nextItems.find((item) => item.id === orderItemId)
  if (!targetItem) return

  targetItem.note = rawValue.trim()
  await persistOrderItems(selectedOrder.value.id, nextItems, 'Order note updated.')
}

async function removeOrderItem(orderItemId: string) {
  if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

  const targetItem = selectedOrder.value.items.find((item) => item.id === orderItemId)
  if (!targetItem) return

  const confirmed = window.confirm(`Remove ${targetItem.description} from this order?`)
  if (!confirmed) return

  const nextItems = cloneOrderItems(selectedOrder.value).filter((item) => item.id !== orderItemId)
  await persistOrderItems(selectedOrder.value.id, nextItems, 'Order item removed.')
}

function selectOrder(orderId: string) {
  selectedOrderId.value = orderId
}

async function handleDeleteSelectedOrder() {
  if (!selectedOrder.value || selectedOrder.value.status !== 'draft') return

  const confirmed = window.confirm('Delete this draft shop order?')
  if (!confirmed) return

  itemActionLoading.value = true
  actionError.value = ''

  try {
    await deleteShopOrderRecord(selectedOrder.value.id)
    actionInfo.value = 'Draft order deleted.'
    selectedOrderId.value = null
  } catch (error) {
    actionError.value = normalizeError(error, 'Failed to delete draft order.')
    actionInfo.value = ''
  } finally {
    itemActionLoading.value = false
  }
}

async function handleSubmitSelectedOrder() {
  if (!selectedOrder.value || !canEditSelectedOrder.value) return

  if (selectedOrder.value.items.length === 0) {
    actionError.value = 'Add at least one item before submitting the order.'
    actionInfo.value = ''
    return
  }

  clearOrderMetaSaveTimer()
  const savedMeta = await saveOrderMetaImmediately()
  if (!savedMeta) return

  const confirmed = window.confirm('Submit this shop order? The order will become read-only.')
  if (!confirmed) return

  itemActionLoading.value = true
  actionError.value = ''

  try {
    const submittedOrderId = selectedOrder.value.id
    const submittedJobId = selectedOrder.value.jobId

    await updateShopOrderRecord(submittedOrderId, { status: 'submitted' }, getActor())
    actionInfo.value = 'Shop order submitted.'
    try {
      await sendShopOrderSubmissionEmail(submittedJobId, submittedOrderId)
    } catch (emailError) {
      actionError.value = normalizeError(emailError, 'Shop order was submitted, but the email could not be sent.')
    }
  } catch (error) {
    actionError.value = normalizeError(error, 'Failed to submit the shop order.')
    actionInfo.value = ''
  } finally {
    itemActionLoading.value = false
  }
}

function applyThursdayDelivery() {
  if (!canEditSelectedOrder.value) return
  orderMetaForm.deliveryDate = getNextThursdayDateString()
}

function stopCatalogSubscriptions() {
  unsubscribeCategories?.()
  unsubscribeCategories = null
  unsubscribeCatalogItems?.()
  unsubscribeCatalogItems = null
}

function stopOrderSubscription() {
  unsubscribeOrders?.()
  unsubscribeOrders = null
}

function syncJobSubscription() {
  if (!jobId.value) return
  jobsStore.subscribeJob(jobId.value)
}

function subscribeCatalog() {
  stopCatalogSubscriptions()
  catalogLoading.value = true
  catalogError.value = ''

  let categoriesReady = false
  let itemsReady = false

  const markCatalogReady = () => {
    if (categoriesReady && itemsReady) {
      catalogLoading.value = false
    }
  }

  try {
    unsubscribeCategories = subscribeShopCategories(
      (nextCategories) => {
        categories.value = nextCategories
        categoriesReady = true
        markCatalogReady()
      },
      (error) => {
        catalogError.value = normalizeError(error, 'Failed to load shop catalog folders.')
        catalogLoading.value = false
      },
    )

    unsubscribeCatalogItems = subscribeShopCatalogItems(
      (nextItems) => {
        catalogItems.value = nextItems
        itemsReady = true
        markCatalogReady()
      },
      (error) => {
        catalogError.value = normalizeError(error, 'Failed to load shop catalog items.')
        catalogLoading.value = false
      },
    )
  } catch (error) {
    catalogError.value = normalizeError(error, 'Failed to load shop catalog.')
    catalogLoading.value = false
  }
}

function subscribeOrders() {
  if (!jobId.value) return

  stopOrderSubscription()
  ordersLoading.value = true
  ordersError.value = ''

  try {
    unsubscribeOrders = subscribeShopOrders(
      jobId.value,
      (nextOrders) => {
        orders.value = nextOrders
        ordersLoading.value = false
      },
      (error) => {
        ordersError.value = normalizeError(error, 'Failed to load shop orders.')
        ordersLoading.value = false
      },
    )
  } catch (error) {
    ordersError.value = normalizeError(error, 'Failed to load shop orders.')
    ordersLoading.value = false
  }
}

watch(
  orders,
  (nextOrders) => {
    const selectedStillExists = selectedOrderId.value
      ? nextOrders.some((order) => order.id === selectedOrderId.value)
      : false

    if (selectedStillExists) return

    selectedOrderId.value = nextOrders[0]?.id ?? null
  },
  { immediate: true },
)

watch(
  selectedOrder,
  (order, previousOrder) => {
    if (!order) {
      applySelectedOrderToForm(null)
      return
    }

    const nextOrderId = order.id
    const previousOrderId = previousOrder?.id ?? null
    const selectionChanged = nextOrderId !== previousOrderId || nextOrderId !== lastHydratedOrderId.value

    if (selectionChanged) {
      clearOrderMetaSaveTimer()
      applySelectedOrderToForm(order)
      return
    }

    const localSignature = serializeOrderMetaForm(orderMetaForm)
    const incomingSignature = serializeOrderMetaRecord(order)
    const hasUnsavedLocalChanges = canEditSelectedOrder.value && localSignature !== lastSavedOrderMetaSignature.value

    if (hasUnsavedLocalChanges) return
    if (incomingSignature === lastSavedOrderMetaSignature.value) return

    applySelectedOrderToForm(order)
  },
  { immediate: true },
)

watch(
  orderMetaForm,
  () => {
    queueOrderMetaSave()
  },
  { deep: true },
)

watch(
  () => jobId.value,
  (nextJobId, previousJobId) => {
    if (!nextJobId || nextJobId === previousJobId) return
    syncJobSubscription()
    subscribeCatalog()
    subscribeOrders()
  },
)

watch(
  [categories, catalogItems],
  ([nextCategories]) => {
    if (treeInitialized) return
    expandedCategoryIds.value = nextCategories
      .filter((category) => category.active && category.parentId === null)
      .map((category) => category.id)
    treeInitialized = true
  },
  { immediate: true },
)

onMounted(() => {
  syncJobSubscription()
  subscribeCatalog()
  subscribeOrders()
  window.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  clearOrderMetaSaveTimer()
  stopCatalogSubscriptions()
  stopOrderSubscription()
  jobsStore.stopCurrentJobSubscription()
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <AppShell>
    <div class="shop-orders-explorer">
      <section class="shop-orders-tree-pane">
        <header class="shop-orders-pane__header shop-orders-tree-pane__header">
          <div>
            <span class="shop-orders-pane__eyebrow">Catalog Browser</span>
            <h1 class="shop-orders-pane__title">Shop Orders</h1>
          </div>
          <div class="shop-orders-tree-pane__summary">
            <span>{{ categories.filter((category) => category.active).length }} folders</span>
            <span>{{ catalogItems.filter((item) => item.active).length }} items</span>
          </div>
        </header>

        <div class="shop-orders-tree-pane__body">
          <label class="shop-orders-pane__search">
            <span>Find catalog entries</span>
            <input v-model="treeSearch" type="search" placeholder="Search folders or items" />
          </label>

          <div
            class="shop-orders-tree-pane__list"
            :class="{ 'shop-orders-tree-pane__list--collapsed': treeListCollapsed }"
          >
            <div
              class="shop-orders-tree-node shop-orders-tree-node--root"
              :class="{ 'shop-orders-tree-node--active': activeFolderId === null && !selectedCatalogItemId }"
              role="button"
              tabindex="0"
              @click="selectRoot(); toggleRootBucketExpanded()"
              @keydown.enter.prevent="selectRoot(); toggleRootBucketExpanded()"
              @contextmenu="openRootContextMenu"
            >
              <span class="shop-orders-tree-node__indent" :style="{ width: '0rem' }"></span>
              <button
                v-if="rootBucketHasChildren"
                type="button"
                class="shop-orders-tree-node__twist"
                :class="{ 'shop-orders-tree-node__twist--open': rootBucketExpanded }"
                @click.stop="toggleRootBucketExpanded"
                @keydown.enter.prevent.stop="toggleRootBucketExpanded"
                @keydown.space.prevent.stop="toggleRootBucketExpanded"
              >
                <span class="shop-orders-chevron"></span>
              </button>
              <span
                v-else
                class="shop-orders-tree-node__twist shop-orders-tree-node__twist--placeholder"
              ></span>
              <span class="shop-orders-node-icon shop-orders-node-icon--folder"></span>
              <span class="shop-orders-tree-node__label">Top Level</span>
              <span v-if="rootBucketSummary" class="shop-orders-tree-node__meta">{{ rootBucketSummary }}</span>
            </div>

            <div v-if="catalogLoading" class="shop-orders-pane__empty">
              Loading catalog...
            </div>

            <div
              v-else-if="treeNodes.length === 0 && (!rootBucketHasChildren || normalizedTreeSearch)"
              class="shop-orders-pane__empty"
            >
              No catalog entries match this view.
            </div>

            <div v-else class="shop-orders-tree">
              <div
                v-for="node in treeNodes"
                :key="node.key"
                class="shop-orders-tree-node"
                :class="{
                  'shop-orders-tree-node--item': node.kind === 'item',
                  'shop-orders-tree-node--active': node.kind === 'category'
                    ? activeFolderId === node.id && !selectedCatalogItemId
                    : selectedCatalogItemId === node.id,
                }"
                role="button"
                tabindex="0"
                @click="handleTreeNodeSelection(node)"
                @keydown.enter.prevent="handleTreeNodeSelection(node)"
                @contextmenu="openNodeContextMenu($event, node)"
              >
                <span class="shop-orders-tree-node__indent" :style="{ width: `${node.depth}rem` }"></span>
                <button
                  v-if="node.kind === 'category' && node.hasChildren"
                  type="button"
                  class="shop-orders-tree-node__twist"
                  :class="{ 'shop-orders-tree-node__twist--open': isCategoryExpanded(node.id) }"
                  @click.stop="toggleCategoryExpanded(node.id)"
                  @keydown.enter.prevent.stop="toggleCategoryExpanded(node.id)"
                  @keydown.space.prevent.stop="toggleCategoryExpanded(node.id)"
                >
                  <span class="shop-orders-chevron"></span>
                </button>
                <span
                  v-else
                  class="shop-orders-tree-node__twist shop-orders-tree-node__twist--placeholder"
                ></span>
                <span
                  :class="[
                    'shop-orders-node-icon',
                    node.kind === 'category'
                      ? 'shop-orders-node-icon--folder'
                      : 'shop-orders-node-icon--item',
                  ]"
                ></span>
                <span class="shop-orders-tree-node__label">{{ node.label }}</span>
                <span
                  v-if="node.kind === 'category' && node.secondary"
                  class="shop-orders-tree-node__meta"
                >
                  {{ node.secondary }}
                </span>

                <div
                  v-if="node.kind === 'item'"
                  class="shop-orders-tree-node__actions"
                  @click.stop
                >
                  <input
                    :value="catalogItemQuantities[node.id] ?? '1'"
                    type="number"
                    min="1"
                    step="1"
                    inputmode="numeric"
                    :disabled="orderMutationDisabled"
                    aria-label="Item quantity"
                    @input="catalogItemQuantities[node.id] = readTextInputValue($event)"
                  />
                  <button
                    type="button"
                    class="app-button app-button--primary shop-orders-tree-node__add"
                    :disabled="orderMutationDisabled"
                    aria-label="Add item to order"
                    @click.stop="handleTreeItemAdd(node.id)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section class="shop-orders-tree-card">
            <header class="shop-orders-workspace-card__header">
              <div>
                <span class="shop-orders-pane__eyebrow">Custom Item</span>
                <h3 class="shop-orders-workspace-card__title">Add Custom Item</h3>
              </div>
            </header>

            <form class="shop-orders-form__grid" @submit.prevent="addCustomItemToOrder">
              <label class="shop-orders-form__field shop-orders-form__field--full">
                <span>Description</span>
                <input
                  v-model="customItemForm.description"
                  type="text"
                  autocomplete="off"
                  :disabled="orderMutationDisabled"
                  placeholder="Describe the item to order"
                />
              </label>

              <label class="shop-orders-form__field">
                <span>Quantity</span>
                <input
                  v-model="customItemForm.quantity"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  :disabled="orderMutationDisabled"
                />
              </label>

              <label class="shop-orders-form__field">
                <span>Note</span>
                <input
                  v-model="customItemForm.note"
                  type="text"
                  autocomplete="off"
                  :disabled="orderMutationDisabled"
                  placeholder="Optional note"
                />
              </label>

              <div class="shop-orders-form__actions">
                <button
                  type="submit"
                  class="app-button app-button--primary"
                  :disabled="orderMutationDisabled"
                >
                  Add Custom Item
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>

      <div
        v-if="contextMenu.visible"
        class="shop-orders-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @pointerdown.stop
        @click.stop
        @contextmenu.prevent
      >
        <button
          v-for="action in contextMenuActions"
          :key="action.key"
          type="button"
          class="shop-orders-context-menu__item"
          :disabled="action.disabled"
          @pointerdown.stop.prevent
          @click.stop.prevent="handleContextMenuAction(action)"
        >
          {{ action.label }}
        </button>
      </div>

      <section class="shop-orders-workspace-pane">
        <header class="shop-orders-pane__header">
          <div>
            <span class="shop-orders-pane__eyebrow">Order Workspace</span>
            <h2 class="shop-orders-pane__title">
              {{ job ? `${job.code || 'No Job #'} - ${job.name}` : 'Current Job' }}
            </h2>
          </div>

          <div class="shop-orders-workspace-pane__actions">
            <button
              type="button"
              class="app-button app-button--primary"
              :disabled="createOrderLoading || !jobId || !job"
              @click="handleCreateOrder"
            >
              {{ createOrderLoading ? 'Creating...' : 'New Order' }}
            </button>
            <button
              type="button"
              class="app-button"
              :disabled="!canEditSelectedOrder || itemActionLoading || createOrderLoading"
              @click="handleSubmitSelectedOrder"
            >
              Submit Order
            </button>
          </div>
        </header>

        <div class="shop-orders-workspace-pane__body">
          <section v-if="selectedOrder" class="shop-orders-workspace-strip">
            <header class="shop-orders-workspace-strip__header shop-orders-workspace-strip__header--compact">
              <strong class="shop-orders-workspace-strip__label">{{ getOrderDisplayLabel(selectedOrder) }}</strong>

              <div class="shop-orders-workspace-strip__status">
                <span class="shop-orders-badge">{{ getOrderStatusLabel(selectedOrder) }}</span>
                <span class="shop-orders-badge">{{ orderItemCount }} items</span>
                <span class="shop-orders-badge">{{ orderTotalQuantity }} total qty</span>
              </div>
            </header>

            <div class="shop-orders-selected-order__controls">
              <label class="shop-orders-form__field shop-orders-form__field--delivery shop-orders-form__field--compact">
                <span>Delivery Date</span>
                <input
                  v-if="canEditSelectedOrder"
                  v-model="orderMetaForm.deliveryDate"
                  type="date"
                  :min="getTodayDateString()"
                  :disabled="!canEditSelectedOrder"
                />
                <div v-else class="shop-orders-readonly-value">
                  {{ selectedOrder.deliveryDate || 'No delivery date' }}
                </div>
              </label>

              <div class="shop-orders-form__field shop-orders-form__field--compact shop-orders-form__field--shortcut">
                <span>Shortcut</span>
                <button
                  v-if="canEditSelectedOrder"
                  type="button"
                  class="shop-orders-selected-order__shortcut-button"
                  :disabled="!canEditSelectedOrder"
                  @click="applyThursdayDelivery"
                >
                  Thursday Delivery
                </button>
                <div v-else class="shop-orders-readonly-value">
                  {{ isThursdayDeliveryValue(selectedOrder.deliveryDate) ? 'Thursday Delivery' : '—' }}
                </div>
              </div>

              <label class="shop-orders-form__field shop-orders-form__field--comments-inline shop-orders-form__field--compact">
                <span>Comments</span>
                <input
                  v-if="canEditSelectedOrder"
                  v-model="orderMetaForm.comments"
                  type="text"
                  :disabled="!canEditSelectedOrder"
                  placeholder="Add delivery notes or special instructions."
                />
                <div v-else class="shop-orders-readonly-value shop-orders-readonly-value--multiline">
                  {{ selectedOrder.comments || 'No comments' }}
                </div>
              </label>
            </div>

            <div class="shop-orders-selected-order__meta">
              <span>Created {{ formatOrderTimestamp(selectedOrder.createdAt) }}</span>
              <span>{{ selectedOrder.foremanName || 'Unknown owner' }}</span>
              <span v-if="selectedOrder.submittedAt">Submitted {{ formatOrderTimestamp(selectedOrder.submittedAt) }}</span>
            </div>
          </section>

          <section class="shop-orders-workspace-section shop-orders-workspace-section--items">
            <header class="shop-orders-workspace-card__header shop-orders-workspace-card__header--compact">
              <span class="shop-orders-pane__eyebrow">Added Items</span>
              <div class="shop-orders-history-summary">
                <span>{{ orderItemCount }} items</span>
                <span>{{ orderTotalQuantity }} total qty</span>
              </div>
            </header>

            <div v-if="ordersLoading && orders.length === 0" class="shop-orders-pane__empty">
              Loading orders...
            </div>

            <div v-else-if="!selectedOrder" class="shop-orders-pane__empty">
              Add a catalog item or custom item to start a new order.
            </div>

            <div v-else-if="selectedOrder.items.length === 0" class="shop-orders-pane__empty">
              Nothing has been added to this order yet. Use the catalog browser or custom item form to build it.
            </div>

            <div v-else class="shop-orders-items-list">
              <div
                class="shop-orders-items-head"
                :class="{ 'shop-orders-items-head--readonly': !canEditSelectedOrder }"
              >
                <span>Description</span>
                <span>Qty</span>
                <span>Note</span>
                <span v-if="canEditSelectedOrder"></span>
              </div>

              <article
                v-for="item in selectedOrder.items"
                :key="item.id"
                class="shop-orders-item-card shop-orders-item-card--line"
                :class="{ 'shop-orders-item-card--readonly': !canEditSelectedOrder }"
              >
                <div class="shop-orders-item-card__main">
                  <strong class="shop-orders-item-card__name">{{ getOrderItemDisplayName(item) }}</strong>
                  <span
                    v-if="item.sourceType !== 'catalog' || item.sku"
                    class="shop-orders-item-card__meta"
                  >
                    <template v-if="item.sourceType !== 'catalog'">Custom</template>
                    <template v-if="item.sourceType !== 'catalog' && item.sku"> · </template>
                    <template v-if="item.sku">SKU {{ item.sku }}</template>
                  </span>
                </div>

                <input
                  v-if="canEditSelectedOrder"
                  class="shop-orders-item-card__qty-input"
                  :value="String(item.quantity ?? 1)"
                  type="number"
                  min="1"
                  step="1"
                  inputmode="numeric"
                  aria-label="Quantity"
                  :disabled="!canEditSelectedOrder"
                  @change="updateOrderItemQuantity(item.id, readTextInputValue($event))"
                />
                <div v-else class="shop-orders-readonly-value shop-orders-readonly-value--centered">
                  {{ item.quantity ?? 1 }}
                </div>

                <input
                  v-if="canEditSelectedOrder"
                  class="shop-orders-item-card__note-input"
                  :value="item.note"
                  type="text"
                  autocomplete="off"
                  aria-label="Note"
                  :disabled="!canEditSelectedOrder"
                  placeholder="Optional note"
                  @change="updateOrderItemNote(item.id, readTextInputValue($event))"
                />
                <div v-else class="shop-orders-readonly-value shop-orders-readonly-value--multiline">
                  {{ item.note || '—' }}
                </div>

                <button
                  v-if="canEditSelectedOrder"
                  type="button"
                  class="app-button shop-orders-item-card__danger"
                  aria-label="Remove item"
                  title="Remove item"
                  :disabled="!canEditSelectedOrder || itemActionLoading"
                  @click="removeOrderItem(item.id)"
                >
                  X
                </button>
              </article>
            </div>
          </section>

          <section class="shop-orders-workspace-section shop-orders-workspace-section--history">
            <header class="shop-orders-workspace-card__header shop-orders-workspace-card__header--compact">
              <span class="shop-orders-pane__eyebrow">Order History</span>
              <div class="shop-orders-workspace-section__header-meta">
                <div class="shop-orders-history-summary">
                  <span>{{ draftOrders.length }} draft</span>
                  <span>{{ submittedOrders.length }} submitted</span>
                </div>
                <button
                  v-if="selectedOrder?.status === 'draft'"
                  type="button"
                  class="app-button shop-orders-item-card__danger"
                  aria-label="Delete draft"
                  title="Delete draft"
                  :disabled="itemActionLoading"
                  @click="handleDeleteSelectedOrder"
                >
                  Delete Draft
                </button>
              </div>
            </header>

            <div v-if="orders.length === 0" class="shop-orders-pane__empty shop-orders-pane__empty--compact">
              No shop orders exist for this job yet.
            </div>

            <div v-else class="shop-orders-history-list">
              <button
                v-for="order in orders"
                :key="order.id"
                type="button"
                class="shop-orders-history-row"
                :class="{ 'shop-orders-history-row--active': selectedOrderId === order.id }"
                @click="selectOrder(order.id)"
              >
                <div class="shop-orders-history-row__main">
                  <strong>{{ getOrderDisplayLabel(order) }}</strong>
                  <div class="shop-orders-history-row__meta">
                    <span>{{ formatOrderTimestamp(order.submittedAt || order.updatedAt || order.createdAt) }}</span>
                    <span>{{ order.items.length }} items</span>
                    <span>{{ order.deliveryDate || 'No delivery date' }}</span>
                  </div>
                </div>
                <span class="shop-orders-badge">{{ getOrderStatusLabel(order) }}</span>
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.shop-orders-explorer {
  --shop-line: rgba(140, 162, 186, 0.12);
  --shop-line-soft: rgba(140, 162, 186, 0.05);
  --shop-surface: rgba(255, 255, 255, 0.012);
  --shop-surface-soft: rgba(255, 255, 255, 0.02);
  --shop-field: rgba(255, 255, 255, 0.03);
  --shop-radius-md: 10px;
  --shop-radius-lg: 12px;
  --shop-control-height: 2rem;
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1.1fr);
  gap: 0.9rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.shop-orders-tree-pane,
.shop-orders-workspace-pane {
  display: grid;
  gap: 0.65rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 0.9rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.005)),
    rgba(27, 35, 45, 0.9);
  box-shadow: 0 14px 28px rgba(7, 12, 18, 0.16);
  grid-template-rows: auto minmax(0, 1fr);
}

.shop-orders-tree-pane__body,
.shop-orders-workspace-pane__body {
  display: grid;
  gap: 0.6rem;
  min-height: 0;
  align-content: start;
}

.shop-orders-tree-pane__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.shop-orders-workspace-pane__body {
  overflow: auto;
  padding-right: 0.15rem;
}

.shop-orders-pane__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-orders-tree-pane__header {
  align-items: center;
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
}

.shop-orders-tree-pane__summary,
.shop-orders-history-summary,
.shop-orders-browser-card__subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem 0.55rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-pane__search,
.shop-orders-form__field {
  display: grid;
  gap: 0.28rem;
  color: var(--text-muted);
}

.shop-orders-pane__search > span,
.shop-orders-form__field > span {
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-pane__search input,
.shop-orders-form__field input,
.shop-orders-form__field textarea,
.shop-orders-tree-node__actions input,
.shop-orders-browser-entry__actions input,
.shop-orders-inline-field input {
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--shop-radius-md);
  background: var(--shop-field);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.shop-orders-form__field textarea {
  min-height: 8rem;
  padding: 0.75rem 0.85rem;
  resize: vertical;
}

.shop-orders-form__field--delivery {
  align-content: start;
}

.shop-orders-form__field--compact {
  gap: 0.3rem;
}

.shop-orders-form__field--comments-inline input {
  min-height: 2rem;
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

.shop-orders-tree-pane__list,
.shop-orders-browser-list,
.shop-orders-items-list,
.shop-orders-history-list {
  display: grid;
  gap: 0;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.shop-orders-tree-pane__list {
  flex: 1 1 auto;
  align-content: start;
}

.shop-orders-tree-pane__list--collapsed {
  flex: 0 0 auto;
  overflow: visible;
}

.shop-orders-tree {
  display: grid;
  gap: 0.08rem;
}

.shop-orders-tree__row {
  display: grid;
}

.shop-orders-tree-node {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 2.25rem;
  padding: 0 0.5rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.shop-orders-tree-node:hover,
.shop-orders-tree-node--active {
  border-color: rgba(88, 186, 233, 0.16);
  background: rgba(30, 73, 97, 0.16);
}

.shop-orders-tree-node__indent {
  flex: 0 0 auto;
  width: 0;
}

.shop-orders-tree-node__twist {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-soft);
  padding: 0;
}

.shop-orders-tree-node__twist--placeholder {
  opacity: 0;
  pointer-events: none;
}

.shop-orders-chevron {
  width: 0.45rem;
  height: 0.45rem;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.18s ease;
}

.shop-orders-tree-node__twist--open .shop-orders-chevron {
  transform: rotate(45deg);
}

.shop-orders-node-icon {
  position: relative;
  display: inline-flex;
  width: 0.95rem;
  height: 0.8rem;
  flex: 0 0 auto;
}

.shop-orders-node-icon--folder::before,
.shop-orders-node-icon--folder::after,
.shop-orders-node-icon--item::before {
  content: "";
  position: absolute;
  box-sizing: border-box;
}

.shop-orders-node-icon--folder::before {
  left: 0;
  top: 0.18rem;
  width: 0.95rem;
  height: 0.58rem;
  border: 1px solid rgba(123, 197, 241, 0.55);
  border-radius: 0.18rem;
  background: rgba(50, 108, 145, 0.18);
}

.shop-orders-node-icon--folder::after {
  left: 0.08rem;
  top: 0;
  width: 0.38rem;
  height: 0.24rem;
  border: 1px solid rgba(123, 197, 241, 0.55);
  border-bottom: none;
  border-radius: 0.18rem 0.18rem 0 0;
  background: rgba(50, 108, 145, 0.18);
}

.shop-orders-node-icon--item::before {
  left: 0.08rem;
  top: 0.02rem;
  width: 0.72rem;
  height: 0.76rem;
  border: 1px solid rgba(193, 208, 225, 0.36);
  border-radius: 0.12rem;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 -0.16rem 0 rgba(88, 186, 233, 0.1);
}

.shop-orders-tree-node__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
}

.shop-orders-tree-node--root .shop-orders-tree-node__label {
  font-weight: 700;
}

.shop-orders-tree-node__meta {
  flex: 0 0 auto;
  color: var(--text-soft);
  font-size: 0.78rem;
  white-space: nowrap;
}

.shop-orders-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-badge {
  border: 1px solid rgba(88, 186, 233, 0.22);
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
}

.shop-orders-tree-node--item {
  min-height: 2.8rem;
}

.shop-orders-tree-node__actions {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin-left: auto;
  flex: 0 0 auto;
}

.shop-orders-tree-node__actions input {
  width: 4rem;
  min-height: var(--shop-control-height);
  padding: 0 0.65rem;
}

.shop-orders-tree-node__add {
  min-width: 2.3rem;
  min-height: var(--shop-control-height);
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
}

.shop-orders-context-menu {
  position: fixed;
  z-index: 30;
  display: grid;
  gap: 0.2rem;
  min-width: 13rem;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(36, 46, 58, 0.98), rgba(26, 33, 43, 0.98)),
    rgba(18, 24, 33, 0.96);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
}

.shop-orders-context-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.25rem;
  padding: 0.5rem 0.7rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.shop-orders-context-menu__item:hover:not(:disabled) {
  background: rgba(88, 186, 233, 0.14);
}

.shop-orders-context-menu__item:disabled {
  opacity: 0.45;
  cursor: default;
}

.shop-orders-tree-card,
.shop-orders-browser-card,
.shop-orders-workspace-card,
.shop-orders-meta-card,
.shop-orders-quick-actions {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem 0.8rem;
  border: 1px solid var(--shop-line-soft);
  border-radius: var(--shop-radius-lg);
  background: var(--shop-surface);
}

.shop-orders-tree-card {
  align-content: start;
  gap: 0.45rem;
  padding: 0.55rem 0 0;
  border: 0;
  border-top: 1px solid var(--shop-line-soft);
  border-radius: 0;
  background: transparent;
}

.shop-orders-browser-card__header,
.shop-orders-workspace-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.shop-orders-browser-card__title,
.shop-orders-workspace-card__title {
  margin: 0.12rem 0 0;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.shop-orders-browser-entry,
.shop-orders-item-card,
.shop-orders-history-row {
  display: grid;
  gap: 0.4rem;
  width: 100%;
  padding: 0.58rem 0.7rem;
  border: 1px solid var(--shop-line-soft);
  border-radius: var(--shop-radius-md);
  background: var(--shop-surface);
  color: var(--text);
  text-align: left;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.shop-orders-browser-entry {
  cursor: pointer;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.shop-orders-history-row {
  cursor: pointer;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.shop-orders-browser-entry:hover,
.shop-orders-browser-entry--active,
.shop-orders-history-row:hover,
.shop-orders-history-row--active {
  border-color: rgba(88, 186, 233, 0.14);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.18), rgba(33, 49, 62, 0.12)),
    var(--shop-surface-soft);
  transform: translateY(-0.5px);
}

.shop-orders-browser-entry__main,
.shop-orders-item-card__main,
.shop-orders-history-row__main,
.shop-orders-meta-card {
  display: grid;
  gap: 0.2rem;
}

.shop-orders-browser-entry__main span,
.shop-orders-item-card__main span,
.shop-orders-history-row__main span,
.shop-orders-meta-card span,
.shop-orders-quick-actions span,
.shop-orders-pane__empty,
.shop-orders-pane__note,
.shop-orders-browser-entry__meta {
  color: var(--text-muted);
}

.shop-orders-history-row__main strong,
.shop-orders-item-card__main strong,
.shop-orders-browser-entry__main strong {
  font-weight: 600;
}

.shop-orders-browser-entry__actions,
.shop-orders-workspace-pane__actions,
.shop-orders-form__actions,
.shop-orders-workspace-card__status,
.shop-orders-item-card__fields,
.shop-orders-workspace-card__actions,
.shop-orders-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.shop-orders-browser-entry__actions {
  align-items: center;
}

.shop-orders-browser-entry__actions input {
  width: 4.8rem;
  min-height: 2.3rem;
}

.shop-orders-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.shop-orders-form__grid--selected-order {
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr) minmax(0, 0.95fr);
  gap: 0.75rem;
  align-items: start;
}

.shop-orders-form__field--full {
  grid-column: 1 / -1;
}

.shop-orders-quick-actions,
.shop-orders-meta-card {
  align-content: start;
}

.shop-orders-workspace-card--selected {
  gap: 0.4rem;
  padding: 0.68rem 0.75rem;
}

.shop-orders-workspace-strip {
  display: grid;
  gap: 0.32rem;
  padding: 0 0 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-orders-workspace-strip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
}

.shop-orders-workspace-strip__header--compact {
  min-height: 1.4rem;
}

.shop-orders-workspace-strip__label {
  line-height: 1.2;
  font-size: 0.94rem;
  font-weight: 600;
}

.shop-orders-workspace-strip__status {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.shop-orders-selected-order__controls {
  display: grid;
  grid-template-columns: minmax(10.5rem, 11.5rem) minmax(10rem, 11rem) minmax(18rem, 1fr);
  gap: 0.55rem;
  align-items: center;
}

.shop-orders-form__field--shortcut {
  display: grid;
  gap: 0.28rem;
  align-content: start;
}

.shop-orders-form__field--shortcut > span,
.shop-orders-selected-order__meta span {
  color: var(--text-muted);
}

.shop-orders-selected-order__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.18rem 0.7rem;
  padding: 0.12rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
}

.shop-orders-selected-order__meta span {
  font-size: 0.74rem;
  line-height: 1.18;
  letter-spacing: 0.02em;
}

.shop-orders-selected-order__shortcut-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.8rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--shop-radius-md);
  background: var(--shop-field);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
  font-weight: 500;
  font-size: 0.95rem;
  line-height: 1;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.shop-orders-selected-order__shortcut-button:hover:not(:disabled) {
  border-color: rgba(88, 186, 233, 0.18);
  background: var(--shop-surface-soft);
  transform: none;
}

.shop-orders-selected-order__shortcut-button:disabled {
  opacity: 0.65;
}

.shop-orders-workspace-section {
  display: grid;
  gap: 0.14rem;
  padding: 0.4rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
}

.shop-orders-workspace-section .shop-orders-workspace-card__header {
  padding-bottom: 0;
}

.shop-orders-workspace-card__header--compact {
  align-items: center;
}

.shop-orders-workspace-section--history .shop-orders-workspace-card__header {
  align-items: center;
}

.shop-orders-workspace-section__header-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem 0.55rem;
}

.shop-orders-items-head {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) 4.5rem minmax(12rem, 1fr) 2.8rem;
  align-items: center;
  gap: 0.34rem;
  padding: 0 0.2rem 0.22rem;
  border-bottom: 1px solid var(--shop-line-soft);
  color: var(--text-soft);
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-items-head--readonly {
  grid-template-columns: minmax(0, 1.45fr) 4.5rem minmax(12rem, 1fr);
}

.shop-orders-items-head span:nth-child(2),
.shop-orders-items-head span:nth-child(4) {
  text-align: center;
}

.shop-orders-item-card {
  gap: 0.18rem;
  padding: 0.38rem 0.2rem;
}

.shop-orders-item-card--line {
  grid-template-columns: minmax(0, 1.45fr) 4.5rem minmax(12rem, 1fr) 2.8rem;
  align-items: center;
  gap: 0.34rem;
  border: 0;
  border-bottom: 1px solid rgba(140, 162, 186, 0.05);
  border-radius: 0;
  background: transparent;
}

.shop-orders-item-card--readonly {
  grid-template-columns: minmax(0, 1.45fr) 4.5rem minmax(12rem, 1fr);
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
  font-size: 0.9rem;
}

.shop-orders-item-card__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-orders-item-card__meta {
  font-size: 0.7rem;
  white-space: nowrap;
  flex: 0 0 auto;
  opacity: 0.82;
}

.shop-orders-item-card__qty-input,
.shop-orders-item-card__note-input {
  width: 100%;
  min-height: var(--shop-control-height);
  padding: 0 0.65rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--shop-radius-md);
  background: var(--shop-field);
  color: var(--text);
}

.shop-orders-item-card__qty-input {
  text-align: center;
}

.shop-orders-item-card__danger {
  min-height: var(--shop-control-height);
  padding: 0 0.72rem;
  border-radius: var(--shop-radius-md);
  font-size: 0.92rem;
}

.shop-orders-item-card__danger {
  border-color: rgba(255, 125, 107, 0.18);
  color: var(--danger);
}

.shop-orders-pane__note {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

.shop-orders-pane__note--error {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.shop-orders-pane__note--success {
  border-color: rgba(103, 213, 157, 0.24);
  color: var(--success);
}

.shop-orders-pane__empty {
  display: grid;
  place-content: center;
  min-height: 8.5rem;
  padding: 0.85rem;
  border: 1px dashed rgba(140, 162, 186, 0.1);
  border-radius: 12px;
  text-align: center;
}

.shop-orders-pane__empty--compact {
  min-height: 6rem;
}

.shop-orders-history-list {
  gap: 0;
  padding-right: 0;
  border-top: 1px solid var(--shop-line-soft);
}

.shop-orders-history-row {
  gap: 0.4rem;
  padding: 0.5rem 0.2rem;
  border: 0;
  border-bottom: 1px solid var(--shop-line-soft);
  border-radius: 0;
  background: transparent;
}

.shop-orders-history-row:hover,
.shop-orders-history-row--active {
  border-color: rgba(140, 162, 186, 0.06);
  background: rgba(255, 255, 255, 0.02);
  transform: none;
}

.shop-orders-history-row__main {
  gap: 0.12rem;
}

.shop-orders-history-row__main strong {
  font-size: 0.88rem;
}

.shop-orders-history-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.14rem 0.65rem;
}

.shop-orders-history-row__meta span {
  font-size: 0.76rem;
}

@media (max-width: 1440px) {
  .shop-orders-explorer {
    grid-template-columns: minmax(360px, 1fr) minmax(380px, 1fr);
  }
}

@media (max-width: 1180px) {
  .shop-orders-explorer {
    grid-template-columns: 1fr;
  }

  .shop-orders-tree-pane {
    max-height: 34rem;
  }
}

@media (max-width: 820px) {
  .shop-orders-form__grid {
    grid-template-columns: 1fr;
  }

  .shop-orders-items-head,
  .shop-orders-selected-order__controls,
  .shop-orders-item-card--line {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .shop-orders-history-row__meta {
    gap: 0.12rem;
  }

  .shop-orders-selected-order__meta {
    gap: 0.12rem 0.45rem;
  }

  .shop-orders-pane__header,
  .shop-orders-browser-card__header,
  .shop-orders-workspace-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .shop-orders-browser-entry,
  .shop-orders-history-row {
    grid-template-columns: 1fr;
  }

  .shop-orders-browser-entry__actions {
    width: 100%;
  }

  .shop-orders-browser-entry__actions input {
    width: 100%;
  }
}
</style>
