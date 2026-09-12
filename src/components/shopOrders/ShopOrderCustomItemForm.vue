<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppField from '@/components/common/AppField.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'

const props = withDefaults(defineProps<{
  description: string
  disabled: boolean
  note: string
  quantity: string
  submitDisabled?: boolean
}>(), {
  submitDisabled: undefined,
})

const emit = defineEmits<{
  submit: []
  'update:description': [value: string]
  'update:note': [value: string]
  'update:quantity': [value: string]
}>()

const isSubmitDisabled = computed(() => props.submitDisabled ?? props.disabled)

</script>

<template>
  <section class="shop-order-custom-item-form shop-orders-tree-card">
    <AppPaneHeader
      class="shop-order-custom-item-form__header"
      eyebrow="Custom Item"
      title="Add Custom Item"
      title-tag="h3"
    />

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
          :disabled="isSubmitDisabled"
        >
          Add Custom Item
        </AppButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.shop-order-custom-item-form {
  --app-pane-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-pane-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-pane-header-title-margin: 0.12rem 0 0;
  --app-pane-header-title-font-size: var(--font-size-section-title);
  display: grid;
  align-content: start;
  gap: var(--field-gap);
  padding: 0.55rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
  background: transparent;
}

.shop-order-custom-item-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--form-gap);
}

.shop-order-custom-item-form__field .app-text-input {
  --app-text-input-min-height: var(--shop-control-height);
  --app-text-input-padding-x: 0.8rem;
  --app-text-input-border: var(--shop-line);
  --app-text-input-radius: var(--shop-radius-md);
  --app-text-input-background: var(--shop-field);
  --app-text-input-box-shadow: none;
}

.shop-order-custom-item-form__field--full {
  grid-column: 1 / -1;
}

.shop-order-custom-item-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

@media (max-width: 560px) {
  .shop-order-custom-item-form__grid {
    grid-template-columns: 1fr;
  }
}
</style>
