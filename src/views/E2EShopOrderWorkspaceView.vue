<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type {
  ShopCatalogItemRecord,
  ShopCategoryRecord,
  ShopOrderItemRecord,
  ShopOrderRecord,
} from '@/types/domain'

type TreeNode =
  | {
      key: `category:${string}`
      kind: 'category'
      id: string
      parentId: string | null
      depth: number
      label: string
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

type ContextMenuTarget =
  | { kind: 'root' }
  | { kind: 'category'; id: string }

interface OrderMetaFormState {
  deliveryDate: string
  comments: string
}

const categories = ref<ShopCategoryRecord[]>([
  { id: 'cat-drywall', name: 'Drywall Mud', parentId: null, active: true },
  { id: 'cat-all-purpose', name: 'All Purpose Mud', parentId: 'cat-drywall', active: true },
  { id: 'cat-anchors', name: 'Anchors', parentId: null, active: true },
  { id: 'cat-concrete-wedge', name: 'Concrete Wedge Anchors', parentId: 'cat-anchors', active: true },
])

const catalogItems = ref<ShopCatalogItemRecord[]>([
  { id: 'item-box', description: 'Box', categoryId: 'cat-all-purpose', sku: null, price: null, active: true },
  { id: 'item-bucket', description: 'Bucket', categoryId: 'cat-all-purpose', sku: null, price: null, active: true },
  { id: 'item-half-inch', description: '1/2"', categoryId: 'cat-concrete-wedge', sku: null, price: null, active: true },
])

const rootBucketExpanded = ref(true)
const expandedCategoryIds = ref<string[]>(['cat-drywall', 'cat-all-purpose', 'cat-anchors', 'cat-concrete-wedge'])
const selectedCatalogItemId = ref<string | null>(null)
const catalogItemQuantities = reactive<Record<string, string>>({
  'item-box': '1',
  'item-bucket': '1',
  'item-half-inch': '1',
})
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  target: { kind: 'root' } as ContextMenuTarget,
})

const orderMetaForm = reactive<OrderMetaFormState>({
  deliveryDate: '2026-05-01',
  comments: '',
})

const selectedOrder = ref<ShopOrderRecord>({
  id: 'order-e2e-1',
  jobId: 'job-e2e',
  jobCode: '1A',
  jobName: 'Phase 2 Company Acoustical remodel',
  deliveryDate: '2026-05-01',
  status: 'draft',
  comments: '',
  foremanUserId: 'foreman-e2e',
  foremanName: 'Chris (CJ) Larsen',
  items: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const hydratingOrderMetaForm = ref(false)
const lastHydratedOrderId = ref<string | null>(null)
const lastSavedOrderMetaSignature = ref('')
const saveTick = ref(0)

let orderMetaSaveTimer: ReturnType<typeof setTimeout> | null = null

const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))

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

const treeNodes = computed<TreeNode[]>(() => {
  if (!rootBucketExpanded.value) return []
  return buildTreeNodes(null, 1)
})

const canEditSelectedOrder = computed(() => selectedOrder.value?.status === 'draft')
const orderItemCount = computed(() => selectedOrder.value.items.length)
const orderTotalQuantity = computed(() =>
  selectedOrder.value.items.reduce((sum, item) => sum + (item.quantity ?? 0), 0),
)

const contextMenuActions = computed(() => {
  const visibleCategoryIds = getVisibleCategoryIds()
  const hasVisibleCategories = visibleCategoryIds.length > 0
  const allVisibleCategoriesExpanded = rootBucketExpanded.value
    && (!hasVisibleCategories || visibleCategoryIds.every((categoryId) => expandedCategoryIds.value.includes(categoryId)))
  const anyFoldersExpanded = rootBucketExpanded.value || expandedCategoryIds.value.length > 0

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
})

function getCategoryDisplayName(category: Pick<ShopCategoryRecord, 'name'>) {
  return category.name.trim() || 'Untitled Folder'
}

function getItemDisplayName(item: Pick<ShopCatalogItemRecord, 'description'>) {
  return item.description.trim() || 'Untitled Item'
}

function serializeOrderMetaForm(form: OrderMetaFormState) {
  return JSON.stringify({
    deliveryDate: form.deliveryDate.trim(),
    comments: form.comments.trim(),
  })
}

function serializeOrderMetaRecord(order: ShopOrderRecord) {
  return JSON.stringify({
    deliveryDate: (order.deliveryDate ?? '').trim(),
    comments: order.comments.trim(),
  })
}

