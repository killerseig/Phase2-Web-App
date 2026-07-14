<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppField from '@/components/common/AppField.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import type {
  ShopCatalogCategoryFormState,
  ShopCatalogCategoryOption,
} from '@/features/shopCatalog/adminViewHelpers'

defineProps<{
  form: ShopCatalogCategoryFormState
  categoryOptions: readonly ShopCatalogCategoryOption[]
  createLoading: boolean
}>()

const emit = defineEmits<{
  submit: []
  'update:name': [value: string]
  'update:parent-id': [value: string | null]
  'update:active': [value: boolean]
}>()

function getSelectValue(value: string) {
  return value || null
}

</script>

<template>
  <div class="shop-catalog-create-panel">
    <AppPaneHeader
      class="shop-catalog-create-panel__header"
      eyebrow="Create"
      title="New Folder"
      title-tag="h2"
    />

    <div class="shop-catalog-create-panel__body">
      <form class="shop-catalog-create-panel__form" @submit.prevent="emit('submit')">
        <AppField class="shop-catalog-create-panel__field" label="Folder Name">
          <AppTextInput
            :model-value="form.name"
            type="text"
            autocomplete="off"
            @update:model-value="emit('update:name', $event)"
          />
        </AppField>

        <AppField class="shop-catalog-create-panel__field" label="Parent Folder">
          <AppSelect
            :model-value="form.parentId ?? ''"
            @update:model-value="emit('update:parent-id', getSelectValue($event))"
          >
            <option value="">Top Level</option>
            <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </AppSelect>
        </AppField>

        <label class="shop-catalog-create-panel__toggle-row">
          <AppCheckbox
            :model-value="form.active"
            @update:model-value="emit('update:active', $event)"
          />
          <span>Active Folder</span>
        </label>

        <AppButton variant="primary" :disabled="createLoading" type="submit">
          {{ createLoading ? 'Creating...' : 'Create Folder' }}
        </AppButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.shop-catalog-create-panel {
  display: grid;
  gap: 0.7rem;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.shop-catalog-create-panel__header {
  --app-pane-header-eyebrow-font-size: 0.68rem;
  --app-pane-header-eyebrow-letter-spacing: 0.12em;
  --app-pane-header-title-font-size: 1.2rem;
  --app-pane-header-title-margin: 0.25rem 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.85rem;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.shop-catalog-create-panel__body {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
  align-content: start;
}

.shop-catalog-create-panel__form {
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.shop-catalog-create-panel__field .app-text-input,
.shop-catalog-create-panel__field .app-select {
  --app-text-input-min-height: 2.55rem;
  --app-text-input-padding-x: 0.85rem;
  --app-text-input-background: rgba(255, 255, 255, 0.045);
  --app-select-min-height: 2.55rem;
  --app-select-padding-x: 0.85rem;
  --app-select-background: rgba(255, 255, 255, 0.045);
}

.shop-catalog-create-panel__toggle-row span {
  font-size: 0.9rem;
}

.shop-catalog-create-panel__toggle-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  color: var(--text-muted);
}

.shop-catalog-create-panel__toggle-row input {
  margin-top: 0.1rem;
  accent-color: var(--accent-strong);
}

@media (max-width: 720px) {
  .shop-catalog-create-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
