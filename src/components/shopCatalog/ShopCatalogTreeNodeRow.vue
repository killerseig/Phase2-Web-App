<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { ShopCatalogTreeNode } from '@/features/shopCatalog/treeTypes'
import { readInputValue } from '@/utils/domEvents'

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
  setInputRef: (element: Element | ComponentPublicInstance | null) => void
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

function handleCreateInput(event: Event) {
  emit('updateCreateValue', readInputValue(event))
}

function handleRenameInput(event: Event) {
  emit('updateRenameValue', readInputValue(event))
}
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
      <input
        v-if="creating"
        :ref="setInputRef"
        :value="createValue"
        type="text"
        class="catalog-tree-node__rename"
        @input="handleCreateInput"
        @click.stop
        @blur="emit('saveInlineCreate')"
        @keydown.enter.prevent="emit('saveInlineCreate')"
        @keydown.esc.prevent="emit('cancelInlineCreate')"
      />
      <input
        v-else-if="renaming"
        :ref="setInputRef"
        :value="renameValue"
        type="text"
        class="catalog-tree-node__rename"
        @input="handleRenameInput"
        @click.stop
        @blur="emit('saveInlineRename')"
        @keydown.enter.prevent="emit('saveInlineRename')"
        @keydown.esc.prevent="emit('cancelRename')"
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
