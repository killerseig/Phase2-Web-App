<script setup lang="ts">
import { normalizeCatalogOrderQuantity } from '@/utils/catalogOrder'

const props = withDefaults(defineProps<{
  quantity: number
  selectedQuantity?: number
  quantityAriaLabel?: string
  addButtonLabel?: string
}>(), {
  selectedQuantity: 0,
  quantityAriaLabel: 'Quantity',
  addButtonLabel: 'Add to order',
})

const emit = defineEmits<{
  (e: 'update:qty', qty: number): void
  (e: 'add'): void
}>()

function handleQuantityInput(event: Event) {
  emit('update:qty', normalizeCatalogOrderQuantity((event.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="catalog-order-actions btn-group btn-group-sm" role="group" @click.stop>
    <span
      v-if="props.selectedQuantity > 0"
      class="badge text-bg-primary catalog-order-count"
      :title="`${props.selectedQuantity} currently in this order`"
    >
      x{{ props.selectedQuantity }}
    </span>
    <input
      type="number"
      inputmode="numeric"
      min="1"
      step="1"
      class="form-control form-control-sm catalog-order-qty"
      :value="props.quantity"
      :aria-label="props.quantityAriaLabel"
      @input="handleQuantityInput"
    />
    <button
      type="button"
      class="btn btn-sm btn-success"
      :title="props.addButtonLabel"
      :aria-label="props.addButtonLabel"
      @click.stop="emit('add')"
    >
      <i class="bi bi-plus-circle"></i>
    </button>
  </div>
</template>
