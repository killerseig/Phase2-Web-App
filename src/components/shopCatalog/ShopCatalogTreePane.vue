<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import ShopCatalogTreeFilters from '@/components/shopCatalog/ShopCatalogTreeFilters.vue'
import ShopCatalogTreeHeader from '@/components/shopCatalog/ShopCatalogTreeHeader.vue'
import ShopCatalogTreeNodeRow from '@/components/shopCatalog/ShopCatalogTreeNodeRow.vue'
import ShopCatalogTreeRootRow from '@/components/shopCatalog/ShopCatalogTreeRootRow.vue'
import type { ShopCatalogTreeNode as TreeNode } from '@/features/shopCatalog/treeTypes'

defineProps<{
  search: string
  showArchived: boolean
  catalogLoading: boolean
  selectedInspectorKey: string
  rootBucketExpanded: boolean
  rootBucketHasChildren: boolean
  rootBucketSummary: string
  treeNodes: TreeNode[]
  dragSourceKey: TreeNode['key'] | null
  dragOverKey: TreeNode['key'] | 'root' | null
  createKey: TreeNode['key'] | null
  createValue: string
  renameKey: TreeNode['key'] | null
  renameValue: string
  expandedCategoryIds: string[]
  setInputRef: (element: Element | ComponentPublicInstance | null) => void
  setListRef: (element: Element | ComponentPublicInstance | null) => void
}>()

const emit = defineEmits<{
  updateSearch: [value: string]
  updateShowArchived: [value: boolean]
  rootSurfaceClick: [event: MouseEvent]
  rootContextMenu: [event: MouseEvent]
  rootPointerDown: [event: PointerEvent]
  rootPointerMove: [event: PointerEvent]
  rootPointerUp: [event: PointerEvent]
  rootPointerCancel: [event: PointerEvent]
  treeListDragOver: [event: DragEvent]
  treeListDragLeave: [event: DragEvent]
  rootDragOver: [event: DragEvent]
  rootDragLeave: [event: DragEvent]
  rootDrop: [event: DragEvent]
  rootBucketClick: [event: MouseEvent]
  rootToggleExpanded: []
  nodeClick: [event: MouseEvent, node: TreeNode]
  nodeContextMenu: [event: MouseEvent, node: TreeNode]
  nodePointerDown: [event: PointerEvent, node: TreeNode]
  nodePointerMove: [event: PointerEvent]
  nodePointerUp: [event: PointerEvent]
  nodePointerCancel: [event: PointerEvent]
  nodeDragStart: [event: DragEvent, node: TreeNode]
  nodeDragEnd: [event: DragEvent]
  nodeDragOver: [event: DragEvent, node: TreeNode]
  nodeDragLeave: [event: DragEvent, nodeKey: TreeNode['key']]
  nodeDrop: [event: DragEvent, node: TreeNode]
  toggleCategoryExpanded: [categoryId: string]
  updateCreateValue: [value: string]
  updateRenameValue: [value: string]
  saveInlineCreate: []
  cancelInlineCreate: []
  saveInlineRename: []
  cancelRename: []
}>()

function isCreatingNode(nodeKey: TreeNode['key'], createKey: TreeNode['key'] | null) {
  return createKey === nodeKey
}

function isRenamingNode(nodeKey: TreeNode['key'], renameKey: TreeNode['key'] | null) {
  return renameKey === nodeKey
}

function isCategoryExpanded(categoryId: string, expandedCategoryIds: string[]) {
  return expandedCategoryIds.includes(categoryId)
}
</script>

