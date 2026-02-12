<script setup lang="ts">
import { computed } from 'vue'
import { useShopCategoriesStore } from '../../stores/shopCategories'
import type { ShopCategory } from '@/services'

interface Props {
  node: ShopCategory
  selected?: boolean
  expanded: Set<string>
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
})

const emit = defineEmits<{
  select: [id: string]
  'toggle-expand': [id: string]
  'add-child': [parentId: string]
  archive: [id: string]
  reactivate: [id: string]
  delete: [id: string]
}>()

const categoriesStore = useShopCategoriesStore()

const isExpanded = computed(() => props.expanded.has(props.node.id))
const children = computed(() => categoriesStore.getChildren(props.node.id))
const hasChildren = computed(() => children.value.length > 0)
const isArchived = computed(() => !props.node.active)
</script>

<template>
  <div class="category-node" :class="{ 'is-selected': selected, 'is-archived': isArchived }">
    <!-- Category Item -->
    <div class="d-flex align-items-center gap-2">
      <!-- Expand Toggle -->
      <button
        v-if="hasChildren"
        class="btn btn-sm p-0"
        style="width: 24px; height: 24px;"
        @click.stop="$emit('toggle-expand', node.id)"
        :title="isExpanded ? 'Collapse' : 'Expand'"
      >
        <i :class="['bi', isExpanded ? 'bi-chevron-down' : 'bi-chevron-right']"></i>
      </button>
      <div v-else style="width: 24px;"></div>

      <!-- Category Name -->
      <span
        class="flex-grow-1 category-label"
        @click="$emit('select', node.id)"
        :style="{ opacity: isArchived ? 0.5 : 1 }"
      >
        {{ node.name }}
        <span v-if="isArchived" class="badge bg-secondary bg-opacity-75 ms-2" style="font-size: 0.65rem;">
          archived
        </span>
      </span>

      <!-- Action Buttons -->
      <div class="btn-group btn-group-sm ms-2" role="group">
        <!-- Add Subcategory -->
        <button
          v-if="!isArchived"
          class="btn btn-outline-secondary"
          @click.stop="$emit('add-child', node.id)"
          title="Add subcategory"
        >
          <i class="bi bi-plus-lg"></i>
        </button>

        <!-- Archive/Reactivate -->
        <button
          v-if="!isArchived"
          class="btn btn-outline-warning"
          @click.stop="$emit('archive', node.id)"
          title="Archive"
        >
          <i class="bi bi-archive"></i>
        </button>
        <button
          v-else
          class="btn btn-outline-success"
          @click.stop="$emit('reactivate', node.id)"
          title="Reactivate"
        >
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>

        <!-- Delete -->
        <button
          class="btn btn-outline-danger"
          @click.stop="$emit('delete', node.id)"
          title="Delete"
        >
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>

    <!-- Children -->
    <div v-if="isExpanded && hasChildren" class="ms-4 mt-2 border-start border-secondary" style="padding-left: 12px;">
      <div v-for="child of children" :key="child.id" class="mb-2">
        <CategoryTreeNode
          :node="child"
          :selected="selected"
          :expanded="expanded"
          @select="(id) => $emit('select', id)"
          @toggle-expand="(id) => $emit('toggle-expand', id)"
          @add-child="(id) => $emit('add-child', id)"
          @archive="(id) => $emit('archive', id)"
          @reactivate="(id) => $emit('reactivate', id)"
          @delete="(id) => $emit('delete', id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-node {
  margin-bottom: 0.5rem;
}

.category-node.is-selected {
  background: rgba(13, 110, 253, 0.1);
  border-radius: 4px;
  padding: 4px 8px;
}

.category-label {
  cursor: pointer;
  padding: 4px 0;
  display: flex;
  align-items: center;
  user-select: none;
  transition: opacity 0.2s;
}

.category-label:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.btn-group {
  opacity: 0;
  transition: opacity 0.2s;
}

.category-node:hover .btn-group {
  opacity: 1;
}

.is-archived {
  opacity: 0.6;
}
</style>
