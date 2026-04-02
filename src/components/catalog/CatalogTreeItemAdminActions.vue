<script setup lang="ts">
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import type { ShopCatalogItem } from '@/services'

const props = defineProps<{
  open: boolean
  item: ShopCatalogItem
  itemArchived: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'add-item', categoryId: string): void
  (e: 'edit-item', item: ShopCatalogItem): void
  (e: 'delete-item', item: ShopCatalogItem): void
  (e: 'archive-item', item: ShopCatalogItem): void
  (e: 'reactivate-item', item: ShopCatalogItem): void
}>()
</script>

<template>
  <div class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions" @click.stop>
    <ActionToggleGroup
      :open="props.open"
      wrapper-class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions"
      @toggle="emit('toggle')"
    >
      <button class="btn btn-outline-danger" title="Delete" @click.stop="emit('delete-item', props.item)">
        <i class="bi bi-trash text-danger"></i>
      </button>
      <button
        v-if="!props.itemArchived"
        class="btn btn-outline-success"
        title="Add item"
        @click.stop="emit('add-item', props.item.id)"
      >
        <i class="bi bi-file-earmark-plus text-success"></i>
      </button>
      <button class="btn btn-outline-secondary" title="Edit" @click.stop="emit('edit-item', props.item)">
        <i class="bi bi-pencil"></i>
      </button>
      <button
        v-if="!props.itemArchived"
        class="btn btn-outline-warning"
        title="Archive"
        @click.stop="emit('archive-item', props.item)"
      >
        <i class="bi bi-archive text-warning"></i>
      </button>
      <button
        v-else
        class="btn btn-outline-success"
        title="Reactivate"
        @click.stop="emit('reactivate-item', props.item)"
      >
        <i class="bi bi-arrow-counterclockwise text-success"></i>
      </button>
    </ActionToggleGroup>
  </div>
</template>