<template>
  <section id="catalog-tree-pane" class="catalog-tree-pane">
    <ShopCatalogTreeHeader />

    <div class="catalog-tree-pane__body">
      <ShopCatalogTreeFilters
        :search="search"
        :show-archived="showArchived"
        @update:search="emit('updateSearch', $event)"
        @update:show-archived="emit('updateShowArchived', $event)"
      />

      <div
        :ref="setListRef"
        class="catalog-tree-pane__list"
        :class="{ 'catalog-tree-pane__list--drop-target': dragOverKey === 'root' }"
        @click.self="emit('rootSurfaceClick', $event)"
        @contextmenu="emit('rootContextMenu', $event)"
        @pointerdown.self="emit('rootPointerDown', $event)"
        @pointermove.self="emit('rootPointerMove', $event)"
        @pointerup.self="emit('rootPointerUp', $event)"
        @pointercancel.self="emit('rootPointerCancel', $event)"
        @dragover.capture="emit('treeListDragOver', $event)"
        @dragleave.capture="emit('treeListDragLeave', $event)"
        @dragover.self="emit('rootDragOver', $event)"
        @dragleave.self="emit('rootDragLeave', $event)"
        @drop.self="emit('rootDrop', $event)"
      >
        <div v-if="catalogLoading" class="catalog-pane__empty">Loading catalog...</div>

        <div v-else class="catalog-tree">
          <ShopCatalogTreeRootRow
            :active="selectedInspectorKey === 'root'"
            :drop-target="dragOverKey === 'root'"
            :expanded="rootBucketExpanded"
            :has-children="rootBucketHasChildren"
            :summary="rootBucketSummary"
            @click="emit('rootBucketClick', $event)"
            @contextmenu="emit('rootContextMenu', $event)"
            @pointerdown="emit('rootPointerDown', $event)"
            @pointermove="emit('rootPointerMove', $event)"
            @pointerup="emit('rootPointerUp', $event)"
            @pointercancel="emit('rootPointerCancel', $event)"
            @dragover="emit('rootDragOver', $event)"
            @dragleave="emit('rootDragLeave', $event)"
            @drop="emit('rootDrop', $event)"
            @toggle-expanded="emit('rootToggleExpanded')"
          />

          <ShopCatalogTreeNodeRow
            v-for="node in treeNodes"
            :key="node.key"
            :node="node"
            :active="selectedInspectorKey === node.key || createKey === node.key"
            :dragging="dragSourceKey === node.key"
            :drop-target="dragOverKey === node.key"
            :draggable="!node.draft && !isCreatingNode(node.key, createKey) && !isRenamingNode(node.key, renameKey)"
            :expanded="isCategoryExpanded(node.id, expandedCategoryIds)"
            :creating="isCreatingNode(node.key, createKey)"
            :renaming="isRenamingNode(node.key, renameKey)"
            :create-value="createValue"
            :rename-value="renameValue"
            :set-input-ref="setInputRef"
            @click="emit('nodeClick', $event, node)"
            @contextmenu="emit('nodeContextMenu', $event, node)"
            @pointerdown="emit('nodePointerDown', $event, node)"
            @pointermove="emit('nodePointerMove', $event)"
            @pointerup="emit('nodePointerUp', $event)"
            @pointercancel="emit('nodePointerCancel', $event)"
            @dragstart="emit('nodeDragStart', $event, node)"
            @dragend="emit('nodeDragEnd', $event)"
            @dragover="emit('nodeDragOver', $event, node)"
            @dragleave="emit('nodeDragLeave', $event, node.key)"
            @drop="emit('nodeDrop', $event, node)"
            @toggle-expanded="emit('toggleCategoryExpanded', node.id)"
            @update-create-value="emit('updateCreateValue', $event)"
            @update-rename-value="emit('updateRenameValue', $event)"
            @save-inline-create="emit('saveInlineCreate')"
            @cancel-inline-create="emit('cancelInlineCreate')"
            @save-inline-rename="emit('saveInlineRename')"
            @cancel-rename="emit('cancelRename')"
          />

          <div v-if="treeNodes.length === 0" class="catalog-pane__empty">
            No folders or items match your search.
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.catalog-tree-pane {
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

.catalog-tree-pane__body {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  align-content: start;
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

.catalog-pane__empty {
  color: var(--text-muted);
  font-size: 0.88rem;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  text-align: center;
}

@media (max-width: 1180px) {
  .catalog-tree-pane {
    height: auto;
    overflow: visible;
    max-height: none;
  }

  .catalog-tree-pane__body {
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
}
</style>