function applySelectedOrderToForm(order: ShopOrderRecord | null) {
  hydratingOrderMetaForm.value = true
  lastHydratedOrderId.value = order?.id ?? null

  if (!order) {
    orderMetaForm.deliveryDate = '2026-05-01'
    orderMetaForm.comments = ''
    lastSavedOrderMetaSignature.value = serializeOrderMetaForm(orderMetaForm)
    hydratingOrderMetaForm.value = false
    return
  }

  orderMetaForm.deliveryDate = order.deliveryDate ?? '2026-05-01'
  orderMetaForm.comments = order.comments
  lastSavedOrderMetaSignature.value = serializeOrderMetaForm(orderMetaForm)
  hydratingOrderMetaForm.value = false
}

function clearOrderMetaSaveTimer() {
  if (!orderMetaSaveTimer) return
  clearTimeout(orderMetaSaveTimer)
  orderMetaSaveTimer = null
}

async function saveOrderMetaImmediately() {
  if (!selectedOrder.value || !canEditSelectedOrder.value) return true

  const nextSignature = serializeOrderMetaForm(orderMetaForm)
  if (nextSignature === lastSavedOrderMetaSignature.value) return true

  await new Promise((resolve) => setTimeout(resolve, 40))
  selectedOrder.value = {
    ...selectedOrder.value,
    deliveryDate: orderMetaForm.deliveryDate,
    comments: orderMetaForm.comments,
    updatedAt: Date.now(),
  }
  lastSavedOrderMetaSignature.value = nextSignature
  saveTick.value += 1
  return true
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

function openRootContextMenu(event: MouseEvent) {
  contextMenu.target = { kind: 'root' }
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.visible = true
}

function closeContextMenu() {
  contextMenu.visible = false
}

function handleContextMenuAction(action: { run: () => void | Promise<void> }) {
  void action.run()
}

function categoryHasChildren(categoryId: string) {
  return Boolean((childCategoriesByParent.value.get(categoryId)?.length ?? 0) > 0 || (childItemsByParent.value.get(categoryId)?.length ?? 0) > 0)
}

function isCategoryExpanded(categoryId: string) {
  return expandedCategoryIds.value.includes(categoryId)
}

function toggleCategoryExpanded(categoryId: string) {
  if (!categoryHasChildren(categoryId)) return

  if (expandedCategoryIds.value.includes(categoryId)) {
    expandedCategoryIds.value = expandedCategoryIds.value.filter((entry) => entry !== categoryId)
  } else {
    expandedCategoryIds.value = [...expandedCategoryIds.value, categoryId]
  }
}

function buildTreeNodes(parentId: string | null, depth: number): TreeNode[] {
  const nodes: TreeNode[] = []
  const childCategories = childCategoriesByParent.value.get(parentId) ?? []
  const childItems = childItemsByParent.value.get(parentId) ?? []

  for (const category of childCategories) {
    const hasChildren = categoryHasChildren(category.id)
    nodes.push({
      key: `category:${category.id}`,
      kind: 'category',
      id: category.id,
      parentId,
      depth,
      label: getCategoryDisplayName(category),
      hasChildren,
    })

    if (isCategoryExpanded(category.id)) {
      nodes.push(...buildTreeNodes(category.id, depth + 1))
    }
  }

  for (const item of childItems) {
    nodes.push({
      key: `item:${item.id}`,
      kind: 'item',
      id: item.id,
      parentId,
      depth,
      label: getItemDisplayName(item),
    })
  }

  return nodes
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

function readQuantity(rawValue: string) {
  const parsed = Number.parseFloat(rawValue)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.round(parsed)
}

function handleAddCatalogItem(itemId: string) {
  const item = catalogItems.value.find((entry) => entry.id === itemId)
  if (!item || !selectedOrder.value || !canEditSelectedOrder.value) return

  const quantity = readQuantity(catalogItemQuantities[item.id] ?? '1')

  selectedOrder.value = {
    ...selectedOrder.value,
    items: [
      ...selectedOrder.value.items,
      {
        id: `order-item-${selectedOrder.value.items.length + 1}`,
        sourceType: 'catalog',
        catalogItemId: item.id,
        description: getCatalogOrderItemDescription(item),
        quantity,
        note: '',
        categoryId: item.categoryId,
        sku: item.sku,
      },
    ],
    updatedAt: Date.now(),
  }
}

function applyThursdayDelivery() {
  orderMetaForm.deliveryDate = '2026-05-07'
}

function updateOrderItemNote(orderItemId: string, rawValue: string) {
  if (!selectedOrder.value || !canEditSelectedOrder.value) return

  selectedOrder.value = {
    ...selectedOrder.value,
    items: selectedOrder.value.items.map((item) => (
      item.id === orderItemId ? { ...item, note: rawValue.trim() } : item
    )),
    updatedAt: Date.now(),
  }
}

function updateOrderItemQuantity(orderItemId: string, rawValue: string) {
  if (!selectedOrder.value || !canEditSelectedOrder.value) return

  selectedOrder.value = {
    ...selectedOrder.value,
    items: selectedOrder.value.items.map((item) => (
      item.id === orderItemId ? { ...item, quantity: readQuantity(rawValue) } : item
    )),
    updatedAt: Date.now(),
  }
}

function removeOrderItem(orderItemId: string) {
  if (!selectedOrder.value || !canEditSelectedOrder.value) return

  selectedOrder.value = {
    ...selectedOrder.value,
    items: selectedOrder.value.items.filter((item) => item.id !== orderItemId),
    updatedAt: Date.now(),
  }
}

function submitOrder() {
  if (!selectedOrder.value) return

  selectedOrder.value = {
    ...selectedOrder.value,
    status: 'submitted',
    submittedAt: Date.now(),
    updatedAt: Date.now(),
  }
}

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
</script>

<template>
  <main class="e2e-shop-order-page" data-testid="e2e-shop-order-page" @click="closeContextMenu">
    <section class="e2e-shop-order-browser">
      <header class="e2e-shop-order-header">
        <h1>Catalog Browser</h1>
        <div data-testid="shoporder-save-count">{{ saveTick }}</div>
      </header>

      <button
        type="button"
        class="e2e-shop-order-root"
        data-testid="shoporder-root-row"
        @contextmenu.prevent.stop="openRootContextMenu"
      >
        <span data-testid="shoporder-root-toggle">{{ rootBucketExpanded ? 'expanded' : 'collapsed' }}</span>
        <strong>Top Level</strong>
      </button>

      <div v-if="rootBucketExpanded" class="e2e-shop-order-tree" data-testid="shoporder-tree">
        <div
          v-for="node in treeNodes"
          :key="node.key"
          class="e2e-shop-order-node"
          :style="{ paddingLeft: `${node.depth * 1.25}rem` }"
          :data-testid="node.kind === 'category' ? `shoporder-category-${node.id}` : `shoporder-item-${node.id}`"
        >
          <template v-if="node.kind === 'category'">
            <button
              type="button"
              class="e2e-shop-order-category"
              @click.stop="toggleCategoryExpanded(node.id)"
              @contextmenu.prevent.stop="contextMenu.target = { kind: 'category', id: node.id }; contextMenu.visible = true; contextMenu.x = 0; contextMenu.y = 0"
            >
              <span>{{ isCategoryExpanded(node.id) ? '▾' : '▸' }}</span>
              <span>{{ node.label }}</span>
            </button>
          </template>

          <template v-else>
            <div class="e2e-shop-order-item">
              <span>{{ node.label }}</span>
              <input
                v-model="catalogItemQuantities[node.id]"
                :data-testid="`shoporder-quantity-${node.id}`"
                type="number"
                min="1"
              />
              <button
                type="button"
                :data-testid="`shoporder-add-${node.id}`"
                @click.stop="handleAddCatalogItem(node.id)"
              >
                +
              </button>
            </div>
          </template>
        </div>
      </div>

      <div
        v-if="contextMenu.visible"
        class="e2e-shop-order-context-menu"
        data-testid="shoporder-context-menu"
        @pointerdown.stop
        @click.stop
      >
        <button
          v-for="action in contextMenuActions"
          :key="action.key"
          type="button"
          :disabled="action.disabled"
          :data-testid="`shoporder-context-${action.key}`"
          @click.stop.prevent="handleContextMenuAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
    </section>

    <section class="e2e-shop-order-workspace">
      <header class="e2e-shop-order-header">
        <h2 data-testid="shoporder-order-label">{{ selectedOrder.jobCode }} - {{ selectedOrder.jobName }}</h2>
        <button
          type="button"
          data-testid="shoporder-submit"
          :disabled="!canEditSelectedOrder || selectedOrder.items.length === 0"
          @click="submitOrder"
        >
          Submit Order
        </button>
      </header>

      <div class="e2e-shop-order-strip">
        <label>
          <span>Delivery Date</span>
          <input
            v-if="canEditSelectedOrder"
            v-model="orderMetaForm.deliveryDate"
            data-testid="shoporder-delivery-date"
            type="date"
          />
          <div v-else data-testid="shoporder-delivery-date-readonly">{{ selectedOrder.deliveryDate }}</div>
        </label>

        <div>
          <span>Shortcut</span>
          <button
            v-if="canEditSelectedOrder"
            type="button"
            data-testid="shoporder-shortcut"
            @click="applyThursdayDelivery"
          >
            Thursday Delivery
          </button>
          <div v-else data-testid="shoporder-shortcut-readonly">
            {{ selectedOrder.deliveryDate === '2026-05-07' ? 'Thursday Delivery' : '—' }}
          </div>
        </div>

        <label>
          <span>Comments</span>
          <input
            v-if="canEditSelectedOrder"
            v-model="orderMetaForm.comments"
            data-testid="shoporder-comments"
            type="text"
            placeholder="Add delivery notes or special instructions."
          />
          <div v-else data-testid="shoporder-comments-readonly">{{ selectedOrder.comments || 'No comments' }}</div>
        </label>
      </div>

      <section class="e2e-shop-order-items">
        <header class="e2e-shop-order-items__head">
          <span>Description</span>
          <span>Qty</span>
          <span>Note</span>
          <span v-if="canEditSelectedOrder"></span>
        </header>

        <div v-if="selectedOrder.items.length === 0" data-testid="shoporder-empty">No items yet.</div>

        <article
          v-for="item in selectedOrder.items"
          :key="item.id"
          class="e2e-shop-order-item-row"
          :data-testid="`shoporder-order-item-${item.id}`"
        >
          <strong>{{ getOrderItemDisplayName(item) }}</strong>

          <input
            v-if="canEditSelectedOrder"
            :value="String(item.quantity ?? 1)"
            :data-testid="`shoporder-order-item-qty-${item.id}`"
            type="number"
            min="1"
            @change="updateOrderItemQuantity(item.id, ($event.target as HTMLInputElement).value)"
          />
          <div v-else :data-testid="`shoporder-order-item-qty-readonly-${item.id}`">{{ item.quantity ?? 1 }}</div>

          <input
            v-if="canEditSelectedOrder"
            :value="item.note"
            :data-testid="`shoporder-order-item-note-${item.id}`"
            type="text"
            placeholder="Optional note"
            @change="updateOrderItemNote(item.id, ($event.target as HTMLInputElement).value)"
          />
          <div v-else :data-testid="`shoporder-order-item-note-readonly-${item.id}`">{{ item.note || '—' }}</div>

          <button
            v-if="canEditSelectedOrder"
            type="button"
            :data-testid="`shoporder-order-item-remove-${item.id}`"
            @click="removeOrderItem(item.id)"
          >
            X
          </button>
        </article>
      </section>
    </section>
  </main>
</template>

<style scoped>
.e2e-shop-order-page {
  display: grid;
  grid-template-columns: minmax(18rem, 28rem) minmax(20rem, 1fr);
  gap: 1rem;
  padding: 1rem;
}

.e2e-shop-order-browser,
.e2e-shop-order-workspace {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.e2e-shop-order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.e2e-shop-order-root,
.e2e-shop-order-category,
.e2e-shop-order-item,
.e2e-shop-order-strip,
.e2e-shop-order-items,
.e2e-shop-order-item-row {
  border: 1px solid #bbb;
}

.e2e-shop-order-root {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: 100%;
  padding: 0.5rem;
  text-align: left;
  background: white;
}

.e2e-shop-order-tree {
  display: grid;
  gap: 0.25rem;
}

.e2e-shop-order-node {
  display: grid;
  gap: 0.25rem;
}

.e2e-shop-order-category,
.e2e-shop-order-item {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.375rem 0.5rem;
  background: white;
}

.e2e-shop-order-item input {
  width: 4rem;
}

.e2e-shop-order-context-menu {
  display: grid;
  gap: 0.25rem;
  width: 14rem;
  padding: 0.5rem;
  border: 1px solid #bbb;
  background: white;
}

.e2e-shop-order-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 0.75rem;
}

.e2e-shop-order-strip label,
.e2e-shop-order-strip > div {
  display: grid;
  gap: 0.25rem;
}

.e2e-shop-order-items {
  display: grid;
  gap: 0.25rem;
  padding: 0.75rem;
}

.e2e-shop-order-items__head,
.e2e-shop-order-item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5rem minmax(10rem, 18rem) 3rem;
  gap: 0.5rem;
  align-items: center;
}

.e2e-shop-order-item-row {
  padding: 0.5rem;
}
</style>
