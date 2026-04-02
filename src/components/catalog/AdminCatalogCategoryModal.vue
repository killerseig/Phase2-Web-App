<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps<{
  open: boolean
  saving: boolean
  parentId: string | null
  categoryName: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:categoryName', value: string): void
  (e: 'submit'): void
}>()

const categoryNameModel = computed({
  get: () => props.categoryName,
  set: (value: string) => emit('update:categoryName', value),
})
</script>

<template>
  <BaseModal
    :open="props.open"
    :title="props.parentId ? 'Add Subcategory' : 'Add Category'"
    content-class="catalog-modal-content"
    :close-disabled="props.saving"
    :close-on-backdrop="!props.saving"
    :close-on-escape="!props.saving"
    @close="emit('close')"
  >
    <input
      v-model="categoryNameModel"
      type="text"
      class="form-control"
      placeholder="Category name"
      autofocus
      @keyup.enter="emit('submit')"
    />

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="props.saving"
        @click="emit('close')"
      >
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="props.saving || !props.categoryName.trim()"
        @click="emit('submit')"
      >
        {{ props.saving ? 'Creating...' : 'Create' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

:deep(.catalog-modal-content) {
  background: $surface-2;
  color: $body-color;
  border-color: $border-color;
  box-shadow: $box-shadow;
}

:deep(.catalog-modal-content .modal-header),
:deep(.catalog-modal-content .modal-footer) {
  border-color: $border-color;
}

:deep(.catalog-modal-content .btn-close) {
  filter: invert(1) contrast(1.1);
}

.form-control {
  background-color: $surface-3;
  color: $body-color;
  border-color: $border-color;
}

.form-control:focus {
  background-color: $surface-3;
  color: $body-color;
  border-color: $primary;
  box-shadow: 0 0 0 0.15rem rgba($primary, 0.25);
}
</style>
