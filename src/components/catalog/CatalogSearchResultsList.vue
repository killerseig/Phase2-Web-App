<script setup lang="ts">
import { computed } from 'vue'
import CatalogRowColumns from '@/components/catalog/CatalogRowColumns.vue'
import type { CatalogSearchResult } from '@/composables/useCatalogSearchResults'

const props = defineProps<{
  results: CatalogSearchResult[]
  totalResultCount: number
  hasMoreResults: boolean
}>()

const emit = defineEmits<{
  (e: 'reveal', result: CatalogSearchResult): void
}>()

function iconClass(result: CatalogSearchResult): string {
  if (result.kind === 'category') return 'bi bi-folder'
  return result.hasChildren ? 'bi bi-folder2' : 'bi bi-file-text'
}

function pathText(result: CatalogSearchResult): string {
  return result.breadcrumbLabel || 'Top level'
}

const summaryText = computed(() => {
  const count = `${props.totalResultCount} result${props.totalResultCount === 1 ? '' : 's'}`
  return props.hasMoreResults ? `${count}, showing the first ${props.results.length}` : count
})
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
            <slot name="actions" :result="result">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary result-action-btn"
                @click="emit('reveal', result)"
                title="Reveal in tree"
                aria-label="Reveal in tree"
              >
                <i class="bi bi-arrow-return-right"></i>
              </button>
            </slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/_catalogTreeRows.scss';

.catalog-search-results {
  background-color: transparent;
}

.search-summary {
  padding: 0.5rem 0.75rem;
}

.result-columns {
  flex: 1;
  min-width: 0;
}

.result-main {
  cursor: pointer;
}

.result-action-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
</style>
