<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppField from '@/components/common/AppField.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'

defineProps<{
  description: string
  disabled: boolean
  note: string
  quantity: string
}>()

const emit = defineEmits<{
  submit: []
  'update:description': [value: string]
  'update:note': [value: string]
  'update:quantity': [value: string]
}>()

</script>

<template>
  <section class="shop-order-custom-item-form shop-orders-tree-card">
    <header class="shop-order-custom-item-form__header">
      <div>
        <span class="shop-order-custom-item-form__eyebrow">Custom Item</span>
        <h3 class="shop-order-custom-item-form__title">Add Custom Item</h3>
      </div>
    </header>

    <form class="shop-orders-form__grid shop-order-custom-item-form__grid" @submit.prevent="emit('submit')">
      <AppField class="shop-order-custom-item-form__field shop-order-custom-item-form__field--full" label="Description">
        <AppTextInput
          :model-value="description"
          type="text"
          autocomplete="off"
          :disabled="disabled"
          placeholder="Describe the item to order"
          @update:model-value="emit('update:description', $event)"
        />
      </AppField>

      <AppField class="shop-order-custom-item-form__field" label="Quantity">
        <AppTextInput
          :model-value="quantity"
          type="number"
          min="1"
          step="1"
          inputmode="numeric"
          :disabled="disabled"
          @update:model-value="emit('update:quantity', $event)"
        />
      </AppField>

      <AppField class="shop-order-custom-item-form__field" label="Note">
        <AppTextInput
          :model-value="note"
          type="text"
          autocomplete="off"
          :disabled="disabled"
          placeholder="Optional note"
          @update:model-value="emit('update:note', $event)"
        />
      </AppField>

      <div class="shop-order-custom-item-form__actions">
        <AppButton
          type="submit"
          variant="primary"
          :disabled="disabled"
        >
          Add Custom Item
        </AppButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.shop-order-custom-item-form {
  display: grid;
  align-content: start;
  gap: 0.45rem;
  padding: 0.55rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
  background: transparent;
}

.shop-order-custom-item-form__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.65rem;
}

.shop-order-custom-item-form__eyebrow {
  color: var(--accent-strong);
  font-size: 0.66rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.shop-order-custom-item-form__title {
  margin: 0.12rem 0 0;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.shop-order-custom-item-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.shop-order-custom-item-form__field {
  --app-field-gap: 0.28rem;
  --app-field-color: var(--text-muted);
  --app-field-label-color: var(--text-soft);
  --app-field-label-font-size: 0.74rem;
  --app-field-label-letter-spacing: 0.08em;
  --app-field-label-text-transform: uppercase;
}

.shop-order-custom-item-form__field .app-text-input {
  --app-text-input-min-height: var(--shop-control-height);
  --app-text-input-padding-x: 0.8rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.045),
    0 5px 12px rgba(3, 10, 16, 0.08);
}

.shop-order-custom-item-form__field--full {
  grid-column: 1 / -1;
}

.shop-order-custom-item-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 980px) {
  .shop-order-custom-item-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
