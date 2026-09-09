<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppField from '@/components/common/AppField.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type { ShopCatalogItemFormState } from '@/features/shopCatalog/adminViewHelpers'

defineProps<{
  form: ShopCatalogItemFormState
  title: string
  active: boolean
  pathLabel: string
  skuLabel: string
  priceLabel: string
  saveLoading: boolean
  deleteLoading: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:description': [value: string]
  'update:sku': [value: string]
  'update:active': [value: boolean]
  'price-input': [event: Event]
  'price-focus': []
  'price-blur': []
  archive: []
  delete: []
}>()

</script>

<template>
  <div class="shop-catalog-detail-panel">
    <AppPaneHeader
      class="shop-catalog-detail-panel__header"
      eyebrow="Item"
      :title="title"
      title-tag="h2"
    />

    <div class="shop-catalog-detail-panel__body">
      <form class="shop-catalog-detail-panel__form" @submit.prevent="emit('submit')">
        <AppField class="shop-catalog-detail-panel__field" label="Description">
          <AppTextInput
            :model-value="form.description"
            type="text"
            autocomplete="off"
            @update:model-value="emit('update:description', $event)"
          />
        </AppField>

        <AppField class="shop-catalog-detail-panel__field" label="SKU">
          <AppTextInput
            :model-value="form.sku"
            type="text"
            autocomplete="off"
            @update:model-value="emit('update:sku', $event)"
          />
        </AppField>

        <AppField class="shop-catalog-detail-panel__field" label="Price">
          <AppTextInput
            :model-value="form.price"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="$0.00"
            @input="emit('price-input', $event)"
            @focus="emit('price-focus')"
            @blur="emit('price-blur')"
          />
        </AppField>

        <label class="shop-catalog-detail-panel__toggle-row">
          <AppCheckbox
            :model-value="form.active"
            @update:model-value="emit('update:active', $event)"
          />
          <span>Active Item</span>
        </label>

        <section class="shop-catalog-detail-panel__card">
          <strong>Path</strong>
          <span>{{ pathLabel }}</span>
          <span>{{ skuLabel }}</span>
          <span>{{ priceLabel }}</span>
        </section>

        <div class="shop-catalog-detail-panel__actions">
          <AppLoadingButton
            label="Save Changes"
            loading-label="Saving..."
            variant="primary"
            type="submit"
            :loading="saveLoading"
          />
          <AppButton :disabled="saveLoading" @click="emit('archive')">
            {{ active ? 'Archive Item' : 'Restore Item' }}
          </AppButton>
          <AppLoadingButton
            label="Delete Item"
            loading-label="Deleting..."
            variant="danger"
            :loading="deleteLoading"
            @click="emit('delete')"
          />
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.shop-catalog-detail-panel {
  display: grid;
  gap: 0.7rem;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.shop-catalog-detail-panel__header {
  --app-pane-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-pane-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-pane-header-title-font-size: var(--font-size-pane-title);
  --app-pane-header-title-margin: 0.25rem 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--form-gap);
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.shop-catalog-detail-panel__body {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
  align-content: start;
}

.shop-catalog-detail-panel__form {
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.shop-catalog-detail-panel__field .app-text-input {
  --app-text-input-min-height: var(--control-height-form);
  --app-text-input-padding-x: 0.85rem;
  --app-text-input-background: var(--control-background);
}

.shop-catalog-detail-panel__toggle-row span {
  font-size: var(--font-size-label);
}

.shop-catalog-detail-panel__toggle-row,
.shop-catalog-detail-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--list-gap);
}

.shop-catalog-detail-panel__toggle-row {
  align-items: center;
  color: var(--text-muted);
}

.shop-catalog-detail-panel__toggle-row input {
  margin-top: 0.1rem;
  accent-color: var(--accent-strong);
}

.shop-catalog-detail-panel__card {
  display: grid;
  gap: 0.35rem;
  padding: 0.95rem 0;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
}

.shop-catalog-detail-panel__card strong {
  font-weight: var(--font-weight-heading);
}

.shop-catalog-detail-panel__card span {
  color: var(--text-muted);
  font-size: 0.88rem;
}

@media (max-width: 720px) {
  .shop-catalog-detail-panel__header,
  .shop-catalog-detail-panel__actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
