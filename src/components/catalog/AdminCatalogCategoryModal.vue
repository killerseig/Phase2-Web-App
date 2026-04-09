<script setup lang="ts">
import { computed } from 'vue'
import BaseFormModal from '@/components/common/BaseFormModal.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'

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
  <BaseFormModal
    :open="props.open"
    :title="props.parentId ? 'Add Subcategory' : 'Add Category'"
    :loading="props.saving"
    submit-label="Create"
    cancel-label="Cancel"
    :submit-disabled="!props.categoryName.trim()"
    content-class="catalog-modal-content"
    @close="emit('close')"
    @cancel="emit('close')"
    @submit="emit('submit')"
  >
    <BaseInputField
      v-model="categoryNameModel"
      placeholder="Category name"
      autofocus
      wrapper-class="mb-0"
      @keyup.enter="emit('submit')"
    />
  </BaseFormModal>
</template>
