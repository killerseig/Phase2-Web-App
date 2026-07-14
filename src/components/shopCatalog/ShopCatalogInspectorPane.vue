<script setup lang="ts">
import ShopCatalogCategoryDetailPanel from '@/components/shopCatalog/ShopCatalogCategoryDetailPanel.vue'
import ShopCatalogCreateCategoryPanel from '@/components/shopCatalog/ShopCatalogCreateCategoryPanel.vue'
import ShopCatalogCreateItemPanel from '@/components/shopCatalog/ShopCatalogCreateItemPanel.vue'
import ShopCatalogItemDetailPanel from '@/components/shopCatalog/ShopCatalogItemDetailPanel.vue'
import ShopCatalogRootInspector from '@/components/shopCatalog/ShopCatalogRootInspector.vue'
import type {
  ShopCatalogCategoryFormState,
  ShopCatalogCategoryOption,
  ShopCatalogItemFormState,
} from '@/features/shopCatalog/adminViewHelpers'
import type { ShopCatalogItemRecord, ShopCategoryRecord } from '@/types/domain'

defineProps<{
  mobileVisible: boolean
  isRootInspector: boolean
  isCreateCategoryMode: boolean
  isCreateItemMode: boolean
  visibleFolderCount: number
  visibleItemCount: number
  createCategoryForm: ShopCatalogCategoryFormState
  createItemForm: ShopCatalogItemFormState
  categoryOptions: readonly ShopCatalogCategoryOption[]
  createLoading: boolean
  selectedCategory: ShopCategoryRecord | null
  detailCategoryForm: ShopCatalogCategoryFormState
  detailCategoryParentOptions: readonly ShopCatalogCategoryOption[]
  selectedCategoryTitle: string
  selectedCategoryPathLabel: string
  selectedCategorySummaryLabel: string
  selectedCategoryHasChildren: boolean
  selectedItem: ShopCatalogItemRecord | null
  detailItemForm: ShopCatalogItemFormState
  selectedItemTitle: string
  selectedItemPathLabel: string
  selectedItemSkuLabel: string
  selectedItemPriceLabel: string
  saveLoading: boolean
  deleteLoading: boolean
}>()

const emit = defineEmits<{
  'submit-create-category': []
  'update-create-category-name': [value: string]
  'update-create-category-parent-id': [value: string | null]
  'update-create-category-active': [value: boolean]
  'submit-create-item': []
  'update-create-item-description': [value: string]
  'update-create-item-category-id': [value: string | null]
  'update-create-item-sku': [value: string]
  'update-create-item-active': [value: boolean]
  'create-item-price-input': [event: Event]
  'create-item-price-focus': []
  'create-item-price-blur': []
  'submit-category': []
  'update-category-name': [value: string]
  'update-category-parent-id': [value: string | null]
  'update-category-active': [value: boolean]
  'archive-category': []
  'delete-category': []
  'submit-item': []
  'update-item-description': [value: string]
  'update-item-sku': [value: string]
  'update-item-active': [value: boolean]
  'detail-item-price-input': [event: Event]
  'detail-item-price-focus': []
  'detail-item-price-blur': []
  'archive-item': []
  'delete-item': []
}>()
</script>

<template>
  <section
    id="catalog-inspector-pane"
    class="catalog-inspector-pane"
    :class="{ 'catalog-inspector-pane--mobile-hidden': !mobileVisible }"
  >
    <template v-if="isRootInspector">
      <ShopCatalogRootInspector
        :visible-folder-count="visibleFolderCount"
        :visible-item-count="visibleItemCount"
      />
    </template>

    <template v-else-if="isCreateCategoryMode">
      <ShopCatalogCreateCategoryPanel
        :form="createCategoryForm"
        :category-options="categoryOptions"
        :create-loading="createLoading"
        @submit="emit('submit-create-category')"
        @update:name="emit('update-create-category-name', $event)"
        @update:parent-id="emit('update-create-category-parent-id', $event)"
        @update:active="emit('update-create-category-active', $event)"
      />
    </template>

    <template v-else-if="isCreateItemMode">
      <ShopCatalogCreateItemPanel
        :form="createItemForm"
        :category-options="categoryOptions"
        :create-loading="createLoading"
        @submit="emit('submit-create-item')"
        @update:description="emit('update-create-item-description', $event)"
        @update:category-id="emit('update-create-item-category-id', $event)"
        @update:sku="emit('update-create-item-sku', $event)"
        @update:active="emit('update-create-item-active', $event)"
        @price-input="emit('create-item-price-input', $event)"
        @price-focus="emit('create-item-price-focus')"
        @price-blur="emit('create-item-price-blur')"
      />
    </template>

    <template v-else-if="selectedCategory">
      <ShopCatalogCategoryDetailPanel
        :form="detailCategoryForm"
        :parent-options="detailCategoryParentOptions"
        :title="selectedCategoryTitle"
        :active="selectedCategory.active"
        :path-label="selectedCategoryPathLabel"
        :summary-label="selectedCategorySummaryLabel"
        :save-loading="saveLoading"
        :delete-loading="deleteLoading"
        :delete-disabled="selectedCategoryHasChildren"
        @submit="emit('submit-category')"
        @update:name="emit('update-category-name', $event)"
        @update:parent-id="emit('update-category-parent-id', $event)"
        @update:active="emit('update-category-active', $event)"
        @archive="emit('archive-category')"
        @delete="emit('delete-category')"
      />
    </template>

    <template v-else-if="selectedItem">
      <ShopCatalogItemDetailPanel
        :form="detailItemForm"
        :title="selectedItemTitle"
        :active="selectedItem.active"
        :path-label="selectedItemPathLabel"
        :sku-label="selectedItemSkuLabel"
        :price-label="selectedItemPriceLabel"
        :save-loading="saveLoading"
        :delete-loading="deleteLoading"
        @submit="emit('submit-item')"
        @update:description="emit('update-item-description', $event)"
        @update:sku="emit('update-item-sku', $event)"
        @update:active="emit('update-item-active', $event)"
        @price-input="emit('detail-item-price-input', $event)"
        @price-focus="emit('detail-item-price-focus')"
        @price-blur="emit('detail-item-price-blur')"
        @archive="emit('archive-item')"
        @delete="emit('delete-item')"
      />
    </template>
  </section>
</template>

<style scoped>
.catalog-inspector-pane {
  display: grid;
  gap: 0.7rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
  grid-template-rows: auto minmax(0, 1fr);
}

@media (max-width: 1180px) {
  .catalog-inspector-pane {
    height: auto;
    overflow: visible;
  }

  .catalog-inspector-pane--mobile-hidden {
    display: none;
  }
}
</style>
