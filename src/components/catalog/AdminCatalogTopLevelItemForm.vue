<script setup lang="ts">
import { computed } from 'vue'
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'

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
      <label class="form-label small">Description</label>
      <input
        v-model="descriptionModel"
        type="text"
        class="form-control"
        placeholder="Item description"
        required
      />
    </div>
    <div class="col-md-3">
      <label class="form-label small">SKU (optional)</label>
      <input
        v-model="skuModel"
        type="text"
        class="form-control"
        placeholder="e.g., SKU-12345"
      />
    </div>
    <div class="col-md-3">
      <label class="form-label small">Price (optional)</label>
      <input
        v-model="priceModel"
        type="number"
        class="form-control"
        step="0.01"
        placeholder="0.00"
      />
    </div>
  </AdminAccordionFormCard>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

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
