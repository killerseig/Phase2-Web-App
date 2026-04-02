<script setup lang="ts">
import CatalogOrderActionGroup from '@/components/catalog/CatalogOrderActionGroup.vue'
import CatalogSearchResultsList from '@/components/catalog/CatalogSearchResultsList.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'
import { createCatalogOrderSelection, normalizeCatalogOrderQuantity } from '@/utils/catalogOrder'

const props = defineProps<{
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
  catalogItemQtys: Record<string, number>
  selectedItemQuantities: Record<string, number>
  orderableNodeIds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
  (e: 'update:catalog-item-qty', payload: CatalogItemQuantityUpdate): void
  (e: 'select-for-order', item: CatalogOrderSelection): void
}>()

function isOrderableResult(result: CatalogSearchResult): boolean {
  return props.orderableNodeIds.has(result.nodeId)
}

function resultQuantity(result: CatalogSearchResult): number {
  return normalizeCatalogOrderQuantity(props.catalogItemQtys[result.id], 1)
}

function selectedQuantity(result: CatalogSearchResult): number {
  return props.selectedItemQuantities[result.id] || 0
}

function resultDescription(result: CatalogSearchResult): string {
  return result.kind === 'item'
    ? result.item?.description ?? result.label
    : result.category?.name ?? result.label
}

function handleQuantityInput(result: CatalogSearchResult, qty: number) {
  emit('update:catalog-item-qty', { id: result.id, qty })
}

function handleAddToOrder(result: CatalogSearchResult) {
  emit('select-for-order', createCatalogOrderSelection({
    id: result.id,
    description: resultDescription(result),
    quantity: resultQuantity(result),
  }))
}
</script>

<template>
  <CatalogSearchResultsList
    :results="props.results"
    :total-result-count="props.totalResultCount"
    :has-more-results="props.hasMoreResults"
    @reveal="(result) => emit('reveal', result)"
  >
    <template #actions="{ result }">
      <CatalogOrderActionGroup
        v-if="isOrderableResult(result)"
        class="search-result-actions"
        :quantity="resultQuantity(result)"
        :selected-quantity="selectedQuantity(result)"
        @update:qty="(qty) => handleQuantityInput(result, qty)"
        @add="handleAddToOrder(result)"
      />

      <button
        v-else
        type="button"
        class="btn btn-sm btn-outline-secondary result-action-btn"
        @click.stop="emit('reveal', result)"
        title="Reveal in tree"
        aria-label="Reveal in tree"
      >
        <i class="bi bi-arrow-return-right"></i>
      </button>
    </template>
  </CatalogSearchResultsList>
</template>
