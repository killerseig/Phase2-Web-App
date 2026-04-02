<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppLoadingState from '@/components/common/AppLoadingState.vue'
import AppToolbarCard from '@/components/common/AppToolbarCard.vue'
import AppPageHeader from '@/components/layout/AppPageHeader.vue'
import AdminCatalogCategoryModal from '@/components/catalog/AdminCatalogCategoryModal.vue'
import AdminCatalogTopLevelItemForm from '@/components/catalog/AdminCatalogTopLevelItemForm.vue'
import AdminCatalogTreeSection from '@/components/catalog/AdminCatalogTreeSection.vue'
import { useAdminShopCatalog } from './useAdminShopCatalog'

const {
  allItems,
  browseTreeIndex,
  loading,
  err,
  saving,
  downloading,
  rootNodeIds,
  expandedNodes,
  searchQuery,
  isSearching,
  searchResults,
  totalResultCount,
  hasMoreResults,
  hasSearchResults,
  showAddCategory,
  showAddItemForm,
  newCategoryName,
  newItemDesc,
  newItemSku,
  newItemPrice,
  parentId,
  editingItemId,
  editingCategoryId,
  editCategoryName,
  savingCategoryEdit,
  clearErrors,
  downloadCatalog,
  closeAddCategoryDialog,
  createCategory,
  createItem,
  cancelAddItem,
  revealSearchResult,
  treeListeners,
} = useAdminShopCatalog()
</script>

<template>
  
  
  <div class="app-page">
    <!-- Header -->
    <AppPageHeader eyebrow="Admin Panel" title="Shop Catalog" subtitle="Manage product categories and items in a unified tree view.">
      <template #actions>
        <button
          class="btn btn-outline-primary"
          type="button"
          @click="downloadCatalog"
          :disabled="loading || !allItems.length || downloading"
        >
          <span
            v-if="downloading"
            class="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          Download catalog
        </button>
      </template>
    </AppPageHeader>

    <AdminCatalogTopLevelItemForm
      :open="showAddItemForm"
      :loading="saving"
      :description="newItemDesc"
      :sku="newItemSku"
      :price="newItemPrice"
      @update:open="(value) => showAddItemForm = value"
      @update:description="(value) => newItemDesc = value"
      @update:sku="(value) => newItemSku = value"
      @update:price="(value) => newItemPrice = value"
      @submit="createItem"
      @cancel="cancelAddItem"
    />

    <!-- Search Bar -->
    <AppToolbarCard class="mb-4">
      <input
        v-model="searchQuery"
        type="text"
        class="form-control"
        placeholder="Search by description, SKU, or price..."
      />
    </AppToolbarCard>

    <!-- Error Alert -->
    <AppAlert v-if="err" variant="danger" :message="err" dismissible @close="clearErrors" />

    <!-- Loading State -->
    <AppLoadingState v-if="loading" message="" />

    <!-- Catalog Tree -->
    <div v-else>
      <AdminCatalogTreeSection
        :is-searching="isSearching"
        :has-search-results="hasSearchResults"
        :results="searchResults"
        :total-result-count="totalResultCount"
        :has-more-results="hasMoreResults"
        :root-node-ids="rootNodeIds"
        :browse-tree-index="browseTreeIndex"
        :expanded="expandedNodes"
        :editing-item-id="editingItemId"
        :editing-category-id="editingCategoryId"
        :edit-category-name="editCategoryName"
        :saving-category-edit="savingCategoryEdit"
        :tree-listeners="treeListeners"
        @reveal="revealSearchResult"
      />
    </div>

    <AdminCatalogCategoryModal
      :open="showAddCategory"
      :saving="saving"
      :parent-id="parentId"
      :category-name="newCategoryName"
      @close="closeAddCategoryDialog"
      @update:category-name="(value) => newCategoryName = value"
      @submit="createCategory"
    />

  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_variables.scss' as *;

.form-control,
.form-select {
  background-color: $surface-3;
  color: $body-color;
  border-color: $border-color;
}

.form-control:focus,
.form-select:focus {
  background-color: $surface-3;
  color: $body-color;
  border-color: $primary;
  box-shadow: 0 0 0 0.15rem rgba($primary, 0.25);
}
</style>

