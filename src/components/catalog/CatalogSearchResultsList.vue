<script setup lang="ts">
import { computed, useSlots } from 'vue'
import CatalogOrderActionGroup from '@/components/catalog/CatalogOrderActionGroup.vue'
import CatalogRowColumns from '@/components/catalog/CatalogRowColumns.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'
import type { CatalogItemQuantityUpdate, CatalogOrderSelection } from '@/types/shopOrders'
import { createCatalogOrderSelection, normalizeCatalogOrderQuantity } from '@/utils/catalogOrder'

const props = withDefaults(defineProps<{
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
  mode?: 'browse' | 'order'
  catalogItemQtys?: Record<string, number>
  selectedItemQuantities?: Record<string, number>
  orderableNodeIds?: Set<string>
}>(), {
  mode: 'browse',
  catalogItemQtys: () => ({}),
  selectedItemQuantities: () => ({}),
  orderableNodeIds: () => new Set<string>(),
})

const slots = useSlots()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
  (e: 'update:catalogItemQty', payload: CatalogItemQuantityUpdate): void
  (e: 'select-for-order', item: CatalogOrderSelection): void
}>()

function iconClass(result: CatalogSearchResult): string {
  if (result.kind === 'category') return 'bi bi-folder'
  return result.hasChildren ? 'bi bi-folder2' : 'bi bi-file-text'
}

function pathText(result: CatalogSearchResult): string {
  return result.breadcrumbLabel || 'Top level'
}

function resultDescription(result: CatalogSearchResult): string {
  return result.kind === 'item'
    ? result.item?.description ?? result.label
    : result.category?.name ?? result.label
}

function isOrderableResult(result: CatalogSearchResult): boolean {
  return props.mode === 'order' && props.orderableNodeIds.has(result.nodeId)
}

function resultQuantity(result: CatalogSearchResult): number {
  return normalizeCatalogOrderQuantity(props.catalogItemQtys[result.id], 1)
}

function selectedQuantity(result: CatalogSearchResult): number {
  return props.selectedItemQuantities[result.id] || 0
}

function handleQuantityInput(result: CatalogSearchResult, qty: number) {
  emit('update:catalogItemQty', { id: result.id, qty })
}

function handleAddToOrder(result: CatalogSearchResult) {
  emit('select-for-order', createCatalogOrderSelection({
    id: result.id,
    description: resultDescription(result),
    quantity: resultQuantity(result),
  }))
}

const summaryText = computed(() => {
  const count = `${props.totalResultCount} result${props.totalResultCount === 1 ? '' : 's'}`
  return props.hasMoreResults ? `${count}, showing the first ${props.results.length}` : count
})

const hasCustomActions = computed(() => !!slots.actions)
</script>

<template>
  <div class="catalog-search-results">
    <div class="search-summary small text-muted">{{ summaryText }}</div>

    <div class="app-catalog-tree">
      <div v-for="result in props.results" :key="result.nodeId" class="tree-node accordion-item">
        <div class="node-header" @click="emit('reveal', result)">
          <button
            type="button"
            class="accordion-button result-main"
            :class="result.hasChildren ? 'has-children collapsed' : 'not-expandable'"
            @click="emit('reveal', result)"
          >
            <i class="me-2 node-item-icon" :class="iconClass(result)"></i>
            <CatalogRowColumns
              class="result-columns"
              :label="result.label"
              :archived="!result.active"
              :sku="!result.hasChildren ? result.sku : undefined"
              :price="!result.hasChildren ? result.price : undefined"
              :context="pathText(result)"
            />
          </button>

          <div class="node-actions">
            <slot v-if="hasCustomActions" name="actions" :result="result">
            </slot>

            <CatalogOrderActionGroup
              v-else-if="isOrderableResult(result)"
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use '@/styles/_catalogSearchResults.scss';
</style>
