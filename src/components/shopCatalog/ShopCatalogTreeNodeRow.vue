<script setup lang="ts">
import AppInlineInput from '@/components/common/AppInlineInput.vue'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'

defineProps<{
  node: ShopCatalogTreeNode
  active: boolean
  dragging: boolean
  dropTarget: boolean
  draggable: boolean
  expanded: boolean
  creating: boolean
  renaming: boolean
  createValue: string
  renameValue: string
  setInputRef: (element: HTMLInputElement | null) => void
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  contextmenu: [event: MouseEvent]
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  pointercancel: [event: PointerEvent]
  dragstart: [event: DragEvent]
  dragend: [event: DragEvent]
  dragover: [event: DragEvent]
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
  toggleExpanded: []
  updateCreateValue: [value: string]
  updateRenameValue: [value: string]
  saveInlineCreate: []
  cancelInlineCreate: []
  saveInlineRename: []
  cancelRename: []
}>()
</script>

<template>
  <div class="catalog-tree__row">
    <button
      type="button"
      class="catalog-tree-node"
      :data-testid="node.kind === 'category' ? `shop-catalog-category-${node.id}` : `shop-catalog-item-${node.id}`"
      :class="{
        'catalog-tree-node--active': active,
        'catalog-tree-node--dragging': dragging,
        'catalog-tree-node--drop-target': dropTarget,
      }"
      :draggable="draggable"
      @click="emit('click', $event)"
      @contextmenu="emit('contextmenu', $event)"
      @pointerdown="emit('pointerdown', $event)"
      @pointermove="emit('pointermove', $event)"
      @pointerup="emit('pointerup', $event)"
      @pointercancel="emit('pointercancel', $event)"
      @dragstart="emit('dragstart', $event)"
      @dragend="emit('dragend', $event)"
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave', $event)"
      @drop="emit('drop', $event)"
    >
      <span class="catalog-tree-node__indent" :style="{ width: `${node.depth}rem` }"></span>
      <span
        v-if="node.kind === 'category' && node.hasChildren"
        class="catalog-tree-node__twist"
        :class="{ 'catalog-tree-node__twist--open': expanded }"
        @click.stop="emit('toggleExpanded')"
      >
        <span class="catalog-chevron"></span>
      </span>
      <span v-else class="catalog-tree-node__twist catalog-tree-node__twist--placeholder"></span>
      <span :class="['catalog-node-icon', node.kind === 'category' ? 'catalog-node-icon--folder' : 'catalog-node-icon--item']"></span>
      <AppInlineInput
        v-if="creating"
        :input-ref="setInputRef"
        :model-value="createValue"
        class="catalog-tree-node__rename"
        @update:model-value="emit('updateCreateValue', $event)"
        @commit="emit('saveInlineCreate')"
        @cancel="emit('cancelInlineCreate')"
      />
      <AppInlineInput
        v-else-if="renaming"
        :input-ref="setInputRef"
        :model-value="renameValue"
        class="catalog-tree-node__rename"
        @update:model-value="emit('updateRenameValue', $event)"
        @commit="emit('saveInlineRename')"
        @cancel="emit('cancelRename')"
      />
      <span v-else class="catalog-tree-node__label">{{ node.label }}</span>
      <span
        v-if="node.kind === 'category' && node.secondary && !creating && !renaming"
        class="catalog-tree-node__meta"
      >
        {{ node.secondary }}
      </span>
      <span v-if="!node.active" class="catalog-tree-node__state">Archived</span>
    </button>
  </div>
</template>

<style scoped src="./shopCatalogTreeRows.css"></style>
