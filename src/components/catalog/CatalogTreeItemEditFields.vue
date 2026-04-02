<script setup lang="ts">
import InlineField from '@/components/common/InlineField.vue'

const props = defineProps<{
  depthClass: string
  hasChildren: boolean
  isSaving: boolean
  description: string
  sku: string
  price: string
}>()

const emit = defineEmits<{
  (e: 'update:description', value: string): void
  (e: 'update:sku', value: string): void
  (e: 'update:price', value: string): void
  (e: 'save'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <div class="node-header editing-item-header" :class="props.depthClass" @click.stop>
    <div class="accordion-button not-expandable editing-item-fields">
      <i class="bi me-2 node-item-icon" :class="props.hasChildren ? 'bi-folder2' : 'bi-file-text'"></i>
      <div class="item-edit-fields w-100">
        <InlineField
          :model-value="props.description"
          :editing="true"
          placeholder="Description"
          @update:model-value="(value) => emit('update:description', String(value ?? ''))"
          @enter="emit('save')"
          @escape="emit('cancel')"
        />
        <InlineField
          v-if="!props.hasChildren"
          :model-value="props.sku"
          :editing="true"
          placeholder="SKU"
          @update:model-value="(value) => emit('update:sku', String(value ?? ''))"
          @enter="emit('save')"
          @escape="emit('cancel')"
        />
        <InlineField
          v-if="!props.hasChildren"
          :model-value="props.price"
          :editing="true"
          type="number"
          step="0.01"
          placeholder="Price"
          @update:model-value="(value) => emit('update:price', String(value ?? ''))"
          @enter="emit('save')"
          @escape="emit('cancel')"
        />
      </div>
    </div>
    <div class="d-flex align-items-center justify-content-end gap-1 flex-nowrap node-actions" @click.stop>
      <button
        class="btn btn-sm btn-success"
        :disabled="props.isSaving"
        title="Save"
        @click.stop="emit('save')"
      >
        <i class="bi bi-check"></i>
      </button>
      <button
        class="btn btn-sm btn-outline-secondary"
        :disabled="props.isSaving"
        title="Cancel"
        @click.stop="emit('cancel')"
      >
        <i class="bi bi-x"></i>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_catalogTreeNode.scss';
</style>
