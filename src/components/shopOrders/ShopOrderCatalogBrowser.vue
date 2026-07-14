<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
  type ShopOrderCatalogTreeNode as TreeNode,
} from '@/features/shopOrders/catalogBrowserHelpers'
import AppSearchInput from '@/components/common/AppSearchInput.vue'
import ShopOrderCatalogTreeNodeRow from './ShopOrderCatalogTreeNodeRow.vue'
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
const rootTreeNode = computed(() => ({
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
      disabled: props.disabled,
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
  const item = catalogItemsById.value.get(itemId)
  if (!item) return

  const quantity = readQuantity(catalogItemQuantities[item.id] ?? '1')
  const saved = await props.addCatalogItem(item, quantity)
  if (saved) {
    catalogItemQuantities[item.id] = '1'
    inspectCatalogItem(item)
  }
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
  <section class="shop-orders-tree-pane">
    <header class="shop-orders-pane__header shop-orders-tree-pane__header">
      <div>
        <span class="shop-orders-pane__eyebrow">Catalog Browser</span>
        <h1 class="shop-orders-pane__title">Shop Orders</h1>
      </div>
      <div class="shop-orders-tree-pane__summary">
        <span>{{ activeCategoryCount }} folders</span>
        <span>{{ activeItemCount }} items</span>
      </div>
    </header>

    <div class="shop-orders-tree-pane__body">
      <label class="shop-orders-pane__search">
        <span>Find catalog entries</span>
        <AppSearchInput
          v-model="treeSearch"
          data-testid="shoporder-catalog-search"
          placeholder="Search folders or items"
        />
      </label>

      <div
        class="shop-orders-tree-pane__list"
        :class="{ 'shop-orders-tree-pane__list--collapsed': treeListCollapsed }"
      >
        <ShopOrderCatalogTreeNodeRow
          :active="activeFolderId === null && !selectedCatalogItemId"
          :expanded="rootBucketEffectivelyExpanded"
          :node="rootTreeNode"
          @context-menu="openRootContextMenu"
          @select="handleRootSelection"
          @toggle="toggleRootBucketExpanded"
        />

        <div v-if="loading" class="shop-orders-pane__empty">
          Loading catalog...
        </div>

        <div
          v-else-if="treeNodes.length === 0 && (!rootBucketHasChildren || normalizedTreeSearch)"
          class="shop-orders-pane__empty"
        >
          No catalog entries match this view.
        </div>

        <div v-else class="shop-orders-tree">
          <ShopOrderCatalogTreeNodeRow
            v-for="node in treeNodes"
            :key="node.key"
            :active="node.kind === 'category'
              ? activeFolderId === node.id && !selectedCatalogItemId
              : selectedCatalogItemId === node.id"
            :disabled="disabled"
            :expanded="node.kind === 'category' ? isCategoryEffectivelyExpanded(node.id) : false"
            :node="node"
            :quantity="node.kind === 'item' ? catalogItemQuantities[node.id] ?? '1' : '1'"
            @add="handleTreeItemAdd(node.id)"
            @context-menu="openNodeContextMenu($event, node)"
            @select="handleTreeNodeSelection(node)"
            @toggle="node.kind === 'category' ? toggleCategoryExpanded(node.id) : undefined"
            @update-quantity="catalogItemQuantities[node.id] = $event"
          />
        </div>
      </div>

      <slot />
    </div>

    <div
      v-if="contextMenu.visible"
      class="shop-orders-context-menu"
      data-testid="shoporder-context-menu"
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
        :data-testid="`shoporder-context-${action.key}`"
        :disabled="action.disabled"
        @pointerdown.stop.prevent
        @click.stop.prevent="handleContextMenuAction(action)"
      >
        {{ action.label }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.shop-orders-tree-pane {
  display: grid;
  gap: 0.65rem;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 0.75rem;
  border: 1px solid var(--shop-line);
  border-radius: var(--radius);
  background:
    radial-gradient(circle at top right, rgba(99, 199, 230, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.032), rgba(255, 255, 255, 0.006)),
    rgba(24, 36, 48, 0.9);
  box-shadow: var(--shadow-soft);
  grid-template-rows: auto minmax(0, 1fr);
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
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
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

.shop-orders-tree-pane__list {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 0;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.15rem;
}

.shop-orders-tree-pane__list--collapsed {
  flex: 0 0 auto;
  overflow: visible;
}

.shop-orders-tree {
  display: grid;
  gap: 0.08rem;
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
    linear-gradient(180deg, rgba(33, 48, 61, 0.98), rgba(18, 28, 38, 0.98)),
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
  background: rgba(99, 199, 230, 0.14);
}

.shop-orders-context-menu__item:disabled {
  opacity: 0.45;
  cursor: default;
}

.shop-orders-pane__empty {
  display: grid;
  place-content: center;
  min-height: 8.5rem;
  padding: 0.85rem;
  border: 1px dashed rgba(140, 162, 186, 0.1);
  border-radius: 12px;
  color: var(--text-muted);
  text-align: center;
}

@media (max-width: 1180px) {
  .shop-orders-tree-pane {
    max-height: 34rem;
  }
}

@media (max-width: 820px) {
  .shop-orders-pane__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
