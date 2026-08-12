<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { usePendingActionMap } from '@/composables/usePendingActionMap'
import { useWindowEventListener } from '@/composables/useWindowEventListener'
import {
  formatShopCatalogFolderItemSummary as formatFolderItemSummary,
  getShopCategoryDisplayName as getCategoryDisplayName,
  normalizeShopCatalogSearch as normalizeSearch,
} from '@/features/shopCatalog/catalogDisplayHelpers'
import {
  useShopCatalogContextMenu,
  type ShopCatalogContextMenuTarget as ContextMenuTarget,
} from '@/features/shopCatalog/useShopCatalogContextMenu'
import {
  buildShopOrderCatalogTreeNodes,
  type ShopOrderCatalogRootNode,
  type ShopOrderCatalogTreeNode as TreeNode,
} from '@/features/shopOrders/catalogBrowserHelpers'
import AppPane from '@/components/common/AppPane.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import ShopOrderCatalogTree from './ShopOrderCatalogTree.vue'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

interface ContextMenuAction {
  key: string
  label: string
  disabled?: boolean
  run: () => void | Promise<void>
}

const props = withDefaults(defineProps<{
  addCatalogItem: (item: ShopCatalogItemRecord, quantity: number) => Promise<boolean> | boolean
  catalogItems: readonly ShopCatalogItemRecord[]
  categories: readonly ShopCategoryRecord[]
  disabled?: boolean
  loading?: boolean
}>(), {
  disabled: false,
  loading: false,
})

const treeSearch = ref('')
const activeFolderId = ref<string | null>(null)
const selectedCatalogItemId = ref<string | null>(null)
const rootBucketExpanded = ref(true)
const rootBucketCollapsedDuringSearch = ref(false)
const expandedCategoryIds = ref<string[]>([])
const collapsedCategoryIdsDuringSearch = ref<string[]>([])
const catalogItemQuantities = reactive<Record<string, string>>({})
const { closeContextMenu, contextMenu, openContextMenu } = useShopCatalogContextMenu()
const {
  isActionPending: isCatalogItemAddPending,
  pendingKeys: pendingCatalogItemAddKeys,
  runWithPendingAction: runWithPendingCatalogItemAdd,
} = usePendingActionMap()

let treeInitialized = false

const categoriesById = computed(() => new Map(props.categories.map((category) => [category.id, category])))
const catalogItemsById = computed(() => new Map(props.catalogItems.map((item) => [item.id, item])))

