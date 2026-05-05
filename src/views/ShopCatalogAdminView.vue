<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import Button from 'primevue/button'
import { useToastMessages } from '@/composables/useToastMessages'
import AppShell from '@/layouts/AppShell.vue'
import {
  createShopCatalogItem,
  createShopCategory,
  deleteShopCatalogItem,
  deleteShopCategory,
  subscribeShopCatalogItems,
  subscribeShopCategories,
  updateShopCatalogItem,
  updateShopCategory,
} from '@/services/shopCatalog'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

type InspectorKey = 'root' | 'new-category' | 'new-item' | `category:${string}` | `item:${string}`
type MobileCatalogPanel = 'catalog' | 'inspector'

interface CategoryFormState {
  name: string
  parentId: string | null
  active: boolean
}

interface ItemFormState {
  description: string
  categoryId: string | null
  sku: string
  price: string
  active: boolean
}

interface TreeNode {
  key: `category:${string}` | `item:${string}` | `draft-category:${string}` | `draft-item:${string}`
  kind: 'category' | 'item'
  id: string
  parentId: string | null
  depth: number
  label: string
  secondary: string
  active: boolean
  hasChildren: boolean
  draft?: boolean
}

type ContextMenuTarget =
  | { kind: 'root' }
  | { kind: 'category'; id: string }
  | { kind: 'item'; id: string }

interface ContextMenuAction {
  key: string
  label: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

interface DragPayload {
  kind: 'category' | 'item'
  id: string
}

const TOUCH_CONTEXT_MENU_DELAY = 700
const TOUCH_MOVE_THRESHOLD = 10

const categories = ref<ShopCategoryRecord[]>([])
const items = ref<ShopCatalogItemRecord[]>([])
const treeSearch = ref('')
const showArchived = ref(false)
const activeFolderId = ref<string | null>(null)
const selectedInspectorKey = ref<InspectorKey>('root')
const activeMobilePanel = ref<MobileCatalogPanel>('catalog')
const isSinglePaneLayout = ref(false)
const rootBucketExpanded = ref(true)
const expandedCategoryIds = ref<string[]>([])
const catalogLoading = ref(true)
const catalogError = ref('')
const createError = ref('')
const detailError = ref('')
const detailInfo = ref('')
const createLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const treeInitialized = ref(false)
const renameInputRef = ref<HTMLInputElement | null>(null)
const treeListElement = ref<HTMLDivElement | null>(null)
const contextMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  target: { kind: 'root' } as ContextMenuTarget,
})
const longPress = reactive({
  timer: null as number | null,
  suppressTimer: null as number | null,
  pointerId: null as number | null,
  pointerType: '' as '' | 'mouse' | 'touch' | 'pen',
  startX: 0,
  startY: 0,
  contextTarget: null as ContextMenuTarget | null,
  captureElement: null as Element | null,
  moved: false,
  suppressClick: false,
})
const dragState = reactive({
  sourceKey: null as TreeNode['key'] | null,
  overKey: null as TreeNode['key'] | 'root' | null,
  dropping: false,
})
const dragAutoScroll = reactive({
  frame: null as number | null,
  velocity: 0,
})
const renameState = reactive({
  key: null as TreeNode['key'] | null,
  value: '',
  saving: false,
})
const createState = reactive({
  key: null as TreeNode['key'] | null,
  kind: null as 'category' | 'item' | null,
  parentId: null as string | null,
  value: '',
  saving: false,
})

function setRenameInputRef(element: Element | ComponentPublicInstance | null) {
  renameInputRef.value = element instanceof HTMLInputElement ? element : null
}

const createCategoryForm = reactive<CategoryFormState>({
  name: '',
  parentId: null,
  active: true,
})

const createItemForm = reactive<ItemFormState>({
  description: '',
  categoryId: null,
  sku: '',
  price: '',
  active: true,
})

const detailCategoryForm = reactive<CategoryFormState>({
  name: '',
  parentId: null,
  active: true,
})

const detailItemForm = reactive<ItemFormState>({
  description: '',
  categoryId: null,
  sku: '',
  price: '',
  active: true,
})

let unsubscribeCategories: (() => void) | null = null
let unsubscribeItems: (() => void) | null = null

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

  for (const item of items.value) {
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

const selectedCategoryId = computed(() =>
  selectedInspectorKey.value.startsWith('category:') ? selectedInspectorKey.value.slice('category:'.length) : null,
)

const selectedItemId = computed(() =>
  selectedInspectorKey.value.startsWith('item:') ? selectedInspectorKey.value.slice('item:'.length) : null,
)

const selectedCategory = computed(() =>
  selectedCategoryId.value ? categoriesById.value.get(selectedCategoryId.value) ?? null : null,
)

const selectedItem = computed(() =>
  selectedItemId.value ? items.value.find((item) => item.id === selectedItemId.value) ?? null : null,
)

const isRootInspector = computed(() => selectedInspectorKey.value === 'root')
const isCreateCategoryMode = computed(() => selectedInspectorKey.value === 'new-category')
const isCreateItemMode = computed(() => selectedInspectorKey.value === 'new-item')

useToastMessages([
  { source: catalogError, severity: 'error', summary: 'Shop Catalog' },
  { source: createError, severity: 'error', summary: 'Catalog Create' },
  { source: detailError, severity: 'error', summary: 'Catalog Inspector' },
  { source: detailInfo, severity: 'success', summary: 'Catalog Inspector' },
])

function normalizeSearch(value: string) {
  return value.trim().toLowerCase()
}

function getCategoryDisplayName(category: Pick<ShopCategoryRecord, 'name'>) {
  return category.name.trim() || 'Untitled Folder'
}

function getItemDisplayName(item: Pick<ShopCatalogItemRecord, 'description'>) {
  return item.description.trim() || 'Untitled Item'
}

function formatPriceLabel(price: number | null) {
  if (price == null) return 'No Price'
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPriceInputValue(price: number | null) {
  return price == null ? '' : formatPriceLabel(price)
}

function readTextInputValue(event: Event) {
  const target = event.target
  return target instanceof HTMLInputElement ? target.value : ''
}

function sanitizePriceInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '')
  const [whole = '', ...fractionParts] = normalized.split('.')
  const fraction = fractionParts.join('').slice(0, 2)
  return fractionParts.length > 0 ? `${whole}.${fraction}` : whole
}

function getNodeStatusLabel(active: boolean) {
  return active ? 'Active' : 'Archived'
}

function isVisibleByArchive(active: boolean) {
  return showArchived.value || active
}

function getDirectChildCategoryCount(categoryId: string | null) {
  return (childCategoriesByParent.value.get(categoryId) ?? []).length
}

function getDirectChildItemCount(categoryId: string | null) {
  return (childItemsByParent.value.get(categoryId) ?? []).length
}

function getVisibleChildCategoryCount(categoryId: string | null) {
  return (childCategoriesByParent.value.get(categoryId) ?? []).filter((category) => isVisibleByArchive(category.active)).length
}

