<script setup lang="ts">
import { computed } from 'vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import ShopOrderCatalogTreeNodeRow from './ShopOrderCatalogTreeNodeRow.vue'
import type {
  ShopOrderCatalogRootNode,
  ShopOrderCatalogTreeNode,
} from '@/features/shopOrders/catalogBrowserHelpers'

interface ContextMenuAction {
  key: string
  label: string
  disabled?: boolean
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
}

const props = withDefaults(defineProps<{
  activeFolderId?: string | null
  contextMenu?: ContextMenuState
  contextMenuActions?: readonly ContextMenuAction[]
  disabled?: boolean
  expandedCategoryIds?: readonly string[]
  listCollapsed?: boolean
  loading?: boolean
  nodes: readonly ShopOrderCatalogTreeNode[]
  pendingItemIds?: readonly string[]
  quantities?: Readonly<Record<string, string>>
  rootExpanded?: boolean
  rootHasChildren?: boolean
  rootNode: ShopOrderCatalogRootNode
  searchActive?: boolean
  selectedCatalogItemId?: string | null
}>(), {
  activeFolderId: null,
  contextMenu: () => ({ visible: false, x: 0, y: 0 }),
  contextMenuActions: () => [],
  disabled: false,
  expandedCategoryIds: () => [],
  listCollapsed: false,
  loading: false,
  pendingItemIds: () => [],
  quantities: () => ({}),
  rootExpanded: false,
  rootHasChildren: false,
  searchActive: false,
  selectedCatalogItemId: null,
})

const emit = defineEmits<{
  contextAction: [key: string]
  itemAdd: [itemId: string]
  nodeContextMenu: [event: MouseEvent, node: ShopOrderCatalogTreeNode]
  nodeSelect: [node: ShopOrderCatalogTreeNode]
  nodeToggle: [node: ShopOrderCatalogTreeNode]
  rootContextMenu: [event: MouseEvent]
  rootSelect: []
  rootToggle: []
  updateQuantity: [itemId: string, value: string]
}>()

const rootActive = computed(() => props.activeFolderId === null && !props.selectedCatalogItemId)
const showEmptyState = computed(() =>
  !props.loading
  && props.nodes.length === 0
  && (!props.rootHasChildren || props.searchActive)
)

function isNodeActive(node: ShopOrderCatalogTreeNode) {
  return node.kind === 'category'
    ? props.activeFolderId === node.id && !props.selectedCatalogItemId
    : props.selectedCatalogItemId === node.id
}

function isItemPending(itemId: string) {
  return props.pendingItemIds.includes(itemId)
}

function isNodeDisabled(node: ShopOrderCatalogTreeNode) {
  return props.disabled || (node.kind === 'item' && isItemPending(node.id))
}

function getNodeExpanded(node: ShopOrderCatalogTreeNode) {
  return node.kind === 'category' ? props.expandedCategoryIds.includes(node.id) : false
}

function getNodeQuantity(node: ShopOrderCatalogTreeNode) {
  return node.kind === 'item' ? props.quantities[node.id] ?? '1' : '1'
}

function handleNodeToggle(node: ShopOrderCatalogTreeNode) {
  if (node.kind === 'category') {
    emit('nodeToggle', node)
  }
}

function handleItemAdd(node: ShopOrderCatalogTreeNode) {
  if (node.kind === 'item') {
    emit('itemAdd', node.id)
  }
}

function handleQuantityUpdate(node: ShopOrderCatalogTreeNode, value: string) {
  if (node.kind === 'item') {
    emit('updateQuantity', node.id, value)
  }
}
</script>

<template>
  <div
    class="shop-orders-tree-pane__list"
    :class="{ 'shop-orders-tree-pane__list--collapsed': props.listCollapsed }"
  >
    <ShopOrderCatalogTreeNodeRow
      :active="rootActive"
      :expanded="props.rootExpanded"
      :node="props.rootNode"
      @context-menu="emit('rootContextMenu', $event)"
      @select="emit('rootSelect')"
      @toggle="emit('rootToggle')"
    />

    <AppEmptyState
      v-if="props.loading"
      class="shop-orders-pane__empty"
      message="Loading catalog..."
    />

    <AppEmptyState
      v-else-if="showEmptyState"
      class="shop-orders-pane__empty"
      message="No catalog entries match this view."
    />

    <div v-else class="shop-orders-tree">
      <ShopOrderCatalogTreeNodeRow
        v-for="node in props.nodes"
        :key="node.key"
        :active="isNodeActive(node)"
        :disabled="isNodeDisabled(node)"
        :expanded="getNodeExpanded(node)"
        :node="node"
        :quantity="getNodeQuantity(node)"
        @add="handleItemAdd(node)"
        @context-menu="emit('nodeContextMenu', $event, node)"
        @select="emit('nodeSelect', node)"
        @toggle="handleNodeToggle(node)"
        @update-quantity="handleQuantityUpdate(node, $event)"
      />
    </div>
  </div>

  <div
    v-if="props.contextMenu.visible"
    class="shop-orders-context-menu"
    data-testid="shoporder-context-menu"
    :style="{ left: `${props.contextMenu.x}px`, top: `${props.contextMenu.y}px` }"
    @pointerdown.stop
    @click.stop
    @contextmenu.prevent
  >
    <button
      v-for="action in props.contextMenuActions"
      :key="action.key"
      type="button"
      class="shop-orders-context-menu__item"
      :data-testid="`shoporder-context-${action.key}`"
      :disabled="action.disabled"
      @pointerdown.stop.prevent
      @click.stop.prevent="emit('contextAction', action.key)"
    >
      {{ action.label }}
    </button>
  </div>
</template>

<style scoped>
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
</style>
