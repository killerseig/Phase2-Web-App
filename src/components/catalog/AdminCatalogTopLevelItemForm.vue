<script setup lang="ts">
import { computed } from 'vue'
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'

const props = defineProps<{
  open: boolean
  loading: boolean
  description: string
  sku: string
  price: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:description', value: string): void
  (e: 'update:sku', value: string): void
  (e: 'update:price', value: string): void
  (e: 'submit'): void
  (e: 'cancel'): void
}>()

const descriptionModel = computed({
  get: () => props.description,
  set: (value: string) => emit('update:description', value),
})

const skuModel = computed({
  get: () => props.sku,
  set: (value: string) => emit('update:sku', value),
})

const priceModel = computed({
  get: () => props.price,
  set: (value: string) => emit('update:price', value),
})
</script>

<template>
  <AdminAccordionFormCard
    :open="props.open"
    title="Add Top-Level Item"
    subtitle="Create a root catalog item with optional SKU and price"
    :loading="props.loading"
    :submit-disabled="!props.description.trim()"
    submit-label="Add Item"
    @update:open="(value) => emit('update:open', value)"
    @submit="emit('submit')"
    @cancel="emit('cancel')"
  >
    <div class="col-md-6">
      <BaseInputField
        v-model="descriptionModel"
        label="Description"
        label-class="small"
        placeholder="Item description"
        required
        wrapper-class="mb-0"
      />
    </div>
    <div class="col-md-3">
      <BaseInputField
        v-model="skuModel"
        label="SKU (optional)"
        label-class="small"
        placeholder="e.g., SKU-12345"
        wrapper-class="mb-0"
      />
    </div>
    <div class="col-md-3">
      <BaseInputField
        v-model="priceModel"
        label="Price (optional)"
        label-class="small"
        type="number"
        step="0.01"
        placeholder="0.00"
        wrapper-class="mb-0"
      />
    </div>
  </AdminAccordionFormCard>
</template>

<style scoped lang="scss">
@use '@/styles/_adminCatalogControls.scss';
</style>
