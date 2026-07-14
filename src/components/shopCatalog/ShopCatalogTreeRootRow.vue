<script setup lang="ts">
defineProps<{
  active: boolean
  dropTarget: boolean
  expanded: boolean
  hasChildren: boolean
  summary: string
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
  contextmenu: [event: MouseEvent]
  pointerdown: [event: PointerEvent]
  pointermove: [event: PointerEvent]
  pointerup: [event: PointerEvent]
  pointercancel: [event: PointerEvent]
  dragover: [event: DragEvent]
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
  toggleExpanded: []
}>()
</script>

<template>
  <div class="catalog-tree__row">
    <button
      type="button"
      class="catalog-tree-node catalog-tree-node--root"
      data-testid="shop-catalog-root-row"
      :class="{
        'catalog-tree-node--active': active,
        'catalog-tree-node--drop-target': dropTarget,
      }"
      @click="emit('click', $event)"
      @contextmenu="emit('contextmenu', $event)"
      @pointerdown="emit('pointerdown', $event)"
      @pointermove="emit('pointermove', $event)"
      @pointerup="emit('pointerup', $event)"
      @pointercancel="emit('pointercancel', $event)"
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave', $event)"
      @drop="emit('drop', $event)"
    >
      <span class="catalog-tree-node__indent" :style="{ width: '0rem' }"></span>
      <span
        v-if="hasChildren"
        class="catalog-tree-node__twist"
        :class="{ 'catalog-tree-node__twist--open': expanded }"
        @click.stop="emit('toggleExpanded')"
      >
        <span class="catalog-chevron"></span>
      </span>
      <span v-else class="catalog-tree-node__twist catalog-tree-node__twist--placeholder"></span>
      <span class="catalog-node-icon catalog-node-icon--folder"></span>
      <span class="catalog-tree-node__label">Top Level</span>
      <span v-if="summary" class="catalog-tree-node__meta">{{ summary }}</span>
    </button>
  </div>
</template>

<style scoped src="./shopCatalogTreeRows.css"></style>
