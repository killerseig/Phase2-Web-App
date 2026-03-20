<script setup lang="ts">
import CatalogSearchResultsList from '@/components/catalog/CatalogSearchResultsList.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'

const props = defineProps<{
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
  catalogItemQtys: Record<string, number>
  orderableNodeIds: Set<string>
}>()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
  (e: 'update:catalog-item-qty', payload: { id: string; qty: number }): void
  (e: 'select-for-order', item: { id: string; description: string; quantity: number }): void
}>()

function isOrderableResult(result: CatalogSearchResult): boolean {
  return props.orderableNodeIds.has(result.nodeId)
}

function resultQuantity(result: CatalogSearchResult): number {
  return props.catalogItemQtys[result.id] || 1
}

function resultDescription(result: CatalogSearchResult): string {
  return result.kind === 'item'
    ? result.item?.description ?? result.label
    : result.category?.name ?? result.label
}

function handleQuantityInput(result: CatalogSearchResult, event: Event) {
  const rawValue = Number((event.target as HTMLInputElement).value)
  const qty = Math.max(1, Math.floor(rawValue || 1))
  emit('update:catalog-item-qty', { id: result.id, qty })
}

function handleAddToOrder(result: CatalogSearchResult) {
  emit('select-for-order', {
    id: result.id,
    description: resultDescription(result),
    quantity: resultQuantity(result),
  })
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
      <div
        v-if="isOrderableResult(result)"
        class="btn-group btn-group-sm search-result-actions"
        role="group"
        @click.stop
      >
        <input
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          class="form-control form-control-sm search-result-qty"
          :value="resultQuantity(result)"
          aria-label="Quantity"
          @input="(event) => handleQuantityInput(result, event)"
        />
        <button
          type="button"
          class="btn btn-sm btn-success"
          title="Add to order"
          aria-label="Add to order"
          @click.stop="handleAddToOrder(result)"
        >
          <i class="bi bi-plus-circle"></i>
        </button>
      </div>

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

<style scoped lang="scss">
.search-result-actions {
  align-items: center;
}

.search-result-qty {
  width: 70px;
}
</style>