function getVisibleChildItemCount(categoryId: string | null) {
  return (childItemsByParent.value.get(categoryId) ?? []).filter((item) => isVisibleByArchive(item.active)).length
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

function getDescendantCategoryIdsWithSelf(categoryId: string) {
  const descendantIds = getDescendantCategoryIds(categoryId)
  descendantIds.add(categoryId)
  return Array.from(descendantIds)
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

function resetCreateCategoryForm() {
  createCategoryForm.name = ''
  createCategoryForm.parentId = activeFolderId.value
  createCategoryForm.active = true
  createError.value = ''
}

function resetCreateItemForm() {
  createItemForm.description = ''
  createItemForm.categoryId = activeFolderId.value
  createItemForm.sku = ''
  createItemForm.price = ''
  createItemForm.active = true
  createError.value = ''
}

function applySelectedCategoryToForm(category: ShopCategoryRecord | null) {
  detailError.value = ''
  detailInfo.value = ''

  if (!category) {
    detailCategoryForm.name = ''
    detailCategoryForm.parentId = null
    detailCategoryForm.active = true
    return
  }

  detailCategoryForm.name = category.name
  detailCategoryForm.parentId = category.parentId
  detailCategoryForm.active = category.active
}

function applySelectedItemToForm(item: ShopCatalogItemRecord | null) {
  detailError.value = ''
  detailInfo.value = ''

  if (!item) {
    detailItemForm.description = ''
    detailItemForm.categoryId = null
    detailItemForm.sku = ''
    detailItemForm.price = ''
    detailItemForm.active = true
    return
  }

  detailItemForm.description = item.description
  detailItemForm.categoryId = item.categoryId
  detailItemForm.sku = item.sku ?? ''
  detailItemForm.price = formatPriceInputValue(item.price)
  detailItemForm.active = item.active
}

function parsePrice(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[$,\s]/g, '')
  if (!normalized || normalized === '.') return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return Math.round(parsed * 100) / 100
}

function handlePriceInput(form: ItemFormState, event: Event) {
  form.price = sanitizePriceInput(readTextInputValue(event))
}

function handlePriceFocus(form: ItemFormState) {
  const parsed = parsePrice(form.price)
  form.price = parsed == null ? sanitizePriceInput(form.price) : parsed.toFixed(2)
}

function handlePriceBlur(form: ItemFormState) {
  const parsed = parsePrice(form.price)
  form.price = parsed == null ? '' : formatPriceInputValue(parsed)
}

function isCategoryExpanded(categoryId: string) {
  return expandedCategoryIds.value.includes(categoryId)
}

function ensureExpandedToCategory(categoryId: string | null) {
  let currentId = categoryId
  const next = new Set(expandedCategoryIds.value)

  while (currentId) {
    next.add(currentId)
    currentId = categoriesById.value.get(currentId)?.parentId ?? null
  }

  expandedCategoryIds.value = Array.from(next)
}

function toggleCategoryExpanded(categoryId: string) {
  if (isCategoryExpanded(categoryId)) {
    expandedCategoryIds.value = expandedCategoryIds.value.filter((id) => id !== categoryId)
    return
  }

  expandedCategoryIds.value = [...expandedCategoryIds.value, categoryId]
}

function getVisibleCategoryIds() {
  return categories.value
    .filter((category) => isVisibleByArchive(category.active))
    .map((category) => category.id)
}

function syncLayoutMode() {
  isSinglePaneLayout.value = window.innerWidth <= 1180
}

function toggleRootBucketExpanded() {
  rootBucketExpanded.value = !rootBucketExpanded.value
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

function selectRoot() {
  activeFolderId.value = null
  selectedInspectorKey.value = 'root'
  cancelInlineCreate()
}

function openCreateItemMode(parentId: string | null = activeFolderId.value) {
  cancelRename()
  cancelInlineCreate()
  activeFolderId.value = parentId
  selectedInspectorKey.value = 'new-item'
  activeMobilePanel.value = 'inspector'
  createItemForm.description = ''
  createItemForm.categoryId = parentId
  createItemForm.sku = ''
  createItemForm.price = ''
  createItemForm.active = true
  createError.value = ''

  if (parentId) {
    ensureExpandedToCategory(parentId)
  } else {
    rootBucketExpanded.value = true
  }
}

function selectFolder(categoryId: string, options?: { showInspector?: boolean; ensureExpanded?: boolean }) {
  activeFolderId.value = categoryId
  selectedInspectorKey.value = `category:${categoryId}`
  if (options?.showInspector ?? true) {
    activeMobilePanel.value = 'inspector'
  }
  if (options?.ensureExpanded ?? true) {
    ensureExpandedToCategory(categoryId)
  }
  cancelInlineCreate()
}

function inspectItem(item: ShopCatalogItemRecord, options?: { showInspector?: boolean }) {
  activeFolderId.value = item.categoryId
  selectedInspectorKey.value = `item:${item.id}`
  if (options?.showInspector ?? true) {
    activeMobilePanel.value = 'inspector'
  }
  ensureExpandedToCategory(item.categoryId)
  cancelInlineCreate()
}

function showMobilePanel(panel: MobileCatalogPanel) {
  activeMobilePanel.value = panel
}

function closeContextMenu() {
  contextMenu.visible = false
}

function clearDragState() {
  dragState.sourceKey = null
  dragState.overKey = null
  dragState.dropping = false
  stopTreeListAutoScroll()
}

function stopTreeListAutoScroll() {
  dragAutoScroll.velocity = 0
  if (dragAutoScroll.frame !== null) {
    window.cancelAnimationFrame(dragAutoScroll.frame)
    dragAutoScroll.frame = null
  }
}

function stepTreeListAutoScroll() {
  const list = treeListElement.value
  if (!list || !dragState.sourceKey || dragAutoScroll.velocity === 0) {
    stopTreeListAutoScroll()
    return
  }

  const maxScrollTop = list.scrollHeight - list.clientHeight
  if (maxScrollTop <= 0) {
    stopTreeListAutoScroll()
    return
  }

  const nextScrollTop = Math.max(0, Math.min(maxScrollTop, list.scrollTop + dragAutoScroll.velocity))
  if (nextScrollTop === list.scrollTop) {
    stopTreeListAutoScroll()
    return
  }

  list.scrollTop = nextScrollTop
  dragAutoScroll.frame = window.requestAnimationFrame(stepTreeListAutoScroll)
}

function startTreeListAutoScroll() {
  if (dragAutoScroll.frame !== null || dragAutoScroll.velocity === 0) return
  dragAutoScroll.frame = window.requestAnimationFrame(stepTreeListAutoScroll)
}

function updateTreeListAutoScroll(clientY: number) {
  const list = treeListElement.value
  if (!list || !dragState.sourceKey) {
    stopTreeListAutoScroll()
    return
  }

  const rect = list.getBoundingClientRect()
  if (rect.height <= 0) {
    stopTreeListAutoScroll()
    return
  }

  const threshold = Math.min(96, Math.max(48, rect.height * 0.2))
  const distanceFromTop = clientY - rect.top
  const distanceFromBottom = rect.bottom - clientY

  let velocity = 0
  if (distanceFromTop < threshold) {
    const intensity = (threshold - Math.max(distanceFromTop, 0)) / threshold
    velocity = -Math.max(4, Math.round(18 * intensity))
  } else if (distanceFromBottom < threshold) {
    const intensity = (threshold - Math.max(distanceFromBottom, 0)) / threshold
    velocity = Math.max(4, Math.round(18 * intensity))
  }

  if (velocity === 0) {
    stopTreeListAutoScroll()
    return
  }

  dragAutoScroll.velocity = velocity
  startTreeListAutoScroll()
}

function clearLongPressTimer() {
  if (longPress.timer !== null) {
    window.clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

function clearSuppressTimer() {
  if (longPress.suppressTimer !== null) {
    window.clearTimeout(longPress.suppressTimer)
    longPress.suppressTimer = null
  }
}

function releaseLongPressCapture(pointerId?: number) {
  if (!(longPress.captureElement instanceof Element) || pointerId == null) return

  if (typeof longPress.captureElement.hasPointerCapture === 'function' && longPress.captureElement.hasPointerCapture(pointerId)) {
    try {
      longPress.captureElement.releasePointerCapture(pointerId)
    } catch {
      // Ignore browsers that reject late pointer capture release.
    }
  }
}

function setSuppressClickWindow(duration = 700) {
  longPress.suppressClick = true
  clearSuppressTimer()
  longPress.suppressTimer = window.setTimeout(() => {
    longPress.suppressClick = false
    longPress.suppressTimer = null
  }, duration)
}

function resetLongPress(pointerId?: number) {
  if (pointerId != null && longPress.pointerId !== pointerId) return

  clearLongPressTimer()
  releaseLongPressCapture(pointerId ?? longPress.pointerId ?? undefined)
  longPress.pointerId = null
  longPress.pointerType = ''
  longPress.contextTarget = null
  longPress.captureElement = null
  longPress.moved = false
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

function hasMovedBeyondTouchThreshold(clientX: number, clientY: number) {
  const movedX = Math.abs(clientX - longPress.startX)
  const movedY = Math.abs(clientY - longPress.startY)
  return movedX > TOUCH_MOVE_THRESHOLD || movedY > TOUCH_MOVE_THRESHOLD
}

function beginLongPress(event: PointerEvent, target: ContextMenuTarget) {
  longPress.pointerType =
    event.pointerType === 'mouse' || event.pointerType === 'touch' || event.pointerType === 'pen'
      ? event.pointerType
      : ''

  if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return

  resetLongPress()
  clearLongPressTimer()
  longPress.pointerId = event.pointerId
  longPress.startX = event.clientX
  longPress.startY = event.clientY
  longPress.contextTarget = target
  longPress.captureElement = event.currentTarget instanceof Element ? event.currentTarget : null
  longPress.moved = false
  longPress.suppressClick = false

  if (typeof longPress.captureElement?.setPointerCapture === 'function') {
    try {
      longPress.captureElement.setPointerCapture(event.pointerId)
    } catch {
      // Ignore browsers that reject pointer capture for this element.
    }
  }

  longPress.timer = window.setTimeout(() => {
    const menuTarget = longPress.contextTarget
    longPress.timer = null

    if (!menuTarget || longPress.moved) return

    setSuppressClickWindow()
    resetLongPress(event.pointerId)
    openContextMenuAt(menuTarget, event.clientX, event.clientY)
  }, TOUCH_CONTEXT_MENU_DELAY)
}

function handleLongPressMove(event: PointerEvent) {
  if (longPress.pointerId !== event.pointerId) return

  if (!hasMovedBeyondTouchThreshold(event.clientX, event.clientY)) return

  longPress.moved = true
  clearLongPressTimer()
}

function handleLongPressEnd(event: PointerEvent) {
  if (longPress.pointerId !== event.pointerId) return

  resetLongPress(event.pointerId)
}

function consumeSuppressedClick(event: MouseEvent) {
  if (!longPress.suppressClick) return false

  event.preventDefault()
  event.stopPropagation()
  longPress.suppressClick = false
  clearSuppressTimer()
  return true
}

function isRenamingNode(nodeKey: TreeNode['key']) {
  return renameState.key === nodeKey
}

function isCreatingNode(nodeKey: TreeNode['key']) {
  return createState.key === nodeKey
}

function cancelRename() {
  renameState.key = null
  renameState.value = ''
  renameState.saving = false
}

function cancelInlineCreate() {
  createState.key = null
  createState.kind = null
  createState.parentId = null
  createState.value = ''
  createState.saving = false
}

function getDragPayloadFromNode(node: TreeNode): DragPayload | null {
  if (node.draft || isCreatingNode(node.key) || isRenamingNode(node.key)) return null

  return {
    kind: node.kind,
    id: node.id,
  }
}

function getCurrentDragPayload(): DragPayload | null {
  if (!dragState.sourceKey) return null

  if (dragState.sourceKey.startsWith('category:')) {
    return {
      kind: 'category',
      id: dragState.sourceKey.slice('category:'.length),
    }
  }

  if (dragState.sourceKey.startsWith('item:')) {
    return {
      kind: 'item',
      id: dragState.sourceKey.slice('item:'.length),
    }
  }

  return null
}

function canDropPayload(payload: DragPayload | null, targetCategoryId: string | null) {
  if (!payload) return false

  if (payload.kind === 'category') {
    const category = categoriesById.value.get(payload.id) ?? null
    if (!category) return false
    if (category.id === targetCategoryId) return false
    if ((category.parentId ?? null) === targetCategoryId) return false
    if (targetCategoryId && getDescendantCategoryIds(category.id).has(targetCategoryId)) return false
    return true
  }

  const item = items.value.find((candidate) => candidate.id === payload.id) ?? null
  if (!item) return false
  return (item.categoryId ?? null) !== targetCategoryId
}

function getDropTargetCategoryId(node: TreeNode) {
  return node.kind === 'category' ? node.id : node.parentId
}

function getDropTargetKey(node: TreeNode): TreeNode['key'] | 'root' {
  if (node.kind === 'category') return node.key

  return node.parentId ? (`category:${node.parentId}` as const) : 'root'
}

async function beginInlineCreate(kind: 'category' | 'item', parentId: string | null = activeFolderId.value) {
  cancelRename()
  cancelInlineCreate()
  createError.value = ''

  if (parentId == null) {
    rootBucketExpanded.value = true
  }

  if (parentId) {
    ensureExpandedToCategory(parentId)
    selectedInspectorKey.value = `category:${parentId}`
  }

  createState.kind = kind
  createState.parentId = parentId
  createState.key = `draft-${kind}:${Date.now()}`
  createState.value = ''

  closeContextMenu()
  await nextTick()
  requestAnimationFrame(() => {
    renameInputRef.value?.focus()
  })
}

function handleTreeDragStart(event: DragEvent, node: TreeNode) {
  if (
    contextMenu.visible
    || longPress.pointerId !== null
    || longPress.suppressClick
    || longPress.pointerType === 'touch'
    || longPress.pointerType === 'pen'
  ) {
    event.preventDefault()
    return
  }

  const payload = getDragPayloadFromNode(node)
  if (!payload) {
    event.preventDefault()
    return
  }

  closeContextMenu()
  dragState.sourceKey = node.key
  dragState.overKey = null

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify(payload))
  }
}

function handleTreeDragEnd() {
  longPress.pointerType = ''
  stopTreeListAutoScroll()
  clearDragState()
}

function handleTreeListDragOver(event: DragEvent) {
  updateTreeListAutoScroll(event.clientY)
}

function handleTreeListDragLeave(event: DragEvent) {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && treeListElement.value?.contains(nextTarget)) return
  stopTreeListAutoScroll()
}

function handleDragLeave(event: DragEvent, targetKey: TreeNode['key'] | 'root') {
  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && event.currentTarget instanceof Element && event.currentTarget.contains(nextTarget)) {
    return
  }

  if (dragState.overKey === targetKey) {
    dragState.overKey = null
  }
}

function handleRootDragOver(event: DragEvent) {
  const payload = getCurrentDragPayload()
  if (!canDropPayload(payload, null)) return

  event.preventDefault()
  dragState.overKey = 'root'

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

function handleNodeDragOver(event: DragEvent, node: TreeNode) {
  const targetCategoryId = getDropTargetCategoryId(node)
  const payload = getCurrentDragPayload()

  if (!canDropPayload(payload, targetCategoryId)) return

  event.preventDefault()
  dragState.overKey = getDropTargetKey(node)

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

async function moveDraggedEntry(payload: DragPayload, targetCategoryId: string | null) {
  detailError.value = ''
  detailInfo.value = ''

  if (payload.kind === 'category') {
    const category = categoriesById.value.get(payload.id) ?? null
    if (!category || !canDropPayload(payload, targetCategoryId)) return

    await updateShopCategory(category.id, {
      name: category.name,
      parentId: targetCategoryId,
      active: category.active,
    })

    ensureExpandedToCategory(targetCategoryId)
    selectFolder(category.id, { showInspector: false })
    detailInfo.value = targetCategoryId ? 'Folder moved.' : 'Folder moved to top level.'
    return
  }

  const item = items.value.find((candidate) => candidate.id === payload.id) ?? null
  if (!item || !canDropPayload(payload, targetCategoryId)) return

  await updateShopCatalogItem(item.id, {
    description: item.description,
    categoryId: targetCategoryId,
    sku: item.sku ?? null,
    price: item.price,
    active: item.active,
  })

  ensureExpandedToCategory(targetCategoryId)
  inspectItem(
    {
      ...item,
      categoryId: targetCategoryId,
    },
    { showInspector: false },
  )
  detailInfo.value = targetCategoryId ? 'Item moved.' : 'Item moved to top level.'
}

async function handleRootDrop(event: DragEvent) {
  const payload = getCurrentDragPayload()
  if (!canDropPayload(payload, null) || !payload || dragState.dropping) return

  event.preventDefault()
  stopTreeListAutoScroll()
  dragState.dropping = true

  try {
    await moveDraggedEntry(payload, null)
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to move catalog entry.')
  } finally {
    clearDragState()
  }
}

async function handleNodeDrop(event: DragEvent, node: TreeNode) {
  const targetCategoryId = getDropTargetCategoryId(node)
  const payload = getCurrentDragPayload()

  if (!canDropPayload(payload, targetCategoryId) || !payload || dragState.dropping) return

  event.preventDefault()
  stopTreeListAutoScroll()
  dragState.dropping = true

  try {
    await moveDraggedEntry(payload, targetCategoryId)
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to move catalog entry.')
  } finally {
    clearDragState()
  }
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
  if (node.draft) {
    event.preventDefault()
    return
  }

  if (node.kind === 'category') {
    openContextMenu(event, { kind: 'category', id: node.id })
    return
  }

  openContextMenu(event, { kind: 'item', id: node.id })
}

function beginRootLongPress(event: PointerEvent) {
  beginLongPress(event, { kind: 'root' })
}

function beginNodeLongPress(event: PointerEvent, node: TreeNode) {
  if (node.draft) return

  if (node.kind === 'category') {
    beginLongPress(event, { kind: 'category', id: node.id })
    return
  }

  beginLongPress(event, { kind: 'item', id: node.id })
}

function deleteCategoryFromContext(categoryId: string) {
  selectFolder(categoryId, { showInspector: false })
  closeContextMenu()
  void handleDeleteCategory()
}

function deleteItemFromContext(itemId: string) {
  const item = items.value.find((candidate) => candidate.id === itemId)
  if (item) {
    inspectItem(item, { showInspector: false })
  }
  closeContextMenu()
  void handleDeleteItem()
}

async function handleArchiveCategory(
  nextActive: boolean,
  categoryId = selectedCategory.value?.id ?? null,
  options?: { showInspector?: boolean },
) {
  if (!categoryId) return

  const category = categoriesById.value.get(categoryId) ?? null
  if (!category) return

  detailError.value = ''
  detailInfo.value = ''

  const actionLabel = nextActive ? 'restored' : 'archived'
  const confirmed = window.confirm(`${nextActive ? 'Restore' : 'Archive'} folder ${getCategoryDisplayName(category)}?`)
  if (!confirmed) return

  saveLoading.value = true
  try {
    const categoryIdsToUpdate = getDescendantCategoryIdsWithSelf(categoryId)
    const itemIdsToUpdate = items.value
      .filter((item) => item.categoryId != null && categoryIdsToUpdate.includes(item.categoryId))
      .map((item) => item.id)

    await Promise.all([
      ...categoryIdsToUpdate.map(async (nextCategoryId) => {
        const nextCategory = categoriesById.value.get(nextCategoryId) ?? null
        if (!nextCategory) return

        await updateShopCategory(nextCategoryId, {
          name: nextCategory.name,
          parentId: nextCategory.parentId,
          active: nextActive,
        })
      }),
      ...itemIdsToUpdate.map(async (itemId) => {
        const nextItem = items.value.find((candidate) => candidate.id === itemId) ?? null
        if (!nextItem) return

        await updateShopCatalogItem(itemId, {
          description: nextItem.description,
          categoryId: nextItem.categoryId,
          sku: nextItem.sku ?? null,
          price: nextItem.price,
          active: nextActive,
        })
      }),
    ])

    if (!nextActive && !showArchived.value) {
      activeFolderId.value = category.parentId
      selectedInspectorKey.value = category.parentId ? `category:${category.parentId}` : 'root'
    } else {
      selectFolder(categoryId, { showInspector: options?.showInspector ?? true })
    }

    detailInfo.value = `Folder ${actionLabel}.`
  } catch (error) {
    detailError.value = normalizeError(error, `Failed to ${nextActive ? 'restore' : 'archive'} folder.`)
  } finally {
    saveLoading.value = false
  }
}

async function handleArchiveItem(
  nextActive: boolean,
  itemId = selectedItem.value?.id ?? null,
  options?: { showInspector?: boolean },
) {
  if (!itemId) return

  const item = items.value.find((candidate) => candidate.id === itemId) ?? null
  if (!item) return

  detailError.value = ''
  detailInfo.value = ''

  const actionLabel = nextActive ? 'restored' : 'archived'
  const confirmed = window.confirm(`${nextActive ? 'Restore' : 'Archive'} item ${getItemDisplayName(item)}?`)
  if (!confirmed) return

  saveLoading.value = true
  try {
    await updateShopCatalogItem(itemId, {
      description: item.description,
      categoryId: item.categoryId,
      sku: item.sku ?? null,
      price: item.price,
      active: nextActive,
    })

    if (!nextActive && !showArchived.value) {
      selectedInspectorKey.value = item.categoryId ? `category:${item.categoryId}` : 'root'
      activeFolderId.value = item.categoryId
    } else {
      inspectItem(
        {
          ...item,
          active: nextActive,
        },
        { showInspector: options?.showInspector ?? true },
      )
    }

    detailInfo.value = `Item ${actionLabel}.`
  } catch (error) {
    detailError.value = normalizeError(error, `Failed to ${nextActive ? 'restore' : 'archive'} item.`)
  } finally {
    saveLoading.value = false
  }
}

async function beginRenameNode(target: ContextMenuTarget) {
  if (target.kind === 'root') return
  cancelInlineCreate()

  if (target.kind === 'category') {
    const category = categoriesById.value.get(target.id) ?? null
    if (!category) return
    selectFolder(target.id, { showInspector: false })
    renameState.key = `category:${target.id}`
    renameState.value = getCategoryDisplayName(category)
  } else {
    const item = items.value.find((candidate) => candidate.id === target.id) ?? null
    if (!item) return
    inspectItem(item, { showInspector: false })
    renameState.key = `item:${target.id}`
    renameState.value = getItemDisplayName(item)
  }

  closeContextMenu()
  await nextTick()
  requestAnimationFrame(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

async function saveInlineCreate() {
  if (!createState.key || !createState.kind || createState.saving) return

  const nextValue = createState.value.trim()
  if (!nextValue) {
    cancelInlineCreate()
    return
  }

  createState.saving = true
  createError.value = ''

  try {
    if (createState.kind === 'category') {
      const categoryId = await createShopCategory({
        name: nextValue,
        parentId: createState.parentId,
        active: true,
      })

      if (createState.parentId) {
        ensureExpandedToCategory(createState.parentId)
      }

      expandedCategoryIds.value = Array.from(new Set([...expandedCategoryIds.value, categoryId]))
      selectFolder(categoryId, { showInspector: false })
    } else {
      const itemId = await createShopCatalogItem({
        description: nextValue,
        categoryId: createState.parentId,
        sku: null,
        price: null,
        active: true,
      })

      const item = items.value.find((candidate) => candidate.id === itemId)
      if (item) {
        inspectItem(item, { showInspector: false })
      } else {
        activeFolderId.value = createState.parentId
        selectedInspectorKey.value = `item:${itemId}`
      }
    }

    cancelInlineCreate()
  } catch (error) {
    createError.value = normalizeError(error, `Failed to create ${createState.kind}.`)
    createState.saving = false
  }
}

async function saveInlineRename() {
  if (!renameState.key || renameState.saving) return

  const nextValue = renameState.value.trim()
  if (!nextValue) {
    cancelRename()
    return
  }

  renameState.saving = true

  try {
    if (renameState.key.startsWith('category:')) {
      const categoryId = renameState.key.slice('category:'.length)
      const category = categoriesById.value.get(categoryId) ?? null
      if (!category || nextValue === getCategoryDisplayName(category)) {
        cancelRename()
        return
      }

      await updateShopCategory(categoryId, {
        name: nextValue,
        parentId: category.parentId,
        active: category.active,
      })
    } else {
      const itemId = renameState.key.slice('item:'.length)
      const item = items.value.find((candidate) => candidate.id === itemId) ?? null
      if (!item || nextValue === getItemDisplayName(item)) {
        cancelRename()
        return
      }

      await updateShopCatalogItem(itemId, {
        description: nextValue,
        categoryId: item.categoryId,
        sku: item.sku ?? null,
        price: item.price,
        active: item.active,
      })
    }

    cancelRename()
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to rename catalog entry.')
    renameState.saving = false
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
      ...(isSinglePaneLayout.value
        ? [{
            key: 'inspect-root',
            label: 'Inspect',
            run: () => {
              selectRoot()
              showMobilePanel('inspector')
              closeContextMenu()
            },
          }]
        : []),
      {
        key: 'new-folder-root',
        label: 'New Folder',
        run: () => {
          void beginInlineCreate('category', null)
        },
      },
      {
        key: 'new-item-root',
        label: 'New Item',
        run: () => {
          openCreateItemMode(null)
          closeContextMenu()
        },
      },
      {
        key: 'expand-all-folders-root',
        label: 'Expand All Folders',
        disabled: allVisibleCategoriesExpanded,
        run: () => {
          expandAllCategories()
        },
      },
      {
        key: 'collapse-all-folders-root',
        label: 'Collapse All Folders',
        disabled: !anyFoldersExpanded,
        run: () => {
          collapseAllCategories()
        },
      },
    ]
  }

  if (target.kind === 'category') {
    const category = categoriesById.value.get(target.id) ?? null
    const hasChildren = category
      ? getDirectChildCategoryCount(category.id) > 0 || getDirectChildItemCount(category.id) > 0
      : false
    const isArchived = category ? !category.active : false

    return [
      ...(isSinglePaneLayout.value
        ? [{
            key: 'inspect-folder',
            label: 'Inspect',
            run: () => {
              selectFolder(target.id, { showInspector: true })
              closeContextMenu()
            },
          }]
        : []),
      {
        key: 'new-folder-inside',
        label: 'New Folder',
        run: () => {
          void beginInlineCreate('category', target.id)
        },
      },
      {
        key: 'new-item-inside',
        label: 'New Item',
        run: () => {
          openCreateItemMode(target.id)
          closeContextMenu()
        },
      },
      {
        key: 'rename-folder',
        label: 'Rename',
        run: () => {
          void beginRenameNode(target)
        },
      },
      {
        key: 'expand-all-folders-category',
        label: 'Expand All Folders',
        disabled: allVisibleCategoriesExpanded,
        run: () => {
          expandAllCategories()
        },
      },
      {
        key: 'collapse-all-folders-category',
        label: 'Collapse All Folders',
        disabled: !anyFoldersExpanded,
        run: () => {
          collapseAllCategories()
        },
      },
      {
        key: 'archive-folder',
        label: isArchived ? 'Restore Folder' : 'Archive Folder',
        run: () => {
          void handleArchiveCategory(isArchived, target.id, { showInspector: false })
          closeContextMenu()
        },
      },
      {
        key: 'delete-folder',
        label: 'Delete Folder',
        danger: true,
        disabled: hasChildren,
        run: () => deleteCategoryFromContext(target.id),
      },
    ]
  }

  const item = items.value.find((candidate) => candidate.id === target.id) ?? null
  const isArchived = item ? !item.active : false

  return [
    ...(isSinglePaneLayout.value
      ? [{
          key: 'inspect-item',
          label: 'Inspect',
          run: () => {
            if (item) {
              inspectItem(item, { showInspector: true })
            }
            closeContextMenu()
          },
        }]
      : []),
    {
      key: 'rename-item',
      label: 'Rename',
      run: () => {
        void beginRenameNode(target)
      },
    },
    {
      key: 'expand-all-folders-item',
      label: 'Expand All Folders',
      disabled: allVisibleCategoriesExpanded,
      run: () => {
        expandAllCategories()
      },
    },
    {
      key: 'collapse-all-folders-item',
      label: 'Collapse All Folders',
      disabled: !anyFoldersExpanded,
      run: () => {
        collapseAllCategories()
      },
    },
    {
      key: 'archive-item',
      label: isArchived ? 'Restore Item' : 'Archive Item',
      run: () => {
        void handleArchiveItem(isArchived, target.id, { showInspector: false })
        closeContextMenu()
      },
    },
    {
      key: 'delete-item',
      label: 'Delete Item',
      danger: true,
      run: () => deleteItemFromContext(target.id),
    },
  ]
})

function getDescendantCategoryIds(categoryId: string): Set<string> {
  const descendantIds = new Set<string>()
  const queue = [categoryId]

  while (queue.length) {
    const currentId = queue.shift() ?? null
    if (!currentId) continue

    const childCategories = childCategoriesByParent.value.get(currentId) ?? []
    for (const childCategory of childCategories) {
      if (descendantIds.has(childCategory.id)) continue
      descendantIds.add(childCategory.id)
      queue.push(childCategory.id)
    }
  }

  return descendantIds
}

const categoryOptions = computed(() =>
  categories.value.map((category) => ({
    value: category.id,
    label: getCategoryPath(category.id),
  })),
)

const visibleRootCategoryCount = computed(() =>
  (childCategoriesByParent.value.get(null) ?? []).filter((category) => isVisibleByArchive(category.active)).length,
)

const visibleRootItemCount = computed(() =>
  (childItemsByParent.value.get(null) ?? []).filter((item) => isVisibleByArchive(item.active)).length,
)

const rootBucketHasChildren = computed(() => (
  visibleRootCategoryCount.value > 0
  || visibleRootItemCount.value > 0
  || ((createState.parentId == null) && !!createState.key)
))

const rootBucketSummary = computed(() => (
  formatFolderItemSummary(visibleRootCategoryCount.value, visibleRootItemCount.value)
))

const detailCategoryParentOptions = computed(() => {
  if (!selectedCategory.value) return categoryOptions.value

  const blockedIds = getDescendantCategoryIds(selectedCategory.value.id)
  blockedIds.add(selectedCategory.value.id)
  return categoryOptions.value.filter((option) => !blockedIds.has(option.value))
})

const treeNodes = computed<TreeNode[]>(() => {
  const query = normalizeSearch(treeSearch.value)
  const nodes: TreeNode[] = []

  const appendDraftNode = (kind: 'category' | 'item', parentId: string | null, depth: number) => {
    if (!createState.key || createState.kind !== kind || createState.parentId !== parentId) return

    nodes.push({
      key: createState.key,
      kind,
      id: createState.key,
      parentId,
      depth,
      label: createState.value || (kind === 'category' ? 'New Folder' : 'New Item'),
      secondary: kind === 'category' ? 'New folder' : 'New item',
      active: true,
      hasChildren: false,
      draft: true,
    })
  }

  const appendItem = (item: ShopCatalogItemRecord, depth: number) => {
    if (!isVisibleByArchive(item.active)) return

    const label = getItemDisplayName(item)
    const sku = (item.sku ?? '').toLowerCase()
    const path = getCategoryPath(item.categoryId).toLowerCase()
    const matchesSearch = !query || label.toLowerCase().includes(query) || sku.includes(query) || path.includes(query)

    if (!matchesSearch) return

    nodes.push({
      key: `item:${item.id}`,
      kind: 'item',
      id: item.id,
      parentId: item.categoryId,
      depth,
      label,
      secondary: item.sku ? `SKU ${item.sku}` : 'Item',
      active: item.active,
      hasChildren: false,
    })
  }

  const appendCategory = (category: ShopCategoryRecord, depth: number) => {
    if (!isVisibleByArchive(category.active)) return

    const label = getCategoryDisplayName(category)
    const path = getCategoryPath(category.parentId)
    const matchesSearch = !query || label.toLowerCase().includes(query) || path.toLowerCase().includes(query)

    if (matchesSearch) {
      nodes.push({
        key: `category:${category.id}`,
        kind: 'category',
        id: category.id,
        parentId: category.parentId,
        depth,
        label,
        secondary: formatFolderItemSummary(
          getVisibleChildCategoryCount(category.id),
          getVisibleChildItemCount(category.id),
        ),
        active: category.active,
        hasChildren:
          getVisibleChildCategoryCount(category.id) > 0 || getVisibleChildItemCount(category.id) > 0,
      })
    }

    if (!isCategoryExpanded(category.id) && !query) return

    const childCategories = childCategoriesByParent.value.get(category.id) ?? []
    for (const childCategory of childCategories) {
      appendCategory(childCategory, depth + 1)
    }

    appendDraftNode('category', category.id, depth + 1)

    const childItems = childItemsByParent.value.get(category.id) ?? []
    for (const childItem of childItems) {
      appendItem(childItem, depth + 1)
    }

    appendDraftNode('item', category.id, depth + 1)
  }

  const rootCategories = childCategoriesByParent.value.get(null) ?? []
  if (rootBucketExpanded.value || query) {
    for (const rootCategory of rootCategories) {
      appendCategory(rootCategory, 1)
    }

    appendDraftNode('category', null, 1)

    const rootItems = childItemsByParent.value.get(null) ?? []
    for (const rootItem of rootItems) {
      appendItem(rootItem, 1)
    }

    appendDraftNode('item', null, 1)
  }

  return nodes
})

function openTreeNode(node: TreeNode) {
  if (node.draft) return

  if (node.kind === 'category') {
    selectFolder(node.id, { showInspector: false, ensureExpanded: false })
    if (node.hasChildren) {
      toggleCategoryExpanded(node.id)
    }
    return
  }

  const item = items.value.find((candidate) => candidate.id === node.id)
  if (item) {
    inspectItem(item, { showInspector: false })
  }
}

function handleRootSurfaceClick(event: MouseEvent) {
  if (consumeSuppressedClick(event)) return
  selectRoot()
}

function handleRootBucketClick(event: MouseEvent) {
  if (consumeSuppressedClick(event)) return
  selectRoot()
  toggleRootBucketExpanded()
}

function handleTreeNodeClick(event: MouseEvent, node: TreeNode) {
  if (consumeSuppressedClick(event)) return
  openTreeNode(node)
}

function handleGlobalPointerDown() {
  closeContextMenu()
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeContextMenu()
    clearDragState()
  }
}

function validateCategoryForm(form: CategoryFormState) {
  if (!form.name.trim()) return 'Enter a folder name.'
  return ''
}

function validateItemForm(form: ItemFormState) {
  if (!form.description.trim()) return 'Enter an item name.'
  if (form.price.trim() && parsePrice(form.price) == null) return 'Enter a valid price.'
  return ''
}

async function handleCreateCategory() {
  createError.value = ''
  detailInfo.value = ''

  const validationMessage = validateCategoryForm(createCategoryForm)
  if (validationMessage) {
    createError.value = validationMessage
    return
  }

  createLoading.value = true
  try {
    const categoryId = await createShopCategory({
      name: createCategoryForm.name,
      parentId: createCategoryForm.parentId,
      active: createCategoryForm.active,
    })

    activeFolderId.value = createCategoryForm.parentId
    ensureExpandedToCategory(createCategoryForm.parentId)
    expandedCategoryIds.value = Array.from(new Set([...expandedCategoryIds.value, categoryId]))
    selectedInspectorKey.value = `category:${categoryId}`
    activeMobilePanel.value = 'inspector'
  } catch (error) {
    createError.value = normalizeError(error, 'Failed to create folder.')
  } finally {
    createLoading.value = false
  }
}

async function handleCreateItem() {
  createError.value = ''
  detailInfo.value = ''

  const validationMessage = validateItemForm(createItemForm)
  if (validationMessage) {
    createError.value = validationMessage
    return
  }

  createLoading.value = true
  try {
    const itemId = await createShopCatalogItem({
      description: createItemForm.description,
      categoryId: createItemForm.categoryId,
      sku: createItemForm.sku.trim() || null,
      price: parsePrice(createItemForm.price),
      active: createItemForm.active,
    })

    activeFolderId.value = createItemForm.categoryId
    ensureExpandedToCategory(createItemForm.categoryId)
    selectedInspectorKey.value = `item:${itemId}`
    activeMobilePanel.value = 'inspector'
  } catch (error) {
    createError.value = normalizeError(error, 'Failed to create catalog item.')
  } finally {
    createLoading.value = false
  }
}

async function handleSaveCategory() {
  if (!selectedCategory.value) return

  detailError.value = ''
  detailInfo.value = ''

  const validationMessage = validateCategoryForm(detailCategoryForm)
  if (validationMessage) {
    detailError.value = validationMessage
    return
  }

  saveLoading.value = true
  try {
    await updateShopCategory(selectedCategory.value.id, {
      name: detailCategoryForm.name,
      parentId: detailCategoryForm.parentId,
      active: detailCategoryForm.active,
    })

    activeFolderId.value = selectedCategory.value.id
    ensureExpandedToCategory(detailCategoryForm.parentId)
    detailInfo.value = 'Folder updated.'
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to update folder.')
  } finally {
    saveLoading.value = false
  }
}

async function handleSaveItem() {
  if (!selectedItem.value) return

  detailError.value = ''
  detailInfo.value = ''

  const validationMessage = validateItemForm(detailItemForm)
  if (validationMessage) {
    detailError.value = validationMessage
    return
  }

  saveLoading.value = true
  try {
    await updateShopCatalogItem(selectedItem.value.id, {
      description: detailItemForm.description,
      categoryId: selectedItem.value.categoryId,
      sku: detailItemForm.sku.trim() || null,
      price: parsePrice(detailItemForm.price),
      active: detailItemForm.active,
    })

    activeFolderId.value = selectedItem.value.categoryId
    ensureExpandedToCategory(selectedItem.value.categoryId)
    detailInfo.value = 'Catalog item updated.'
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to update catalog item.')
  } finally {
    saveLoading.value = false
  }
}

const selectedCategoryHasChildren = computed(() => {
  if (!selectedCategory.value) return false
  return getDirectChildCategoryCount(selectedCategory.value.id) > 0 || getDirectChildItemCount(selectedCategory.value.id) > 0
})

async function handleDeleteCategory() {
  if (!selectedCategory.value) return

  if (selectedCategoryHasChildren.value) {
    detailError.value = 'Empty the folder before deleting it.'
    return
  }

  const confirmed = window.confirm(`Delete folder ${getCategoryDisplayName(selectedCategory.value)}?`)
  if (!confirmed) return

  detailError.value = ''
  detailInfo.value = ''
  deleteLoading.value = true
  try {
    await deleteShopCategory(selectedCategory.value.id)
    selectedInspectorKey.value = 'root'
    activeFolderId.value = selectedCategory.value.parentId
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to delete folder.')
  } finally {
    deleteLoading.value = false
  }
}

async function handleDeleteItem() {
  if (!selectedItem.value) return

  const confirmed = window.confirm(`Delete item ${getItemDisplayName(selectedItem.value)}?`)
  if (!confirmed) return

  detailError.value = ''
  detailInfo.value = ''
  deleteLoading.value = true
  try {
    await deleteShopCatalogItem(selectedItem.value.id)
    selectedInspectorKey.value = selectedItem.value.categoryId ? `category:${selectedItem.value.categoryId}` : 'root'
    activeFolderId.value = selectedItem.value.categoryId
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to delete catalog item.')
  } finally {
    deleteLoading.value = false
  }
}

watch(selectedCategory, (category) => {
  if (isCreateCategoryMode.value) {
    resetCreateCategoryForm()
    return
  }

  applySelectedCategoryToForm(category)
})

watch(selectedItem, (item) => {
  if (isCreateItemMode.value) {
    resetCreateItemForm()
    return
  }

  applySelectedItemToForm(item)
})

watch(categories, (nextCategories) => {
  if (!treeInitialized.value) {
    expandedCategoryIds.value = nextCategories.filter((category) => category.parentId === null).map((category) => category.id)
    treeInitialized.value = true
  }

  if (activeFolderId.value && !nextCategories.some((category) => category.id === activeFolderId.value)) {
    activeFolderId.value = null
    selectedInspectorKey.value = 'root'
  }

  if (selectedCategoryId.value && !nextCategories.some((category) => category.id === selectedCategoryId.value)) {
    selectedInspectorKey.value = 'root'
  }
})

watch(items, (nextItems) => {
  if (selectedItemId.value && !nextItems.some((item) => item.id === selectedItemId.value)) {
    selectedInspectorKey.value = activeFolderId.value ? `category:${activeFolderId.value}` : 'root'
  }
})

onMounted(() => {
  catalogLoading.value = true
  syncLayoutMode()
  window.addEventListener('pointerdown', handleGlobalPointerDown)
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', syncLayoutMode)

  unsubscribeCategories = subscribeShopCategories(
    (nextCategories) => {
      categories.value = nextCategories
      if (nextCategories.length || items.value.length) {
        catalogLoading.value = false
      }
    },
    (error) => {
      catalogError.value = normalizeError(error, 'Failed to load folders.')
      catalogLoading.value = false
    },
  )

  unsubscribeItems = subscribeShopCatalogItems(
    (nextItems) => {
      items.value = nextItems
      catalogLoading.value = false
    },
    (error) => {
      catalogError.value = normalizeError(error, 'Failed to load catalog items.')
      catalogLoading.value = false
    },
  )
})

onBeforeUnmount(() => {
  clearLongPressTimer()
  clearSuppressTimer()
  window.removeEventListener('pointerdown', handleGlobalPointerDown)
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', syncLayoutMode)
  unsubscribeCategories?.()
  unsubscribeItems?.()
})
</script>

<template>
  <AppShell>
    <div
      class="catalog-explorer"
      :class="{
        'catalog-explorer--mobile-catalog': activeMobilePanel === 'catalog',
        'catalog-explorer--mobile-inspector': activeMobilePanel === 'inspector',
      }"
    >
      <div class="catalog-explorer__mobile-nav" role="tablist" aria-label="Shop catalog panels">
        <Button
          unstyled
          type="button"
          class="catalog-explorer__mobile-toggle"
          :class="{ 'catalog-explorer__mobile-toggle--active': activeMobilePanel === 'catalog' }"
          label="Catalog"
          role="tab"
          :aria-selected="activeMobilePanel === 'catalog'"
          @click="showMobilePanel('catalog')"
        />
        <Button
          unstyled
          type="button"
          class="catalog-explorer__mobile-toggle"
          :class="{ 'catalog-explorer__mobile-toggle--active': activeMobilePanel === 'inspector' }"
          label="Inspector"
          role="tab"
          :aria-selected="activeMobilePanel === 'inspector'"
          @click="showMobilePanel('inspector')"
        />
      </div>

      <section id="catalog-tree-pane" class="catalog-tree-pane">
        <header class="catalog-pane__header catalog-tree-pane__header">
          <div>
            <span class="catalog-pane__eyebrow">Admin</span>
            <h1 class="catalog-pane__title">Shop Catalog</h1>
          </div>
        </header>

        <div class="catalog-tree-pane__body">
          <div class="catalog-pane__search">
            <input v-model="treeSearch" type="search" placeholder="Find folder" />
          </div>

          <label class="catalog-toggle-row catalog-toggle-row--compact">
            <input v-model="showArchived" type="checkbox" />
            <span>Show Archived</span>
          </label>

          <div
            ref="treeListElement"
            class="catalog-tree-pane__list"
            :class="{ 'catalog-tree-pane__list--drop-target': dragState.overKey === 'root' }"
            @click.self="handleRootSurfaceClick"
            @contextmenu="openRootContextMenu"
            @pointerdown.self="beginRootLongPress"
            @pointermove.self="handleLongPressMove"
            @pointerup.self="handleLongPressEnd"
            @pointercancel.self="handleLongPressEnd"
            @dragover.capture="handleTreeListDragOver"
            @dragleave.capture="handleTreeListDragLeave"
            @dragover.self="handleRootDragOver"
            @dragleave.self="handleDragLeave($event, 'root')"
            @drop.self="handleRootDrop"
          >

            <div v-if="catalogLoading" class="catalog-pane__empty">Loading catalog...</div>

            <div v-else class="catalog-tree">
              <div class="catalog-tree__row">
                <button
                  type="button"
                  class="catalog-tree-node catalog-tree-node--root"
                  :class="{
                    'catalog-tree-node--active': selectedInspectorKey === 'root',
                    'catalog-tree-node--drop-target': dragState.overKey === 'root',
                  }"
                  @click="handleRootBucketClick"
                  @contextmenu="openRootContextMenu"
                  @pointerdown="beginRootLongPress"
                  @pointermove="handleLongPressMove"
                  @pointerup="handleLongPressEnd"
                  @pointercancel="handleLongPressEnd"
                  @dragover="handleRootDragOver"
                  @dragleave="handleDragLeave($event, 'root')"
                  @drop="handleRootDrop"
                >
                  <span class="catalog-tree-node__indent" :style="{ width: '0rem' }"></span>
                  <span
                    v-if="rootBucketHasChildren"
                    class="catalog-tree-node__twist"
                    :class="{ 'catalog-tree-node__twist--open': rootBucketExpanded }"
                    @click.stop="toggleRootBucketExpanded"
                  >
                    <span class="catalog-chevron"></span>
                  </span>
                  <span v-else class="catalog-tree-node__twist catalog-tree-node__twist--placeholder"></span>
                  <span class="catalog-node-icon catalog-node-icon--folder"></span>
                  <span class="catalog-tree-node__label">Top Level</span>
                  <span v-if="rootBucketSummary" class="catalog-tree-node__meta">{{ rootBucketSummary }}</span>
                </button>
              </div>

              <div
                v-for="node in treeNodes"
                :key="node.key"
                class="catalog-tree__row"
              >
                <button
                  type="button"
                  class="catalog-tree-node"
                  :class="{
                    'catalog-tree-node--active': selectedInspectorKey === node.key || createState.key === node.key,
                    'catalog-tree-node--dragging': dragState.sourceKey === node.key,
                    'catalog-tree-node--drop-target': dragState.overKey === node.key,
                  }"
                  :draggable="!node.draft && !isCreatingNode(node.key) && !isRenamingNode(node.key)"
                  @click="handleTreeNodeClick($event, node)"
                  @contextmenu="openNodeContextMenu($event, node)"
                  @pointerdown="beginNodeLongPress($event, node)"
                  @pointermove="handleLongPressMove"
                  @pointerup="handleLongPressEnd"
                  @pointercancel="handleLongPressEnd"
                  @dragstart="handleTreeDragStart($event, node)"
                  @dragend="handleTreeDragEnd"
                  @dragover="handleNodeDragOver($event, node)"
                  @dragleave="handleDragLeave($event, node.key)"
                  @drop="handleNodeDrop($event, node)"
                >
                  <span class="catalog-tree-node__indent" :style="{ width: `${node.depth}rem` }"></span>
                  <span
                    v-if="node.kind === 'category' && node.hasChildren"
                    class="catalog-tree-node__twist"
                    :class="{ 'catalog-tree-node__twist--open': isCategoryExpanded(node.id) }"
                    @click.stop="toggleCategoryExpanded(node.id)"
                  >
                    <span class="catalog-chevron"></span>
                  </span>
                  <span v-else class="catalog-tree-node__twist catalog-tree-node__twist--placeholder"></span>
                  <span :class="['catalog-node-icon', node.kind === 'category' ? 'catalog-node-icon--folder' : 'catalog-node-icon--item']"></span>
                  <input
                    v-if="isCreatingNode(node.key)"
                    :ref="setRenameInputRef"
                    v-model="createState.value"
                    type="text"
                    class="catalog-tree-node__rename"
                    @click.stop
                    @blur="saveInlineCreate"
                    @keydown.enter.prevent="saveInlineCreate"
                    @keydown.esc.prevent="cancelInlineCreate"
                  />
                  <input
                    v-else-if="isRenamingNode(node.key)"
                    :ref="setRenameInputRef"
                    v-model="renameState.value"
                    type="text"
                    class="catalog-tree-node__rename"
                    @click.stop
                    @blur="saveInlineRename"
                    @keydown.enter.prevent="saveInlineRename"
                    @keydown.esc.prevent="cancelRename"
                  />
                  <span v-else class="catalog-tree-node__label">{{ node.label }}</span>
                  <span
                    v-if="node.kind === 'category' && node.secondary && !isCreatingNode(node.key) && !isRenamingNode(node.key)"
                    class="catalog-tree-node__meta"
                  >
                    {{ node.secondary }}
                  </span>
                  <span v-if="!node.active" class="catalog-tree-node__state">Archived</span>
                </button>
              </div>

              <div v-if="treeNodes.length === 0" class="catalog-pane__empty">
                No folders or items match your search.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="catalog-inspector-pane" class="catalog-inspector-pane">
        <template v-if="isRootInspector">
          <header class="catalog-pane__header">
            <div>
              <span class="catalog-pane__eyebrow">Inspector</span>
              <h2 class="catalog-pane__title">Shop Catalog</h2>
            </div>
          </header>

          <div class="catalog-inspector-pane__body">
            <section class="catalog-inspector-card">
              <strong>Overview</strong>
              <span>{{ categories.filter((category) => isVisibleByArchive(category.active)).length }} folders visible</span>
              <span>{{ items.filter((item) => isVisibleByArchive(item.active)).length }} items visible</span>
            </section>

            <section class="catalog-inspector-card">
              <strong>Adding Entries</strong>
              <span>Right-click a folder or the empty catalog area to open actions.</span>
              <span>On touch devices, press and hold to open the same menu.</span>
            </section>
          </div>
        </template>

        <template v-else-if="isCreateCategoryMode">
          <header class="catalog-pane__header">
            <div>
              <span class="catalog-pane__eyebrow">Create</span>
              <h2 class="catalog-pane__title">New Folder</h2>
            </div>
          </header>

          <div class="catalog-inspector-pane__body">
            <form class="catalog-form" @submit.prevent="handleCreateCategory">
              <label class="catalog-form__field">
                <span>Folder Name</span>
                <input v-model="createCategoryForm.name" type="text" autocomplete="off" />
              </label>

              <label class="catalog-form__field">
                <span>Parent Folder</span>
                <select v-model="createCategoryForm.parentId" class="app-select">
                  <option :value="null">Top Level</option>
                  <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="catalog-toggle-row">
                <input v-model="createCategoryForm.active" type="checkbox" />
                <span>Active Folder</span>
              </label>

              <button class="app-button app-button--primary" :disabled="createLoading" type="submit">
                {{ createLoading ? 'Creating...' : 'Create Folder' }}
              </button>
            </form>
          </div>
        </template>

        <template v-else-if="isCreateItemMode">
          <header class="catalog-pane__header">
            <div>
              <span class="catalog-pane__eyebrow">Create</span>
              <h2 class="catalog-pane__title">New Item</h2>
            </div>
          </header>

          <div class="catalog-inspector-pane__body">
            <form class="catalog-form" @submit.prevent="handleCreateItem">
              <label class="catalog-form__field">
                <span>Description</span>
                <input v-model="createItemForm.description" type="text" autocomplete="off" />
              </label>

              <label class="catalog-form__field">
                <span>Folder</span>
                <select v-model="createItemForm.categoryId" class="app-select">
                  <option :value="null">Top Level</option>
                  <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="catalog-form__field">
                <span>SKU</span>
                <input v-model="createItemForm.sku" type="text" autocomplete="off" />
              </label>

              <label class="catalog-form__field">
                <span>Price</span>
                <input
                  :value="createItemForm.price"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="$0.00"
                  @input="handlePriceInput(createItemForm, $event)"
                  @focus="handlePriceFocus(createItemForm)"
                  @blur="handlePriceBlur(createItemForm)"
                />
              </label>

              <label class="catalog-toggle-row">
                <input v-model="createItemForm.active" type="checkbox" />
                <span>Active Item</span>
              </label>

              <button class="app-button app-button--primary" :disabled="createLoading" type="submit">
                {{ createLoading ? 'Creating...' : 'Create Item' }}
              </button>
            </form>
          </div>
        </template>

        <template v-else-if="selectedCategory">
          <header class="catalog-pane__header">
            <div>
              <span class="catalog-pane__eyebrow">Folder</span>
              <h2 class="catalog-pane__title">{{ getCategoryDisplayName(selectedCategory) }}</h2>
            </div>
          </header>

          <div class="catalog-inspector-pane__body">
            <form class="catalog-form" @submit.prevent="handleSaveCategory">
              <label class="catalog-form__field">
                <span>Folder Name</span>
                <input v-model="detailCategoryForm.name" type="text" autocomplete="off" />
              </label>

              <label class="catalog-form__field">
                <span>Parent Folder</span>
                <select v-model="detailCategoryForm.parentId" class="app-select">
                  <option :value="null">Top Level</option>
                  <option v-for="option in detailCategoryParentOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="catalog-toggle-row">
                <input v-model="detailCategoryForm.active" type="checkbox" />
                <span>Active Folder</span>
              </label>

              <section class="catalog-inspector-card">
                <strong>Path</strong>
                <span>{{ getCategoryPath(selectedCategory.parentId) }}</span>
                <span>{{ formatFolderItemSummary(getDirectChildCategoryCount(selectedCategory.id), getDirectChildItemCount(selectedCategory.id)) || 'No direct contents' }}</span>
              </section>

              <div class="catalog-inspector-pane__actions">
                <button class="app-button app-button--primary" :disabled="saveLoading" type="submit">
                  {{ saveLoading ? 'Saving...' : 'Save Changes' }}
                </button>
                <button class="app-button" :disabled="saveLoading" type="button" @click="handleArchiveCategory(!selectedCategory.active)">
                  {{ selectedCategory.active ? 'Archive Folder' : 'Restore Folder' }}
                </button>
                <button
                  class="app-button catalog-inspector-pane__danger"
                  :disabled="deleteLoading || selectedCategoryHasChildren"
                  type="button"
                  @click="handleDeleteCategory"
                >
                  {{ deleteLoading ? 'Deleting...' : 'Delete Folder' }}
                </button>
              </div>
            </form>
          </div>
        </template>

        <template v-else-if="selectedItem">
          <header class="catalog-pane__header">
            <div>
              <span class="catalog-pane__eyebrow">Item</span>
              <h2 class="catalog-pane__title">{{ getItemDisplayName(selectedItem) }}</h2>
            </div>
          </header>

          <div class="catalog-inspector-pane__body">
            <form class="catalog-form" @submit.prevent="handleSaveItem">
              <label class="catalog-form__field">
                <span>Description</span>
                <input v-model="detailItemForm.description" type="text" autocomplete="off" />
              </label>

              <label class="catalog-form__field">
                <span>SKU</span>
                <input v-model="detailItemForm.sku" type="text" autocomplete="off" />
              </label>

              <label class="catalog-form__field">
                <span>Price</span>
                <input
                  :value="detailItemForm.price"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  placeholder="$0.00"
                  @input="handlePriceInput(detailItemForm, $event)"
                  @focus="handlePriceFocus(detailItemForm)"
                  @blur="handlePriceBlur(detailItemForm)"
                />
              </label>

              <label class="catalog-toggle-row">
                <input v-model="detailItemForm.active" type="checkbox" />
                <span>Active Item</span>
              </label>

              <section class="catalog-inspector-card">
                <strong>Path</strong>
                <span>{{ selectedItem.categoryId ? getCategoryPath(selectedItem.categoryId) : 'Top Level' }}</span>
                <span>{{ selectedItem.sku ? `SKU ${selectedItem.sku}` : 'No SKU' }}</span>
                <span>{{ formatPriceLabel(selectedItem.price) }}</span>
              </section>

              <div class="catalog-inspector-pane__actions">
                <button class="app-button app-button--primary" :disabled="saveLoading" type="submit">
                  {{ saveLoading ? 'Saving...' : 'Save Changes' }}
                </button>
                <button class="app-button" :disabled="saveLoading" type="button" @click="handleArchiveItem(!selectedItem.active)">
                  {{ selectedItem.active ? 'Archive Item' : 'Restore Item' }}
                </button>
                <button
                  class="app-button catalog-inspector-pane__danger"
                  :disabled="deleteLoading"
                  type="button"
                  @click="handleDeleteItem"
                >
                  {{ deleteLoading ? 'Deleting...' : 'Delete Item' }}
                </button>
              </div>
            </form>
          </div>
        </template>
      </section>

      <div
        v-if="contextMenu.visible"
        class="catalog-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        @pointerdown.stop
        @contextmenu.prevent
      >
        <button
          v-for="action in contextMenuActions"
          :key="action.key"
          type="button"
          class="catalog-context-menu__item"
          :class="{ 'catalog-context-menu__item--danger': action.danger }"
          :disabled="action.disabled"
          @click="action.run()"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.catalog-explorer {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(420px, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.catalog-explorer__mobile-nav {
  display: none;
}

.catalog-explorer__mobile-nav {
  gap: 0.7rem;
}

.catalog-explorer__mobile-toggle {
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.catalog-explorer__mobile-toggle {
  display: inline-flex;
  flex: 1 1 0;
}

.catalog-explorer__mobile-toggle:hover {
  border-color: rgba(88, 186, 233, 0.24);
  background: rgba(33, 73, 97, 0.22);
  color: var(--text);
}

.catalog-explorer__mobile-toggle--active {
  border-color: rgba(88, 186, 233, 0.26);
  background: rgba(33, 73, 97, 0.32);
  color: var(--text);
}

.catalog-tree-pane,
.catalog-inspector-pane {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
  grid-template-rows: auto minmax(0, 1fr);
}

.catalog-tree-pane__body,
.catalog-inspector-pane__body {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  align-content: start;
}

.catalog-inspector-pane__body {
  overflow: auto;
  padding-right: 0.15rem;
}

.catalog-pane__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.catalog-tree-pane__header {
  align-items: center;
}

.catalog-pane__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.catalog-pane__title {
  margin: 0.25rem 0 0;
  font-size: 1.2rem;
}

.catalog-pane__search input,
.catalog-form__field input {
  width: 100%;
  min-height: 2.55rem;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
}

.catalog-form__field .app-select {
  --app-select-min-height: 2.55rem;
  --app-select-padding-x: 0.85rem;
  --app-select-background: rgba(255, 255, 255, 0.045);
}

.catalog-tree-pane__actions,
.catalog-inspector-pane__actions,
.catalog-toggle-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.catalog-tree-pane__list {
  color: var(--text-soft);
  display: grid;
  gap: 0.08rem;
  min-height: 0;
  overflow: auto;
  padding: 0.15rem 0.2rem 0.2rem;
  border-radius: 10px;
}

.catalog-tree-pane__list--drop-target {
  background: rgba(45, 106, 140, 0.12);
  box-shadow: inset 0 0 0 1px rgba(88, 186, 233, 0.18);
}

.catalog-tree {
  display: grid;
  gap: 0.08rem;
  min-width: 100%;
}

.catalog-tree__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.catalog-tree-node {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 2.2rem;
  padding: 0 0.45rem;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.catalog-tree-node:hover,
.catalog-tree-node--active {
  border-color: rgba(88, 186, 233, 0.18);
  background: rgba(30, 73, 97, 0.2);
}

.catalog-tree-node--drop-target {
  border-color: rgba(88, 186, 233, 0.34);
  background: rgba(45, 106, 140, 0.28);
  box-shadow: inset 0 0 0 1px rgba(88, 186, 233, 0.14);
}

.catalog-tree-node--dragging {
  opacity: 0.54;
}

.catalog-tree-node__indent {
  flex: 0 0 auto;
  width: 0;
}

.catalog-tree-node__twist {
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

.catalog-tree-node__twist:hover {
  color: var(--text);
}

.catalog-tree-node__twist--placeholder {
  opacity: 0;
  pointer-events: none;
}

.catalog-chevron {
  width: 0.45rem;
  height: 0.45rem;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(-45deg);
  transition: transform 0.18s ease;
}

.catalog-tree-node__twist--open .catalog-chevron {
  transform: rotate(45deg);
}

.catalog-node-icon {
  position: relative;
  display: inline-flex;
  width: 0.95rem;
  height: 0.8rem;
  flex: 0 0 auto;
}

.catalog-node-icon--folder::before,
.catalog-node-icon--folder::after,
.catalog-node-icon--item::before {
  content: "";
  position: absolute;
  box-sizing: border-box;
}

.catalog-node-icon--folder::before {
  left: 0;
  top: 0.18rem;
  width: 0.95rem;
  height: 0.58rem;
  border: 1px solid rgba(123, 197, 241, 0.55);
  border-radius: 0.18rem;
  background: rgba(50, 108, 145, 0.18);
}

.catalog-node-icon--folder::after {
  left: 0.08rem;
  top: 0;
  width: 0.38rem;
  height: 0.24rem;
  border: 1px solid rgba(123, 197, 241, 0.55);
  border-bottom: none;
  border-radius: 0.18rem 0.18rem 0 0;
  background: rgba(50, 108, 145, 0.18);
}

.catalog-node-icon--item::before {
  left: 0.08rem;
  top: 0.02rem;
  width: 0.72rem;
  height: 0.76rem;
  border: 1px solid rgba(193, 208, 225, 0.36);
  border-radius: 0.12rem;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 -0.16rem 0 rgba(88, 186, 233, 0.1);
}

.catalog-tree-node__label {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.92rem;
}

.catalog-tree-node--root .catalog-tree-node__label {
  font-weight: 700;
}

.catalog-tree-node__meta {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 0.76rem;
  white-space: nowrap;
}

.catalog-tree-node__rename {
  min-width: 0;
  width: 100%;
  height: 1.9rem;
  padding: 0 0.45rem;
  border: 1px solid rgba(88, 186, 233, 0.24);
  border-radius: 8px;
  background: rgba(21, 36, 48, 0.96);
  color: var(--text);
  outline: none;
}

.catalog-tree-node__rename:focus {
  border-color: rgba(88, 186, 233, 0.42);
  box-shadow: 0 0 0 1px rgba(88, 186, 233, 0.18);
}

.catalog-tree-node__state,
.catalog-entry__badge,
.catalog-entry__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.55rem;
  padding: 0 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.catalog-tree-node__state,
.catalog-entry__status {
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--text-soft);
}

.catalog-pane__empty,
.catalog-inspector-card span {
  color: var(--text-muted);
  font-size: 0.88rem;
}

.catalog-form {
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.catalog-form__field {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
}

.catalog-form__field span,
.catalog-toggle-row span {
  font-size: 0.9rem;
}

.catalog-toggle-row {
  align-items: center;
  color: var(--text-muted);
}

.catalog-toggle-row--compact {
  gap: 0.45rem;
  padding: 0 0.2rem;
}

.catalog-toggle-row--compact span {
  font-size: 0.82rem;
  letter-spacing: 0.02em;
}

.catalog-toggle-row input {
  margin-top: 0.1rem;
  accent-color: var(--accent-strong);
}

.catalog-inspector-card {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.catalog-inspector-pane__danger {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.catalog-pane__note {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
}

.catalog-pane__note--error {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.catalog-pane__note--success {
  border-color: rgba(103, 213, 157, 0.24);
  color: var(--success);
}

.catalog-pane__empty {
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

.catalog-context-menu {
  position: fixed;
  z-index: 30;
  display: grid;
  gap: 0.2rem;
  min-width: 13rem;
  padding: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0)),
    rgba(28, 36, 46, 0.98);
  box-shadow: 0 18px 34px rgba(4, 9, 15, 0.38);
  backdrop-filter: blur(10px);
}

.catalog-context-menu__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 2.2rem;
  padding: 0 0.7rem;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  color: var(--text);
  text-align: left;
}

.catalog-context-menu__item:hover:not(:disabled) {
  border-color: rgba(88, 186, 233, 0.18);
  background: rgba(34, 79, 104, 0.22);
}

.catalog-context-menu__item:disabled {
  color: var(--text-soft);
  opacity: 0.55;
}

.catalog-context-menu__item--danger {
  color: var(--danger);
}

.catalog-context-menu__item--danger:hover:not(:disabled) {
  border-color: rgba(255, 125, 107, 0.18);
  background: rgba(108, 48, 44, 0.2);
}

@media (max-width: 1440px) {
  .catalog-explorer {
    grid-template-columns: minmax(360px, 1fr) minmax(360px, 1fr);
  }
}

@media (max-width: 1180px) {
  .catalog-explorer {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
    align-content: start;
  }

  .catalog-explorer__mobile-nav {
    display: flex;
  }

  .catalog-tree-pane,
  .catalog-inspector-pane {
    height: auto;
    overflow: visible;
  }

  .catalog-tree-pane__body,
  .catalog-inspector-pane__body {
    overflow: visible;
  }

  .catalog-tree-pane__list {
    overflow-x: auto;
    overflow-y: visible;
    -webkit-overflow-scrolling: touch;
  }

  .catalog-tree {
    width: 100%;
    min-width: 100%;
  }

  .catalog-tree__row {
    width: 100%;
  }

  .catalog-tree-node {
    width: max-content;
    min-width: 100%;
  }

  .catalog-tree-node__label {
    min-width: max-content;
    overflow: visible;
    text-overflow: clip;
  }

  .catalog-tree-pane {
    max-height: none;
  }

  .catalog-tree-pane__header {
    align-items: flex-start;
  }

  .catalog-tree-pane__actions,
  .catalog-inspector-pane__actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .catalog-explorer--mobile-catalog .catalog-inspector-pane {
    display: none;
  }

  .catalog-explorer--mobile-inspector .catalog-tree-pane {
    display: none;
  }
}

@media (max-width: 820px) {
  .catalog-pane__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