const childCategoriesByParent = computed(() => {
  const map = new Map<string | null, ShopCategoryRecord[]>()

  for (const category of props.categories) {
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

  for (const item of props.catalogItems) {
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

const activeCategoryCount = computed(() => props.categories.filter((category) => category.active).length)
const activeItemCount = computed(() => props.catalogItems.filter((item) => item.active).length)
const normalizedTreeSearch = computed(() => normalizeSearch(treeSearch.value))
const isTreeSearchActive = computed(() => normalizedTreeSearch.value.length > 0)
const rootBucketEffectivelyExpanded = computed(() =>
  isTreeSearchActive.value ? !rootBucketCollapsedDuringSearch.value : rootBucketExpanded.value,
)
const rootBucketHasChildren = computed(() => hasVisibleChildren(null))
const rootBucketSummary = computed(() =>
  formatFolderItemSummary(
    getVisibleChildCategoryCount(null),
    getVisibleChildItemCount(null),
  ),
)
const rootTreeNode = computed<ShopOrderCatalogRootNode>(() => ({
  key: 'root' as const,
  kind: 'root' as const,
  depth: 0 as const,
  label: 'Top Level',
  secondary: rootBucketSummary.value,
  hasChildren: rootBucketHasChildren.value,
}))
const treeListCollapsed = computed(
  () => !props.loading && !rootBucketEffectivelyExpanded.value && treeNodes.value.length === 0,
)
const treeNodes = computed<TreeNode[]>(() => {
  if (!rootBucketEffectivelyExpanded.value) return []
  return buildShopOrderCatalogTreeNodes({
    treeSearch: treeSearch.value,
    expandedCategoryIds: expandedCategoryIds.value,
    collapsedCategoryIdsDuringSearch: collapsedCategoryIdsDuringSearch.value,
    categoriesById: categoriesById.value,
    childCategoriesByParent: childCategoriesByParent.value,
    childItemsByParent: childItemsByParent.value,
    getCategoryPath,
  })
})
const effectivelyExpandedCategoryIds = computed(() =>
  treeNodes.value
    .filter((node) => node.kind === 'category' && isCategoryEffectivelyExpanded(node.id))
    .map((node) => node.id),
)
const pendingCatalogItemAddIds = computed(() => Object.keys(pendingCatalogItemAddKeys))

const contextMenuActions = computed<ContextMenuAction[]>(() => {
  const target = contextMenu.target
  const visibleCategoryIds = getVisibleCategoryIds()
  const hasVisibleCategories = visibleCategoryIds.length > 0
  const allVisibleCategoriesExpanded =
    rootBucketEffectivelyExpanded.value
    && (!hasVisibleCategories || visibleCategoryIds.every((categoryId) => isCategoryEffectivelyExpanded(categoryId)))
  const anyFoldersExpanded =
    rootBucketEffectivelyExpanded.value
    || visibleCategoryIds.some((categoryId) => isCategoryEffectivelyExpanded(categoryId))

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
        disabled: props.disabled || isCatalogItemAddPending(target.id),
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

function readQuantity(value: string | number | null | undefined) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.round(parsed)
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

function hasVisibleChildren(categoryId: string | null) {
  const visibleCategories = (childCategoriesByParent.value.get(categoryId) ?? []).some((category) => category.active)
  if (visibleCategories) return true

  return (childItemsByParent.value.get(categoryId) ?? []).some((item) => item.active)
}

function isCategoryExpanded(categoryId: string) {
  return expandedCategoryIds.value.includes(categoryId)
}

function isCategoryCollapsedDuringSearch(categoryId: string) {
  return collapsedCategoryIdsDuringSearch.value.includes(categoryId)
}

function isCategoryEffectivelyExpanded(categoryId: string) {
  if (isTreeSearchActive.value) {
    return !isCategoryCollapsedDuringSearch(categoryId)
  }

  return isCategoryExpanded(categoryId)
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
  if (isTreeSearchActive.value) {
    if (isCategoryCollapsedDuringSearch(categoryId)) {
      collapsedCategoryIdsDuringSearch.value = collapsedCategoryIdsDuringSearch.value.filter((id) => id !== categoryId)
      return
    }

    collapsedCategoryIdsDuringSearch.value = [...collapsedCategoryIdsDuringSearch.value, categoryId]
    return
  }

  if (isCategoryExpanded(categoryId)) {
    expandedCategoryIds.value = expandedCategoryIds.value.filter((id) => id !== categoryId)
    return
  }

  expandedCategoryIds.value = [...expandedCategoryIds.value, categoryId]
}

function toggleRootBucketExpanded() {
  if (isTreeSearchActive.value) {
    rootBucketCollapsedDuringSearch.value = !rootBucketCollapsedDuringSearch.value
    return
  }

  rootBucketExpanded.value = !rootBucketExpanded.value
}

function selectRoot() {
  activeFolderId.value = null
  selectedCatalogItemId.value = null
}

function handleRootSelection() {
  selectRoot()
  toggleRootBucketExpanded()
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

  const item = props.catalogItems.find((entry) => entry.id === node.id)
  if (item) {
    inspectCatalogItem(item)
  }
}

async function handleTreeItemAdd(itemId: string) {
  if (props.disabled || isCatalogItemAddPending(itemId)) return

  const item = catalogItemsById.value.get(itemId)
  if (!item) return

  const quantity = readQuantity(catalogItemQuantities[item.id] ?? '1')
  const saved = await runWithPendingCatalogItemAdd(itemId, () => props.addCatalogItem(item, quantity))
  if (saved) {
    catalogItemQuantities[item.id] = '1'
    inspectCatalogItem(item)
  }
}

function handleTreeQuantityUpdate(itemId: string, value: string) {
  catalogItemQuantities[itemId] = value
}

function getVisibleCategoryIds() {
  return props.categories.filter((category) => category.active).map((category) => category.id)
}

function expandAllCategories() {
  rootBucketExpanded.value = true
  rootBucketCollapsedDuringSearch.value = false
  expandedCategoryIds.value = getVisibleCategoryIds()
  collapsedCategoryIdsDuringSearch.value = []
  closeContextMenu()
}

function collapseAllCategories() {
  if (isTreeSearchActive.value) {
    rootBucketCollapsedDuringSearch.value = true
    collapsedCategoryIdsDuringSearch.value = getVisibleCategoryIds()
    closeContextMenu()
    return
  }

  rootBucketExpanded.value = false
  expandedCategoryIds.value = []
  closeContextMenu()
}

function handleContextMenuAction(action: ContextMenuAction) {
  if (action.disabled) return
  void action.run()
}

function handleContextMenuActionKey(actionKey: string) {
  const action = contextMenuActions.value.find((entry) => entry.key === actionKey)
  if (action) {
    handleContextMenuAction(action)
  }
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

watch(
  () => normalizedTreeSearch.value,
  () => {
    rootBucketCollapsedDuringSearch.value = false
    collapsedCategoryIdsDuringSearch.value = []
  },
)

watch(
  () => props.categories,
  (nextCategories) => {
    if (treeInitialized) return
    expandedCategoryIds.value = nextCategories
      .filter((category) => category.active && category.parentId === null)
      .map((category) => category.id)
    treeInitialized = true
  },
  { immediate: true },
)

useWindowEventListener('pointerdown', handleGlobalPointerDown)
useWindowEventListener('keydown', handleGlobalKeydown)
</script>

<template>
  <AppPane class="shop-orders-tree-pane">
    <AppPaneHeader
      class="shop-orders-pane__header shop-orders-tree-pane__header"
      eyebrow="Catalog Browser"
      title="Shop Orders"
    >
      <template #actions>
        <div class="shop-orders-tree-pane__summary">
          <span>{{ activeCategoryCount }} folders</span>
          <span>{{ activeItemCount }} items</span>
        </div>
      </template>
    </AppPaneHeader>

    <div class="shop-orders-tree-pane__body">
      <label class="shop-orders-pane__search">
        <span>Find catalog entries</span>
        <AppSearchInput
          v-model="treeSearch"
          data-testid="shoporder-catalog-search"
          placeholder="Search folders or items"
        />
      </label>

      <ShopOrderCatalogTree
        :active-folder-id="activeFolderId"
        :context-menu="contextMenu"
        :context-menu-actions="contextMenuActions"
        :disabled="disabled"
        :expanded-category-ids="effectivelyExpandedCategoryIds"
        :list-collapsed="treeListCollapsed"
        :loading="loading"
        :nodes="treeNodes"
        :pending-item-ids="pendingCatalogItemAddIds"
        :quantities="catalogItemQuantities"
        :root-expanded="rootBucketEffectivelyExpanded"
        :root-has-children="rootBucketHasChildren"
        :root-node="rootTreeNode"
        :search-active="normalizedTreeSearch.length > 0"
        :selected-catalog-item-id="selectedCatalogItemId"
        @context-action="handleContextMenuActionKey"
        @item-add="handleTreeItemAdd"
        @node-context-menu="openNodeContextMenu"
        @node-select="handleTreeNodeSelection"
        @node-toggle="toggleCategoryExpanded($event.id)"
        @root-context-menu="openRootContextMenu"
        @root-select="handleRootSelection"
        @root-toggle="toggleRootBucketExpanded"
        @update-quantity="handleTreeQuantityUpdate"
      />

      <slot />
    </div>
  </AppPane>
</template>

<style scoped>
.shop-orders-tree-pane {
  --app-pane-grid-template-rows: auto minmax(0, 1fr);
  --app-pane-gap: 0.65rem;
  --app-pane-padding: 0.75rem;
  --app-pane-border: 1px solid var(--shop-line);
  --app-pane-background:
    radial-gradient(circle at top right, rgba(99, 199, 230, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.032), rgba(255, 255, 255, 0.006)),
    rgba(24, 36, 48, 0.9);
  --app-pane-shadow: var(--shadow-soft);
  --app-pane-header-eyebrow-font-size: 0.64rem;
  --app-pane-header-eyebrow-letter-spacing: 0.14em;
  --app-pane-header-title-margin: 0.18rem 0 0;
  --app-pane-header-title-font-size: 1.08rem;
  min-width: 0;
}

.shop-orders-tree-pane__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.shop-orders-pane__header {
  min-width: 0;
  padding-bottom: 0.32rem;
  border-bottom: 1px solid var(--shop-line-soft);
}

.shop-orders-tree-pane__header {
  align-items: center;
}

.shop-orders-pane__header :deep(.app-pane-header__copy),
.shop-orders-pane__header :deep(.app-pane-header__title) {
  min-width: 0;
}

.shop-orders-pane__header :deep(.app-pane-header__title) {
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shop-orders-tree-pane__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.32rem 0.55rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.shop-orders-pane__search {
  --app-search-input-min-height: var(--shop-control-height);
  --app-search-input-padding-x: 0.8rem;
  --app-search-input-border: var(--shop-line);
  --app-search-input-radius: var(--shop-radius-md);
  --app-search-input-background: var(--shop-field);
  --app-search-input-box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 5px 12px rgba(3, 10, 16, 0.08);
  display: grid;
  gap: 0.28rem;
  color: var(--text-muted);
}

.shop-orders-pane__search > span {
  color: var(--text-soft);
  font-size: 0.74rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 1180px) {
  .shop-orders-tree-pane {
    max-height: 34rem;
  }
}

@media (max-width: 820px) {
  .shop-orders-tree-pane {
    --app-pane-height: auto;
    --app-pane-grid-template-rows: auto auto;
    --app-pane-overflow: visible;
    max-height: none;
  }

  .shop-orders-tree-pane__body {
    overflow: visible;
  }

  .shop-orders-pane__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
